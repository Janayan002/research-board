-- Tack: accounts and saved boards.
-- Paste this into the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Safe to run more than once.

-- Boards: one row per board, the whole board as JSON (pages, cards, research sessions).
create table if not exists public.boards (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  folder_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boards_user_idx on public.boards (user_id, updated_at desc);

-- Folders, for grouping boards on the home page.
create table if not exists public.folders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists folders_user_idx on public.folders (user_id);

-- Only the owner can see or change their rows.
alter table public.boards enable row level security;
alter table public.folders enable row level security;

drop policy if exists "boards: owner" on public.boards;
create policy "boards: owner" on public.boards
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "folders: owner" on public.folders;
create policy "folders: owner" on public.folders
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pictures the browser extension saves as files (Instagram etc.), so board JSON stays small.
-- Public bucket: the URLs are unguessable and the images were public on the web already.
insert into storage.buckets (id, name, public)
  values ('clips', 'clips', true)
  on conflict (id) do nothing;

drop policy if exists "clips: anyone can view" on storage.objects;
create policy "clips: anyone can view" on storage.objects
  for select using (bucket_id = 'clips');

drop policy if exists "clips: owner can upload" on storage.objects;
create policy "clips: owner can upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "clips: owner can delete" on storage.objects;
create policy "clips: owner can delete" on storage.objects
  for delete to authenticated using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);
