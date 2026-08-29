-- Chat-owned durable storage. No user/room/permission tables are created
-- here: those remain owned by the existing Core API / Supabase Postgres.
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created_id_idx
  ON chat_messages (room_id, created_at DESC, id DESC);
