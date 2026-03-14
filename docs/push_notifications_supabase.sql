-- Push-уведомления (Expo Push Token)
-- ВАЖНО: поменяйте email администратора в политиках ниже, если потребуется.

begin;

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_push_logs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid null references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  target_mode text not null,
  target_user_id uuid null references auth.users(id) on delete set null,
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_push_tokens_user_id on public.device_push_tokens(user_id);
create index if not exists idx_device_push_tokens_active on public.device_push_tokens(is_active);

create unique index if not exists ux_device_push_tokens_user_token
  on public.device_push_tokens(user_id, expo_push_token);
create index if not exists idx_admin_push_logs_created_at on public.admin_push_logs(created_at desc);

alter table public.device_push_tokens enable row level security;
alter table public.admin_push_logs enable row level security;

-- Обновляем updated_at автоматически
create or replace function public.set_device_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_device_push_tokens_updated_at on public.device_push_tokens;
create trigger trg_set_device_push_tokens_updated_at
before update on public.device_push_tokens
for each row
execute function public.set_device_push_tokens_updated_at();

-- Пользователь видит только свои токены
drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
create policy "device_push_tokens_select_own"
on public.device_push_tokens
for select
to authenticated
using (user_id = auth.uid());

-- Пользователь может создавать только свои токены
drop policy if exists "device_push_tokens_insert_own" on public.device_push_tokens;
create policy "device_push_tokens_insert_own"
on public.device_push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

-- Пользователь может обновлять только свои токены
drop policy if exists "device_push_tokens_update_own" on public.device_push_tokens;
create policy "device_push_tokens_update_own"
on public.device_push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Админ может читать все токены (для массовой рассылки)
drop policy if exists "device_push_tokens_admin_select_all" on public.device_push_tokens;
create policy "device_push_tokens_admin_select_all"
on public.device_push_tokens
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'archedartem@gmail.com');

-- Логи: только админ
-- select
drop policy if exists "admin_push_logs_admin_select" on public.admin_push_logs;
create policy "admin_push_logs_admin_select"
on public.admin_push_logs
for select
to authenticated
using ((auth.jwt() ->> 'email') = 'archedartem@gmail.com');

-- insert
drop policy if exists "admin_push_logs_admin_insert" on public.admin_push_logs;
create policy "admin_push_logs_admin_insert"
on public.admin_push_logs
for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'archedartem@gmail.com');

commit;
