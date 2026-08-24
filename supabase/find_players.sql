-- Find Players feature — run this once in the Supabase SQL Editor
-- (Dashboard > SQL Editor > New query > paste > Run)

create extension if not exists pgcrypto;

-- ── Posts ────────────────────────────────────────────────────────────────
create table if not exists find_players_posts (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references auth.users(id) on delete cascade,
  creator_name   text not null,
  creator_phone  text,
  post_type      text not null check (post_type in ('player','team')),
  sport          text not null,
  title          text not null,
  description    text,
  turf_name      text,
  match_date     date,
  match_time     text,
  players_needed int,
  payment_type   text not null default 'discuss' check (payment_type in ('split_50_50','loser_pays','discuss')),
  status         text not null default 'open' check (status in ('open','closed')),
  created_at     timestamptz not null default now()
);

create index if not exists idx_find_players_posts_status on find_players_posts (status, created_at desc);
create index if not exists idx_find_players_posts_creator on find_players_posts (creator_id);

alter table find_players_posts enable row level security;

drop policy if exists "find_players_posts_select" on find_players_posts;
create policy "find_players_posts_select" on find_players_posts
  for select using (true);

drop policy if exists "find_players_posts_insert" on find_players_posts;
create policy "find_players_posts_insert" on find_players_posts
  for insert with check (auth.uid() = creator_id);

drop policy if exists "find_players_posts_update" on find_players_posts;
create policy "find_players_posts_update" on find_players_posts
  for update using (auth.uid() = creator_id);

drop policy if exists "find_players_posts_delete" on find_players_posts;
create policy "find_players_posts_delete" on find_players_posts
  for delete using (auth.uid() = creator_id);

-- ── Interests (contact / "I'm interested" requests) ────────────────────────
create table if not exists find_players_interests (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references find_players_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  user_name  text not null,
  user_phone text,
  message    text,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists idx_find_players_interests_post on find_players_interests (post_id);

alter table find_players_interests enable row level security;

drop policy if exists "find_players_interests_select" on find_players_interests;
create policy "find_players_interests_select" on find_players_interests
  for select using (
    auth.uid() = user_id
    or auth.uid() in (select creator_id from find_players_posts where id = post_id)
  );

drop policy if exists "find_players_interests_insert" on find_players_interests;
create policy "find_players_interests_insert" on find_players_interests
  for insert with check (auth.uid() = user_id);

drop policy if exists "find_players_interests_update" on find_players_interests;
create policy "find_players_interests_update" on find_players_interests
  for update using (auth.uid() = user_id);

drop policy if exists "find_players_interests_delete" on find_players_interests;
create policy "find_players_interests_delete" on find_players_interests
  for delete using (auth.uid() = user_id);
