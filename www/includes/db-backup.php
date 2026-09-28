<?php
/**
 * db-backup.php — Lightweight hourly SQLite snapshotter (PHP-only, no shell).
 *
 * Restore runbook (file manager only, no commands):
 *   1) In the file manager, copy db-backups/aghimuan-<timestamp>.db
 *      over data/aghimuan.db (overwrite; upload ONLY the .db, never -wal/-shm).
 *   2) Open /backup-refresh.php as main admin.
 *   3) Click "Post-restore refresh".
 *   4) Green `quick_check ok` = done.
 *
 * Design notes:
 *   - Snapshots use `VACUUM INTO` (WAL-safe, transaction-consistent) with a
 *     `SQLite3::backup()` fallback for old SQLite builds. Never raw-copy.
 *   - Hourly cadence is traffic-triggered: get_db() calls db_backup_maybe_run()
 *     once per request; the lock + mtime check make idle calls ~1ms.
 *   - Pruning keeps 15 days AND always the newest 3, so a silent-corruption
 *     streak can never age out every good copy.
 *   - This file is dependency-free on purpose: it must NOT require
 *     session.php/admin-auth.php (db.php is included before any output and
 *     by pages with their own session bootstrap — see index.html:5-9).
 */

declare(strict_types=1);

const DB_BACKUP_DIR_NAME = 'db-backups';
const DB_BACKUP_INTERVAL_SECONDS = 3600; // 1 hour
const DB_BACKUP_RETENTION_DAYS = 15;
const DB_BACKUP_KEEP_NEWEST = 3;
const DB_BACKUP_PREFIX = 'aghimuan-';
const DB_BACKUP_LOCK_NAME = '.snapshot.lock';

// Flash tier: near-live ring buffer (60s-if-changed, keep-60). Separate
// subdir + prefix so the tiers can never list/prune each other's files.
const DB_FLASH_DIR_NAME = 'flash';
const DB_FLASH_INTERVAL_SECONDS = 60;
const DB_FLASH_KEEP = 60;
const DB_FLASH_PREFIX = 'flash-';

/** Absolute path of the live database (mirrors db.php:14). */
function db_backup_live_path(): string {
    return dirname(__DIR__, 2) . '/data/aghimuan.db';
}

/** Absolute path of the backup dir: repo root sibling of data/, outside www/. */
function db_backup_dir(): string {
    return dirname(__DIR__, 2) . '/' . DB_BACKUP_DIR_NAME;
}

/**
 * Create a backup dir on demand. $dir defaults to the hourly dir; pass
 * db_flash_dir() for the flash tier. Never throws — returns false instead.
 */
function db_backup_ensure_dir(?string $dir = null): bool {
    try {
        $dir = $dir ?? db_backup_dir();
        if (!is_dir($dir)) {
            if (!mkdir($dir, 0755, true)) {
                error_log('[db-backup] could not create backup dir');
                return false;
            }
        }
        return is_writable($dir);
    } catch (Throwable $e) {
        error_log('[db-backup] ensure dir failed: ' . $e->getMessage());
        return false;
    }
}

/** Absolute path of the flash dir: db-backups/flash/, outside www/. */
function db_flash_dir(): string {
    return db_backup_dir() . '/' . DB_FLASH_DIR_NAME;
}

/** Newest flash snapshot path, or null when the ring is empty. */
function db_flash_newest(): ?string {
    $files = db_flash_list();
    if (empty($files)) return null;
    usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
    return $files[0];
}

/** All flash snapshots, realpath-contained inside the flash dir. */
function db_flash_list(): array {
    $dir = db_flash_dir();
    if (!is_dir($dir)) return [];
    $base = realpath($dir);
    if ($base === false) return [];
    $out = [];
    foreach ((glob($dir . '/' . DB_FLASH_PREFIX . '*.db') ?: []) as $f) {
        $real = realpath($f);
        if ($real !== false && str_starts_with($real, $base) && is_file($real)) {
            $out[] = $real;
        }
    }
    return $out;
}

/** Newest snapshot path, or null when none exists. */
function db_backup_newest(): ?string {
    $files = db_backup_list();
    if (empty($files)) return null;
    usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
    return $files[0];
}

/** All snapshots, realpath-contained inside the backup dir. */
function db_backup_list(): array {
    $dir = db_backup_dir();
    if (!is_dir($dir)) return [];
    $base = realpath($dir);
    if ($base === false) return [];
    $out = [];
    foreach ((glob($dir . '/' . DB_BACKUP_PREFIX . '*.db') ?: []) as $f) {
        $real = realpath($f);
        if ($real !== false && str_starts_with($real, $base) && is_file($real)) {
            $out[] = $real;
        }
    }
    return $out;
}

/** Read-only health check of a database file. */
function db_backup_quick_check(string $path): bool {
    try {
        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $row = $pdo->query('PRAGMA quick_check')->fetch(PDO::FETCH_NUM);
        $pdo = null;
        return $row !== false && strcasecmp(trim((string) ($row[0] ?? '')), 'ok') === 0;
    } catch (Throwable $e) {
        error_log('[db-backup] quick_check failed: ' . $e->getMessage());
        return false;
    }
}

/**
 * Take one snapshot now. Returns ['success' => filename] or ['error' => msg].
 * Generic messages to the caller; detail goes to error_log (no path leaks).
 */
function db_backup_snapshot(PDO $pdo): array {
    if (!db_backup_ensure_dir()) {
        return ['error' => 'Backup directory is not writable.'];
    }
    $dir = db_backup_dir();
    $stamp = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d_H-i-s');
    $final = $dir . '/' . DB_BACKUP_PREFIX . $stamp . '.db';
    $tmp = $final . '.tmp';
    @unlink($tmp);

    try {
        // VACUUM INTO is WAL-safe: consistent copy even mid-write. Quote by
        // doubling single-quotes (SQLite string escape), never addslashes().
        $pdo->exec("VACUUM INTO '" . str_replace("'", "''", $tmp) . "'");
    } catch (Throwable $e) {
        error_log('[db-backup] VACUUM INTO failed, trying SQLite3 fallback: ' . $e->getMessage());
        if (!class_exists('SQLite3')) {
            @unlink($tmp);
            return ['error' => 'Snapshot failed (database busy or unsupported).'];
        }
        try {
            $src = new SQLite3(db_backup_live_path(), SQLITE3_OPEN_READONLY);
            $dst = new SQLite3($tmp);
            $ok = $src->backup($dst);
            $dst->close();
            $src->close();
            if (!$ok) {
                @unlink($tmp);
                return ['error' => 'Snapshot failed (database busy or unsupported).'];
            }
        } catch (Throwable $e2) {
            error_log('[db-backup] SQLite3 fallback failed: ' . $e2->getMessage());
            @unlink($tmp);
            return ['error' => 'Snapshot failed (database busy or unsupported).'];
        }
    }

    if (!db_backup_quick_check($tmp)) {
        @unlink($tmp);
        error_log('[db-backup] new snapshot failed verification, discarded');
        return ['error' => 'Snapshot failed verification and was discarded.'];
    }
    if (!@rename($tmp, $final)) {
        @unlink($tmp);
        error_log('[db-backup] could not publish snapshot');
        return ['error' => 'Snapshot failed (could not publish).'];
    }
    return ['success' => basename($final)];
}

/**
 * Delete snapshots older than retention. Always keeps the newest 3.
 * Returns the number of files deleted.
 */
function db_backup_prune(): int {
    $files = db_backup_list();
    if (empty($files)) return 0;
    usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
    $keep = array_slice($files, 0, DB_BACKUP_KEEP_NEWEST);
    $keepMap = array_flip($keep);
    $cutoff = time() - DB_BACKUP_RETENTION_DAYS * 86400;
    $deleted = 0;
    foreach ($files as $f) {
        if (isset($keepMap[$f])) continue;
        try {
            if ((filemtime($f) ?: time()) < $cutoff && @unlink($f)) {
                $deleted++;
            }
        } catch (Throwable $e) {
            error_log('[db-backup] prune failed for one file: ' . $e->getMessage());
        }
    }
    return $deleted;
}

/**
 * Take one flash snapshot now. Deliberate near-duplicate of db_backup_snapshot()
 * (not a shared core) so the proven hourly path stays untouched. Same shapes.
 */
function db_flash_snapshot(PDO $pdo): array {
    if (!db_backup_ensure_dir(db_flash_dir())) {
        return ['error' => 'Flash directory is not writable.'];
    }
    $dir = db_flash_dir();
    $stamp = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d_H-i-s');
    $final = $dir . '/' . DB_FLASH_PREFIX . $stamp . '.db';
    $tmp = $final . '.tmp';
    @unlink($tmp);

    try {
        $pdo->exec("VACUUM INTO '" . str_replace("'", "''", $tmp) . "'");
    } catch (Throwable $e) {
        error_log('[db-flash] VACUUM INTO failed, trying SQLite3 fallback: ' . $e->getMessage());
        if (!class_exists('SQLite3')) {
            @unlink($tmp);
            return ['error' => 'Flash snapshot failed (database busy or unsupported).'];
        }
        try {
            $src = new SQLite3(db_backup_live_path(), SQLITE3_OPEN_READONLY);
            $dst = new SQLite3($tmp);
            $ok = $src->backup($dst);
            $dst->close();
            $src->close();
            if (!$ok) {
                @unlink($tmp);
                return ['error' => 'Flash snapshot failed (database busy or unsupported).'];
            }
        } catch (Throwable $e2) {
            error_log('[db-flash] SQLite3 fallback failed: ' . $e2->getMessage());
            @unlink($tmp);
            return ['error' => 'Flash snapshot failed (database busy or unsupported).'];
        }
    }

    if (!db_backup_quick_check($tmp)) {
        @unlink($tmp);
        error_log('[db-flash] new snapshot failed verification, discarded');
        return ['error' => 'Flash snapshot failed verification and was discarded.'];
    }
    if (!@rename($tmp, $final)) {
        @unlink($tmp);
        error_log('[db-flash] could not publish snapshot');
        return ['error' => 'Flash snapshot failed (could not publish).'];
    }
    return ['success' => basename($final)];
}

/**
 * Trim the flash ring to the newest DB_FLASH_KEEP files (count-based —
 * flash is a recent window, not an archive, so no age rule applies).
 */
function db_flash_prune(): int {
    $files = db_flash_list();
    if (count($files) <= DB_FLASH_KEEP) return 0;
    usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
    $deleted = 0;
    foreach (array_slice($files, DB_FLASH_KEEP) as $f) {
        try {
            if (@unlink($f)) $deleted++;
        } catch (Throwable $e) {
            error_log('[db-flash] prune failed for one file: ' . $e->getMessage());
        }
    }
    return $deleted;
}

/**
 * Change-gated flash trigger: snapshots at most once per
 * DB_FLASH_INTERVAL_SECONDS, and only when the live DB changed since the
 * newest flash. Called inside db_backup_maybe_run()'s lock — no new locks.
 */
function db_flash_maybe_run(PDO $pdo): void {
    try {
        if (!db_backup_ensure_dir(db_flash_dir())) return;
        $live = db_backup_live_path();
        // WAL holds fresh writes — max() catches changes the .db mtime hides.
        $changedAt = max(@filemtime($live) ?: 0, @filemtime($live . '-wal') ?: 0);
        $newest = db_flash_newest();
        $newestAt = $newest ? (@filemtime($newest) ?: 0) : 0;
        if ($changedAt <= $newestAt) return; // nothing new since last flash
        if ($newest && (time() - $newestAt) < DB_FLASH_INTERVAL_SECONDS) return; // too soon
        $res = db_flash_snapshot($pdo);
        if (isset($res['error'])) {
            error_log('[db-flash] ' . $res['error']);
        }
        db_flash_prune();
    } catch (Throwable $e) {
        error_log('[db-flash] trigger failed: ' . $e->getMessage());
    }
}

/**
 * Hourly trigger for get_db(). Best-effort by design (mirrors the
 * touch_last_seen() pattern in session.php:122-133): lock-skip under
 * concurrency, swallow all errors, never break the visitor's request.
 */
function db_backup_maybe_run(PDO $pdo): void {
    try {
        if (!db_backup_ensure_dir()) return;
        $lockPath = db_backup_dir() . '/' . DB_BACKUP_LOCK_NAME;
        $lock = @fopen($lockPath, 'c');
        if ($lock === false) return;
        if (!flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);
            return; // another request is snapshotting — skip silently
        }
        try {
            $newest = db_backup_newest();
            $due = $newest === null || (time() - (filemtime($newest) ?: 0)) >= DB_BACKUP_INTERVAL_SECONDS;
            if ($due) {
                $res = db_backup_snapshot($pdo);
                if (isset($res['error'])) {
                    error_log('[db-backup] hourly snapshot: ' . $res['error']);
                }
                db_backup_prune();
            }
            // Flash tier rides the same lock: at most one extra snapshot
            // per minute, only when the DB actually changed.
            db_flash_maybe_run($pdo);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    } catch (Throwable $e) {
        // Non-critical — the page must load even if backups are broken.
        error_log('[db-backup] hourly trigger failed: ' . $e->getMessage());
    }
}

/**
 * Post-restore healing after a file-manager copy: checkpoint the WAL,
 * drop stale -wal/-shm sidecars, fix perms, verify. Returns ordered
 * human-readable steps (already escaped by caller) for the status page.
 */
function db_backup_post_restore_refresh(): array {
    $steps = [];
    $live = db_backup_live_path();
    if (!file_exists($live)) {
        return ['Live database file is missing — upload a backup first.'];
    }
    try {
        $pdo = new PDO('sqlite:' . $live);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo = null;
        $steps[] = 'WAL checkpoint complete.';
    } catch (Throwable $e) {
        error_log('[db-backup] post-restore checkpoint failed: ' . $e->getMessage());
        $steps[] = 'Checkpoint failed — see server logs. Continuing with sidecar cleanup.';
    }
    foreach (['-wal', '-shm'] as $suffix) {
        $sidecar = $live . $suffix;
        if (file_exists($sidecar) && @unlink($sidecar)) {
            $steps[] = 'Removed stale sidecar (' . basename($sidecar) . ').';
        }
    }
    if (!is_writable($live)) {
        if (@chmod($live, 0644) && is_writable($live)) {
            $steps[] = 'Fixed file permissions (now writable by the web server).';
        } else {
            $steps[] = 'WARNING: database file is not writable — fix ownership/permissions in the file manager.';
        }
    } else {
        $steps[] = 'Permissions OK (writable).';
    }
    $steps[] = db_backup_quick_check($live)
        ? 'quick_check ok — database is healthy.'
        : 'WARNING: quick_check did NOT pass — try an older snapshot.';
    return $steps;
}
