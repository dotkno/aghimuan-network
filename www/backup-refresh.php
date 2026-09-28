<?php
// backup-refresh.php — Admin-only DB snapshot status + post-restore refresh.
///upload/downloads never have direct URLs: snapshots live in db-backups/
// (repo root, outside www/) and are streamed here after an admin login.
session_start();
date_default_timezone_set('Asia/Manila');

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/admin-config.php';
require_once __DIR__ . '/includes/admin-auth.php';
require_once __DIR__ . '/includes/db-backup.php';

$pdo = get_db();
$admin_csrf_token = admin_csrf_token();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_verify_csrf();
}

$error = handle_admin_login($pdo);
handle_admin_logout();

$me = current_admin();

// Gated file download (same basename-whitelist + realpath containment
// discipline as library/data-gate.php:37-46). ?tier=flash serves the flash
// ring; anything else serves hourly. Tier is allowlist-matched, never a path.
if ($me && isset($_GET['f'])) {
    $f = (string) $_GET['f'];
    $tier = (isset($_GET['tier']) && $_GET['tier'] === 'flash') ? 'flash' : 'hourly';
    $tierDir = $tier === 'flash' ? db_flash_dir() : db_backup_dir();
    $tierRe = $tier === 'flash'
        ? '/^flash-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/'
        : '/^aghimuan-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/';
    if (!preg_match($tierRe, $f)) {
        http_response_code(400);
        exit('Invalid file.');
    }
    $base = realpath($tierDir);
    $path = realpath($tierDir . '/' . $f);
    if ($base === false || $path === false || !str_starts_with($path, $base) || !is_file($path)) {
        http_response_code(404);
        exit('Not found.');
    }
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $f . '"');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: no-store');
    readfile($path);
    exit;
}

$report = [];
if ($me && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['backup_action'])) {
    $action = (string) $_POST['backup_action'];
    if ($action === 'snapshot_now') {
        $res = db_backup_snapshot($pdo);
        db_backup_prune();
        $report[] = isset($res['success'])
            ? 'Snapshot saved (' . $res['success'] . ').'
            : ($res['error'] ?? 'Snapshot failed.');
    } elseif ($action === 'post_restore_refresh') {
        $report = db_backup_post_restore_refresh();
    } elseif ($action === 'prune_now') {
        $n = db_backup_prune();
        $report[] = 'Prune complete (' . $n . ' old file(s) removed).';
    }
}

$e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');

$livePath = db_backup_live_path();
$backups = $me ? db_backup_list() : [];
usort($backups, fn($a, $b) => filemtime($b) <=> filemtime($a));
$flash = $me ? db_flash_list() : [];
usort($flash, fn($a, $b) => filemtime($b) <=> filemtime($a));
$liveOk = $me ? db_backup_quick_check($livePath) : false;
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DB Backups — Aghimuan</title>
<style>
body { background: #0c0e14; color: #F1F2F5; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
.wrap { max-width: 720px; margin: 0 auto; }
.card { background: #161a26; border: 1px solid #26304a; border-radius: 12px; padding: 18px; margin-bottom: 14px; }
.msg { padding: 10px 14px; border-radius: 8px; margin-bottom: 10px; }
.msg.error { background: #3a1a1e; color: #ff8b96; }
.msg.success { background: #123321; color: #4dffa0; }
.muted { color: #8891a8; font-size: .85rem; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
button { background: #3096C7; color: #05060c; font-weight: 700; border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer; }
a.dl { color: #55F1F8; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
td, th { padding: 6px 4px; border-bottom: 1px solid #1e2536; text-align: left; }
.login-box { max-width: 380px; margin: 8vh auto; background: #161a26; border: 1px solid #26304a; border-radius: 12px; padding: 24px; }
.login-box input { width: 100%; box-sizing: border-box; margin: 6px 0; padding: 10px; border-radius: 8px; border: 1px solid #26304a; background: #10131c; color: #F1F2F5; }
</style>
</head>
<body>
<div class="wrap">

<?php if (!$me): ?>
    <div class="login-box">
        <h2>Aghimuan Admin</h2>
        <p class="muted">Sign in to manage database backups.</p>
        <?php if (!empty($error)) echo "<div class='msg error'>" . $e($error) . "</div>"; ?>
        <form method="POST">
            <input type="hidden" name="csrf_token" value="<?php echo $e($admin_csrf_token); ?>">
            <input type="hidden" name="action" value="login">
            <input type="text" name="username" placeholder="Username" autocomplete="username" required>
            <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
            <button type="submit">Log In</button>
        </form>
    </div>
<?php else: ?>

    <h2>DB Backups</h2>
    <p class="muted"><a class="dl" href="admin.php">← Back to Control Panel</a> · Logged in as <?php echo $e($me['username']); ?> · <a class="dl" href="?action=logout">Log Out</a></p>

    <?php foreach ($report as $line): ?>
        <div class="msg success"><?php echo $e($line); ?></div>
    <?php endforeach; ?>

    <div class="card">
        <strong>Live database</strong><br>
        Size: <?php echo file_exists($livePath) ? $e(round(filesize($livePath) / 1024) . ' KB') : 'MISSING'; ?>
        · Modified: <?php echo file_exists($livePath) ? $e(date('Y-m-d H:i', filemtime($livePath))) : '—'; ?><br>
        WAL sidecars:
        <?php echo file_exists($livePath . '-wal') ? $e('present (' . round(filesize($livePath . '-wal') / 1024) . ' KB)') : 'none'; ?> /
        <?php echo file_exists($livePath . '-shm') ? 'present' : 'none'; ?><br>
        Health: <?php echo $liveOk ? 'quick_check ok' : 'NOT OK — run Post-restore refresh'; ?>
    </div>

    <div class="card">
        <strong>Snapshots</strong>
        <span class="muted">(<?php echo count($backups); ?> kept · newest: <?php echo $backups ? $e(basename($backups[0])) : 'none yet'; ?> · auto-prune: 15 days, newest 3 always kept)</span>
        <form method="POST" style="margin: 10px 0;">
            <input type="hidden" name="csrf_token" value="<?php echo $e($admin_csrf_token); ?>">
            <div class="row">
                <button type="submit" name="backup_action" value="snapshot_now">Snapshot now</button>
                <button type="submit" name="backup_action" value="post_restore_refresh">Post-restore refresh</button>
                <button type="submit" name="backup_action" value="prune_now">Prune now</button>
            </div>
        </form>
        <?php if ($backups): ?>
        <table>
            <tr><th>File</th><th>Size</th><th>Taken</th><th></th></tr>
            <?php foreach ($backups as $b): ?>
            <tr>
                <td><?php echo $e(basename($b)); ?></td>
                <td><?php echo $e(round(filesize($b) / 1024) . ' KB'); ?></td>
                <td><?php echo $e(date('Y-m-d H:i', filemtime($b))); ?></td>
                <td><a class="dl" href="?f=<?php echo $e(basename($b)); ?>">Download</a></td>
            </tr>
            <?php endforeach; ?>
        </table>
        <?php else: ?>
        <p class="muted">No snapshots yet — click “Snapshot now”, or wait for hourly traffic.</p>
        <?php endif; ?>
    </div>

    <div class="card">
        <strong>Flash backups</strong>
        <span class="muted">(<?php echo count($flash); ?> kept · ring: last <?php echo DB_FLASH_KEEP; ?> · snapshot at most every 60s and only when the DB changed)</span>
        <?php if ($flash): ?>
        <table>
            <tr><th>File</th><th>Size</th><th>Taken</th><th></th></tr>
            <?php foreach (array_slice($flash, 0, 10) as $b): ?>
            <tr>
                <td><?php echo $e(basename($b)); ?></td>
                <td><?php echo $e(round(filesize($b) / 1024) . ' KB'); ?></td>
                <td><?php echo $e(date('Y-m-d H:i', filemtime($b))); ?></td>
                <td><a class="dl" href="?tier=flash&f=<?php echo $e(basename($b)); ?>">Download</a></td>
            </tr>
            <?php endforeach; ?>
        </table>
        <?php if (count($flash) > 10): ?>
        <p class="muted">Showing latest 10 of <?php echo count($flash); ?>.</p>
        <?php endif; ?>
        <?php else: ?>
        <p class="muted">No flash snapshots yet — they appear within a minute of the next DB change.</p>
        <?php endif; ?>
    </div>

    <div class="card muted">
        Restore runbook: file-manager copy <span style="font-family:monospace">db-backups/aghimuan-&lt;time&gt;.db</span>
        over <span style="font-family:monospace">data/aghimuan.db</span> (only the .db, never -wal/-shm),
        then click “Post-restore refresh”. For a wiped/empty DB always restore from
        <strong>Snapshots</strong>, never flash (flash faithfully records even an empty DB).
        Download → verify on your PC → then delete the server copy.
    </div>

<?php endif; ?>
</div>
</body>
</html>
