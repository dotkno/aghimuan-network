PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    username                TEXT NOT NULL,
    username_lower          TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    bio                     TEXT DEFAULT '',
    status                  TEXT DEFAULT '',
    pfp_id                  TEXT DEFAULT 'default',
    main_role               TEXT NOT NULL DEFAULT 'MEMBER',
    sub_role                TEXT,
    grade                   TEXT,
    strand                  TEXT,
    club                    TEXT,
    presence                TEXT DEFAULT 'online',
    username_changed_at     TEXT,
    last_seen               INTEGER,
    is_banned               INTEGER NOT NULL DEFAULT 0,
    ip_address               TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent  TEXT,
    ip_hash     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS friends (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending',
    requested_by INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id   INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     TEXT NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'visible',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    edited_at   TEXT,
    deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

CREATE TABLE IF NOT EXISTS reactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (target_type, target_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS dms (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'visible',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    edited_at    TEXT,
    deleted_at   TEXT,
    read_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_dms_sender ON dms(sender_id);
CREATE INDEX IF NOT EXISTS idx_dms_recipient ON dms(recipient_id);

-- Everything that isn't naturally derivable from another table's current
-- state (friend requests stay a live query against `friends` — see
-- includes/notifications.php's header comment for why). Columns match what
-- includes/notifications.php's functions expect.
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type        TEXT NOT NULL,
    payload     TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Discord-style custom roles: admin-created name + color/gradient, not tied
-- to any main role. A user can hold any number of these at once.
CREATE TABLE IF NOT EXISTS custom_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    color_css   TEXT NOT NULL,
    text_color  TEXT NOT NULL DEFAULT '#ffffff',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_custom_roles (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     INTEGER NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user ON user_custom_roles(user_id);

CREATE TABLE IF NOT EXISTS automod_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    context     TEXT NOT NULL,
    original    TEXT NOT NULL,
    matched     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Signup-time IP bans, set from the admin panel's User Management tab
-- after an account is deleted. Checked by signup.php before a new account
-- can be created.
CREATE TABLE IF NOT EXISTS banned_ips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address  TEXT NOT NULL UNIQUE,
    reason      TEXT,
    banned_by   TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);