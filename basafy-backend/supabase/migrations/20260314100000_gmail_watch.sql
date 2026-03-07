-- Gmail Push Watch: track per-user watch registration and history cursor
ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS watch_resource_id   text,
  ADD COLUMN IF NOT EXISTS watch_expiry        bigint,   -- ms since epoch, from Google
  ADD COLUMN IF NOT EXISTS last_history_id     text;     -- latest processed historyId (dedup cursor)

COMMENT ON COLUMN gmail_connections.watch_resource_id IS 'Google Gmail push watch resourceId, returned by gmail.users.watch()';
COMMENT ON COLUMN gmail_connections.watch_expiry      IS 'Millisecond epoch when the watch expires (max 7 days from setup)';
COMMENT ON COLUMN gmail_connections.last_history_id   IS 'Latest Gmail historyId processed; push notifications with historyId <= this are skipped';
