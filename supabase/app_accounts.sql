-- ========================================================================
-- CALENDEY — Cloud Accounts Table (app_accounts)
-- Digunakan untuk sinkronisasi akun antar perangkat / laptop via Supabase
-- ========================================================================

-- 1. Buat tabel app_accounts jika belum ada
create table if not exists public.app_accounts (
    id uuid primary key default gen_random_uuid(),
    username text unique not null,
    name text not null,
    full_name text,
    email text unique not null,
    password text not null,
    role text not null default 'Member',
    whatsapp text,
    telegram_chat_id text,
    reminders_enabled boolean not null default true,
    default_remind_offset_days int not null default 1,
    default_remind_time text not null default '09:00',
    theme text not null default 'light',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Index untuk mempercepat query saat login
create index if not exists idx_app_accounts_lookup 
on public.app_accounts (username, email);

-- 2. Aktifkan Row Level Security (RLS)
alter table public.app_accounts enable row level security;

-- 3. Kebijakan akses (Policies) agar aplikasi web (anon key) dapat membaca & menyinkronkan akun
drop policy if exists "Allow read app_accounts" on public.app_accounts;
create policy "Allow read app_accounts" 
on public.app_accounts for select 
using (true);

drop policy if exists "Allow insert app_accounts" on public.app_accounts;
create policy "Allow insert app_accounts" 
on public.app_accounts for insert 
with check (true);

drop policy if exists "Allow update app_accounts" on public.app_accounts;
create policy "Allow update app_accounts" 
on public.app_accounts for update 
using (true);

drop policy if exists "Allow delete app_accounts" on public.app_accounts;
create policy "Allow delete app_accounts" 
on public.app_accounts for delete 
using (true);

-- 4. Seed data akun bawaan resmi Calendey
insert into public.app_accounts (id, username, name, full_name, email, password, role)
values 
  ('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'superadmin', 'Superadmin Calendey', 'Superadmin Calendey', 'superadmin@calendey.app', 'admin-calender', 'Admin'),
  ('1df2ed64-32c9-446f-852a-2e3d13d92adb', 'dhafin', 'Dhafin Shabir Alfatih', 'Dhafin Shabir Alfatih', 'dhafinshabir610@gmail.com', 'dhafin12345', 'Admin'),
  ('e2a8b910-5c56-44a8-91aa-9cfd1367db99', 'nadia', 'Nadia Azra Azizah', 'Nadia Azra Azizah', 'nadia@calendey.app', 'nadiacantik', 'Creator')
on conflict (email) do update 
set 
  name = excluded.name,
  full_name = excluded.full_name,
  password = excluded.password,
  role = excluded.role;
