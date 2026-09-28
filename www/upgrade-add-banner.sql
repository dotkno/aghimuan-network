-- Adds profile banner support (2026-09-10).
--
-- Run ONCE against the existing database, e.g.:
--   sqlite3 data/aghimuan.db < upgrade-add-banner.sql
--
-- Fresh installs don't need this — schema.sql already includes the column.
-- The PHP side detects whether the column exists and degrades gracefully
-- (banner features hidden / rejected with a clear message) if it doesn't.
ALTER TABLE users ADD COLUMN banner_id TEXT DEFAULT NULL;
