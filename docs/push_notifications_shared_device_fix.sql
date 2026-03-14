-- Migration fix: allow one physical device token to be linked to multiple users.
-- This resolves failures when a device was previously used with another account.

begin;

-- Remove legacy uniqueness on expo_push_token (name may differ depending on how table was created)
alter table if exists public.device_push_tokens
  drop constraint if exists device_push_tokens_expo_push_token_key;

drop index if exists public.device_push_tokens_expo_push_token_key;

-- Enforce uniqueness per user+token pair instead.
create unique index if not exists ux_device_push_tokens_user_token
  on public.device_push_tokens(user_id, expo_push_token);

commit;
