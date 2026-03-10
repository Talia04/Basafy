-- Enable push notifications by default for all users.
-- New users are covered by the DEFAULT change.
-- Existing users who have never explicitly touched the setting are also enabled.

ALTER TABLE public.user_notification_settings
  ALTER COLUMN push_enabled SET DEFAULT true;

UPDATE public.user_notification_settings
SET push_enabled = true
WHERE push_enabled = false;
