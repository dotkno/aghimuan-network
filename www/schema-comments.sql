-- schema-comments.sql
-- One-off migration: adds the comments table.
-- post_id has no DB foreign key since announcements live in announcements.json,
-- not a table -- it's just matched against that JSON's numeric `id` field at
-- read/write time in api/comments.php and in admin.php's delete-announcement action.
-- parent_id is included now (NULL for every row today) so threaded replies
-- (step 2 of the social layer) don't require a second migration later.

CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    parent_id   INTEGER NULL REFERENCES comments(id),
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    edited_at   TEXT NULL,
    deleted_at  TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
