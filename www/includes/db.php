<?php
/**
 * db.php — single source of truth for the SQLite connection.
 */

declare(strict_types=1);

function get_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dbPath = __DIR__ . '/../../data/aghimuan.db';
    $isNew  = !file_exists($dbPath);

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');

    if ($isNew) {
        $schema = file_get_contents(__DIR__ . '/../schema.sql');
        $pdo->exec($schema);
    }

    // Runs on every connection, new or existing, so a fresh install and an
    // older DB both end up with this table — cheap no-op once it exists.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS notifications (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
            type        TEXT NOT NULL,
            payload     TEXT,
            is_read     INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)');

    // Direct messages between two users. `status` is 'sent' | 'deleted' —
    // schema's ready for a future delete action even though nothing sets it
    // to 'deleted' yet. Same unconditional/every-connection pattern as
    // notifications above, so both fresh installs and older DBs get it.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS direct_messages (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body          TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT \'sent\',
            is_read       INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_dm_sender_recipient ON direct_messages(sender_id, recipient_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread ON direct_messages(recipient_id, is_read)');

    // Edit support for DMs: NULL until the sender edits, then holds the last
    // edit time so the UI can show "(edited)". Added after the table already
    // shipped, so — same reasoning as sub_role below — this has to be an
    // unconditional post-creation check rather than part of the CREATE TABLE
    // above, or existing deployed DBs would never pick it up.
    $dmCols = $pdo->query('PRAGMA table_info(direct_messages)')->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('edited_at', $dmCols, true)) {
        $pdo->exec('ALTER TABLE direct_messages ADD COLUMN edited_at TEXT');
    }

    // Reply support for DMs: allows replying to a specific message.
    // Added after the table already shipped, so unconditional check.
    if (!in_array('reply_to_id', $dmCols, true)) {
        $pdo->exec('ALTER TABLE direct_messages ADD COLUMN reply_to_id INTEGER REFERENCES direct_messages(id) ON DELETE SET NULL');
    }

    // Ephemeral "is typing" signal, one row per (viewer, thread-partner) pair,
    // upserted on keystroke and read back with a short freshness window —
    // see TYPING_FRESHNESS_SECONDS in dms.php. No foreign-key cascade concerns
    // beyond the users table since rows are meaningless once stale anyway.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS dm_typing (
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            other_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            updated_at  TEXT NOT NULL DEFAULT (datetime(\'now\')),
            PRIMARY KEY (user_id, other_id)
        )'
    );

    // The single officer/adviser/committee sub-role (Faculty, President, Sgt.
    // at Arms, etc.) — separate from grade/strand/club, which are MEMBER-only.
    $userColsForSubRole = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('sub_role', $userColsForSubRole, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN sub_role TEXT");
    }

    // Plain (unhashed) signup IP, used only for admin moderation — banning
    // an IP from creating new accounts. Separate from sessions.ip_hash,
    // which is one-way and can't be used for that. Same unconditional
    // check as sub_role above, so older DBs pick it up without a fresh
    // install.
    $userColsForIp = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('ip_address', $userColsForIp, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN ip_address TEXT");
    }

    // Signup-time IP bans — checked by signup.php before a new account can
    // be created. Same unconditional/every-connection pattern as
    // notifications and direct_messages above.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS banned_ips (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address  TEXT NOT NULL UNIQUE,
            reason      TEXT,
            banned_by   TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );

    // Creations Hub: Email verification fields for PCU Gmail via Firebase Auth
    $userColsForVerification = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('email', $userColsForVerification, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email TEXT");
    }
    if (!in_array('firebase_uid', $userColsForVerification, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN firebase_uid TEXT");
        $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)");
    }
    if (!in_array('is_verified', $userColsForVerification, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0");
    }
    if (!in_array('verified_at', $userColsForVerification, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN verified_at TEXT");
    }
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    // Discord-style custom roles: name + CSS color/gradient, not tied to any
    // main role, many-to-many with users via user_custom_roles.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS custom_roles (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            color_css   TEXT NOT NULL,
            text_color  TEXT NOT NULL DEFAULT \'#ffffff\',
            created_at  TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS user_custom_roles (
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id     INTEGER NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
            assigned_at TEXT NOT NULL DEFAULT (datetime(\'now\')),
            PRIMARY KEY (user_id, role_id)
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user ON user_custom_roles(user_id)');

    // Creations Hub: Submissions table for student projects
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS creations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            title           TEXT NOT NULL,
            description     TEXT NOT NULL,
            category        TEXT NOT NULL,
            tools_used      TEXT,
            media_urls      TEXT,
            external_link   TEXT,
            submitted_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status          TEXT NOT NULL DEFAULT \'pending\',
            featured_period TEXT,
            featured_at     TEXT,
            rejection_reason TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime(\'now\')),
            updated_at      TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_creations_submitted_by ON creations(submitted_by)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_creations_status ON creations(status)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_creations_featured ON creations(featured_period, featured_at)');

    // School-year batch (e.g. '2026-2027') shown by the hub's batch filter,
    // plus the admin-set award label shown on the spotlight/detail view.
    // Added after the table shipped, so unconditional checks like the rest.
    $creationCols = $pdo->query('PRAGMA table_info(creations)')->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('batch', $creationCols, true)) {
        $pdo->exec('ALTER TABLE creations ADD COLUMN batch TEXT');
    }
    if (!in_array('award', $creationCols, true)) {
        $pdo->exec('ALTER TABLE creations ADD COLUMN award TEXT');
    }
    // Wizard-era freedom fields: demo video URL, labeled project links
    // (JSON [{label, url}]) and collaborator user IDs (JSON [id, ...]).
    // Same unconditional pattern so deployed DBs pick them up.
    if (!in_array('video_url', $creationCols, true)) {
        $pdo->exec('ALTER TABLE creations ADD COLUMN video_url TEXT');
    }
    if (!in_array('links', $creationCols, true)) {
        $pdo->exec('ALTER TABLE creations ADD COLUMN links TEXT');
    }
    if (!in_array('collaborators', $creationCols, true)) {
        $pdo->exec('ALTER TABLE creations ADD COLUMN collaborators TEXT');
    }
    // Cover focal point (JSON {x, y} in 0-100) chosen in the submit wizard's
    // Adjust step — viewers render it as object-position so any image shape
    // crops around what the submitter actually framed.
    if (!in_array('cover_focus', $creationCols, true)) {
        $pdo->exec('ALTER TABLE creations ADD COLUMN cover_focus TEXT');
    }
    // Backfill rows submitted before the column existed: derive the school
    // year (June cutoff) from created_at so the batch filter has data.
    $pdo->exec(
        "UPDATE creations SET batch =
            CASE WHEN CAST(strftime('%m', created_at) AS INTEGER) >= 6
                 THEN strftime('%Y', created_at) || '-' || (CAST(strftime('%Y', created_at) AS INTEGER) + 1)
                 ELSE (CAST(strftime('%Y', created_at) AS INTEGER) - 1) || '-' || strftime('%Y', created_at)
            END
         WHERE batch IS NULL OR batch = ''"
    );

    // Resource Hub: curated third-party learning resources (links only —
    // nothing is hosted) + per-user favorites. Unconditional, same as
    // creations above, so fresh installs and older DBs both get it.
    // submitted_by is NULL for admin-seeded staff picks (ON DELETE SET NULL
    // so a deleted user's seeds survive, attributed to Aghimuan Staff).
    // Uniqueness lives on url_norm (canonicalized by
    // normalize_resource_url()) so http/https + trailing-slash variants
    // can't create duplicate rows.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS resources (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            title            TEXT NOT NULL,
            description      TEXT NOT NULL,
            category         TEXT NOT NULL DEFAULT \'other\',
            type             TEXT NOT NULL DEFAULT \'website\',
            url              TEXT NOT NULL,
            url_norm         TEXT NOT NULL,
            tags             TEXT,
            image_url        TEXT,
            submitted_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
            status           TEXT NOT NULL DEFAULT \'pending\',
            featured         INTEGER NOT NULL DEFAULT 0,
            featured_at      TEXT,
            rejection_reason TEXT,
            created_at       TEXT NOT NULL DEFAULT (datetime(\'now\')),
            updated_at       TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_url_norm ON resources(url_norm)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_resources_cat_type ON resources(category, type)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_resources_featured ON resources(featured, featured_at)');
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS resource_favorites (
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
            created_at  TEXT NOT NULL DEFAULT (datetime(\'now\')),
            PRIMARY KEY (user_id, resource_id)
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_resfav_resource ON resource_favorites(resource_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_resfav_user ON resource_favorites(user_id)');

    if (!$isNew) {
        // Auto-migrate users table for role system and profile fields
        $userCols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!empty($userCols)) {
            if (!in_array('main_role', $userCols, true)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN main_role TEXT NOT NULL DEFAULT 'MEMBER'");
            }
            if (!in_array('grade', $userCols, true)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN grade TEXT");
            }
            if (!in_array('strand', $userCols, true)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN strand TEXT");
            }
            if (!in_array('club', $userCols, true)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN club TEXT");
            }
        }

        // auto-migrate existing comments table for threading support
        $cols = $pdo->query("PRAGMA table_info(comments)")->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!empty($cols)) {
            if (!in_array('parent_id', $cols, true)) {
                $pdo->exec('ALTER TABLE comments ADD COLUMN parent_id INTEGER NULL DEFAULT NULL');
            }
            if (!in_array('reply_to_user', $cols, true)) {
                $pdo->exec('ALTER TABLE comments ADD COLUMN reply_to_user TEXT NULL DEFAULT NULL');
            }
        }

        // auto-migrate existing resources table for per-resource cover images
        $resCols = $pdo->query("PRAGMA table_info(resources)")->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!empty($resCols) && !in_array('image_url', $resCols, true)) {
            $pdo->exec('ALTER TABLE resources ADD COLUMN image_url TEXT NULL DEFAULT NULL');
        }

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS reactions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                target_type TEXT NOT NULL,
                target_id   TEXT NOT NULL,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                emoji       TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime(\'now\')),
                UNIQUE (target_type, target_id, user_id, emoji)
            )'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions(target_type, target_id)');
    }

    // Hourly DB snapshots (best-effort, never fatal — see db-backup.php).
    // The lib is dependency-free so this stays safe to include everywhere.
    require_once __DIR__ . '/db-backup.php';
    db_backup_maybe_run($pdo);

    return $pdo;
}
