-- ========================================================================
-- CALENDEY — Row Level Security (RLS) Policies
-- Memastikan isolasi data antar user & keamanan akses data master
-- ========================================================================

-- 1. PROFILES RLS
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users can update their own profile"
    on public.profiles for update
    using (auth.uid() = id);

create policy "Users can insert their own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- 2. CATEGORIES RLS (Public read-only for authenticated, write admin only)
alter table public.categories enable row level security;

create policy "Categories are readable by authenticated users"
    on public.categories for select
    to authenticated, anon
    using (true);

-- 3. NATIONAL DAYS RLS (Public read-only for all, write admin only)
alter table public.national_days enable row level security;

create policy "National days are readable by all"
    on public.national_days for select
    to authenticated, anon
    using (true);

-- 4. CUSTOM EVENTS RLS (Private per user)
alter table public.custom_events enable row level security;

create policy "Users can read their own custom events"
    on public.custom_events for select
    using (auth.uid() = user_id);

create policy "Users can insert their own custom events"
    on public.custom_events for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own custom events"
    on public.custom_events for update
    using (auth.uid() = user_id);

create policy "Users can delete their own custom events"
    on public.custom_events for delete
    using (auth.uid() = user_id);

-- 5. CONTENT PLANS RLS (Private per user)
alter table public.content_plans enable row level security;

create policy "Users can read their own content plans"
    on public.content_plans for select
    using (auth.uid() = user_id);

create policy "Users can insert their own content plans"
    on public.content_plans for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own content plans"
    on public.content_plans for update
    using (auth.uid() = user_id);

create policy "Users can delete their own content plans"
    on public.content_plans for delete
    using (auth.uid() = user_id);

-- 6. CONTENT ASSETS RLS (Private per user)
alter table public.content_assets enable row level security;

create policy "Users can read their own content assets"
    on public.content_assets for select
    using (auth.uid() = user_id);

create policy "Users can insert their own content assets"
    on public.content_assets for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own content assets"
    on public.content_assets for update
    using (auth.uid() = user_id);

create policy "Users can delete their own content assets"
    on public.content_assets for delete
    using (auth.uid() = user_id);

-- 7. REMINDERS RLS (Private per user)
alter table public.reminders enable row level security;

create policy "Users can read their own reminders"
    on public.reminders for select
    using (auth.uid() = user_id);

create policy "Users can insert their own reminders"
    on public.reminders for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own reminders"
    on public.reminders for update
    using (auth.uid() = user_id);

create policy "Users can delete their own reminders"
    on public.reminders for delete
    using (auth.uid() = user_id);

-- 8. STORAGE BUCKET CONFIGURATION (for content-assets)
-- Menyiapkan bucket privat di Supabase Storage
insert into storage.buckets (id, name, public)
values ('content-assets', 'content-assets', false)
on conflict (id) do nothing;

create policy "Allow authenticated users to upload content assets"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'content-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Allow owners to view content assets"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'content-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Allow owners to delete content assets"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'content-assets' and auth.uid()::text = (storage.foldername(name))[1]);
