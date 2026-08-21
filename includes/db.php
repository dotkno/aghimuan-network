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

    return $pdo;
}