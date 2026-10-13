-- Moderation actions are now distinct:
--   block -> cannot access/rejoin the room
--   mute  -> chat restriction only (cannot send messages)
--   mic   -> microphone mute only (speakers)
alter table public.room_moderation drop constraint if exists room_moderation_kind_check;
alter table public.room_moderation
  add constraint room_moderation_kind_check check (kind in ('block', 'mute', 'mic'));
