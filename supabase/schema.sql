-- ========================================================================
-- CALENDEY — Database Schema (PostgreSQL / Supabase)
-- Versi: 1.0 | Sesuai PRD & Model Database Resmi
-- ========================================================================

-- Enable necessary extensions
create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
-- Terhubung 1-to-1 dengan auth.users
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^62[0-9]{8,13}$'),
    theme text not null default 'light' check (theme in ('light', 'dark', 'pink')),
    reminders_enabled boolean not null default true,
    default_remind_offset_days int not null default 1,
    default_remind_time time not null default '09:00',
    timezone text not null default 'Asia/Jakarta',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. CATEGORIES TABLE
-- Master kategori hari nasional
create table if not exists public.categories (
    id smallint primary key,
    name text unique not null,
    slug text unique not null,
    color_hex text not null,
    icon text
);

-- 3. NATIONAL DAYS TABLE
-- Katalog hari besar nasional & keagamaan
create table if not exists public.national_days (
    id serial primary key,
    category_id smallint not null references public.categories(id) on delete restrict,
    name text not null,
    day smallint not null check (day between 1 and 31),
    month smallint not null check (month between 1 and 12),
    year smallint, -- Nullable: Jika NULL berarti berulang tiap tahun; diisi angka jika tanggal berubah tahunan
    description text,
    tagline text,
    is_public_holiday boolean not null default false,
    created_at timestamptz not null default now()
);

-- Index performa query kalender bulanan
create index if not exists idx_national_days_month_day on public.national_days (month, day);

-- 4. CUSTOM EVENTS TABLE
-- Event pribadi yang dibuat oleh pengguna
create table if not exists public.custom_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    event_date date not null,
    description text,
    color_hex text default '#6366f1',
    created_at timestamptz not null default now()
);

create index if not exists idx_custom_events_user_date on public.custom_events (user_id, event_date);

-- 5. CONTENT PLANS TABLE
-- Inti dari Content Planner
create table if not exists public.content_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    national_day_id int references public.national_days(id) on delete set null,
    custom_event_id uuid references public.custom_events(id) on delete set null,
    title text not null check (char_length(title) <= 150),
    caption text,
    notes text,
    platforms text[] not null default '{}',
    planned_date date not null,
    scheduled_at timestamptz,
    status text not null default 'idea' check (status in ('idea', 'design_done', 'ready', 'posted')),
    design_done boolean not null default false,
    is_posted boolean not null default false,
    posted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Index performa query per pengguna, per tanggal, dan per status
create index if not exists idx_content_plans_user_date on public.content_plans (user_id, planned_date);
create index if not exists idx_content_plans_user_status on public.content_plans (user_id, status);

-- 6. CONTENT ASSETS TABLE
-- File desain/poster yang di-upload
create table if not exists public.content_assets (
    id uuid primary key default gen_random_uuid(),
    content_plan_id uuid not null references public.content_plans(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null,
    file_name text not null,
    mime_type text not null,
    file_size int not null check (file_size <= 5242880), -- Maksimal 5 MB
    sort_order smallint not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_content_assets_plan_id on public.content_assets (content_plan_id);

-- 7. REMINDERS TABLE
-- Jadwal pengingat posting WhatsApp
create table if not exists public.reminders (
    id uuid primary key default gen_random_uuid(),
    content_plan_id uuid not null references public.content_plans(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    remind_at timestamptz not null,
    channel text not null default 'whatsapp',
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
    attempts smallint not null default 0,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_reminders_status_remind_at on public.reminders (status, remind_at);

-- 8. REMINDER LOGS TABLE
-- Riwayat audit hasil dispatch API gateway WhatsApp
create table if not exists public.reminder_logs (
    id bigserial primary key,
    reminder_id uuid not null references public.reminders(id) on delete cascade,
    provider text not null default 'fonnte',
    request_summary text,
    response_code int,
    response_body text,
    created_at timestamptz not null default now()
);

create index if not exists idx_reminder_logs_reminder on public.reminder_logs (reminder_id);

-- Auto trigger update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger tr_profiles_updated_at
    before update on public.profiles
    for each row execute function public.handle_updated_at();

create trigger tr_content_plans_updated_at
    before update on public.content_plans
    for each row execute function public.handle_updated_at();
