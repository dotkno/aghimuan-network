-- Adds last-activity tracking so "online" can reflect a currently-active
-- session rather than a stale presence value from a past login.
-- Run once via a temporary run-migration.php, same as migration-presence-username.sql.

ALTER TABLE users ADD COLUMN last_seen INTEGER;
