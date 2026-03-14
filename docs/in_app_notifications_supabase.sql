-- In-app уведомления (без push)
-- ВАЖНО: поменяйте email администратора в политиках ниже, если потребуется.
-- Сейчас доступ на создание/редактирование объявлений открыт только для archedartem@gmail.com

begin;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_user_id uuid null references auth.users(id) on delete set null,
  is_active boolean not null default true,
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- announcements: читать только активные, адресованные всем или конкретно себе
create policy if not exists "announcements_select_for_users"
on public.announcements
for select
to authenticated
using (
  is_active = true
  and (target_user_id is null or target_user_id = auth.uid())
);

-- announcements: создавать/изменять/удалять только админу по email
create policy if not exists "announcements_admin_insert"
on public.announcements
for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'archedartem@gmail.com');

create policy if not exists "announcements_admin_update"
on public.announcements
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'archedartem@gmail.com')
with check ((auth.jwt() ->> 'email') = 'archedartem@gmail.com');

create policy if not exists "announcements_admin_delete"
on public.announcements
for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'archedartem@gmail.com');

-- announcement_reads: пользователь может видеть/создавать только свои отметки прочтения
create policy if not exists "announcement_reads_select_own"
on public.announcement_reads
for select
to authenticated
using (user_id = auth.uid());

create policy if not exists "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (user_id = auth.uid());

commit;
