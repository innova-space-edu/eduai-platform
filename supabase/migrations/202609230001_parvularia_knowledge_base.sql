-- Parvularia knowledge base and anti-repetition memory
create table if not exists public.parvularia_corpus_sources (
  id uuid primary key default gen_random_uuid(),
  corpus_key text not null default 'manual',
  source_hash text not null unique,
  file_name text not null,
  source_type text not null default 'document',
  category text,
  level text,
  topic text,
  raw_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parvularia_activity_bank (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.parvularia_corpus_sources(id) on delete cascade,
  activity_key text not null unique,
  level text,
  topic text,
  sequence_label text,
  day_label text,
  ambito_nucleo text,
  oa_text text,
  oat_text text,
  skill_text text,
  experience_text text not null,
  inicio text,
  desarrollo text,
  cierre text,
  evaluation text,
  resources text,
  tags text[] not null default '{}'::text[],
  quality_score numeric(5,2) not null default 0,
  search_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parvularia_generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course text,
  topic text,
  selected_oa_ids text[] not null default '{}'::text[],
  selected_oat_ids text[] not null default '{}'::text[],
  candidate_activity_ids uuid[] not null default '{}'::uuid[],
  generated_content text not null,
  activity_fingerprints text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists parvularia_corpus_sources_level_idx
  on public.parvularia_corpus_sources(level);
create index if not exists parvularia_corpus_sources_category_idx
  on public.parvularia_corpus_sources(category);
create index if not exists parvularia_activity_bank_level_idx
  on public.parvularia_activity_bank(level);
create index if not exists parvularia_activity_bank_topic_idx
  on public.parvularia_activity_bank(topic);
create index if not exists parvularia_activity_bank_source_idx
  on public.parvularia_activity_bank(source_id);
create index if not exists parvularia_activity_bank_search_idx
  on public.parvularia_activity_bank
  using gin (to_tsvector('spanish', coalesce(search_text, '')));
create index if not exists parvularia_generation_history_user_created_idx
  on public.parvularia_generation_history(user_id, created_at desc);

alter table public.parvularia_corpus_sources enable row level security;
alter table public.parvularia_activity_bank enable row level security;
alter table public.parvularia_generation_history enable row level security;

drop policy if exists "Authenticated users can read parvularia corpus" on public.parvularia_corpus_sources;
create policy "Authenticated users can read parvularia corpus"
  on public.parvularia_corpus_sources
  for select
  to authenticated
  using (active = true);

drop policy if exists "Authenticated users can read parvularia activities" on public.parvularia_activity_bank;
create policy "Authenticated users can read parvularia activities"
  on public.parvularia_activity_bank
  for select
  to authenticated
  using (active = true);

drop policy if exists "Users can read own parvularia generation history" on public.parvularia_generation_history;
create policy "Users can read own parvularia generation history"
  on public.parvularia_generation_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own parvularia generation history" on public.parvularia_generation_history;
create policy "Users can insert own parvularia generation history"
  on public.parvularia_generation_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own parvularia generation history" on public.parvularia_generation_history;
create policy "Users can delete own parvularia generation history"
  on public.parvularia_generation_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.parvularia_corpus_sources is
  'Source documents for the Parvularia pedagogical corpus. Imported by administrators.';
comment on table public.parvularia_activity_bank is
  'Structured activities extracted from planning documents and other Parvularia sources.';
comment on table public.parvularia_generation_history is
  'Per-user generation memory used to reduce repetition even when a planning was not saved.';
