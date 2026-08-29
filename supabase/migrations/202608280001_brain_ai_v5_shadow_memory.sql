-- Brain AI v5 · Model Lab foundation
-- Stores privacy-safe Shadow Mode traces and prepares long-term memory namespaces.
-- Prompt/user content is intentionally NOT stored in brain_ai_shadow_traces.

create table if not exists public.brain_ai_shadow_traces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id text not null,
  modalities text[] not null default '{}',
  intent text not null,
  route text not null,
  complexity real not null default 0,
  confidence real not null default 0,
  production_stage text not null default 'EXPERIMENTAL',
  locality text not null default 'hybrid',
  latency_class text not null default 'interactive',
  plan_length integer not null default 0,
  gate_pass_rate real not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, trace_id)
);

create index if not exists brain_ai_shadow_traces_user_created_idx
  on public.brain_ai_shadow_traces(user_id, created_at desc);
create index if not exists brain_ai_shadow_traces_route_idx
  on public.brain_ai_shadow_traces(route, created_at desc);

alter table public.brain_ai_shadow_traces enable row level security;

drop policy if exists "brain ai users read own shadow traces" on public.brain_ai_shadow_traces;
create policy "brain ai users read own shadow traces"
  on public.brain_ai_shadow_traces for select
  using (auth.uid() = user_id);

drop policy if exists "brain ai users insert own shadow traces" on public.brain_ai_shadow_traces;
create policy "brain ai users insert own shadow traces"
  on public.brain_ai_shadow_traces for insert
  with check (auth.uid() = user_id);

drop policy if exists "brain ai users delete own shadow traces" on public.brain_ai_shadow_traces;
create policy "brain ai users delete own shadow traces"
  on public.brain_ai_shadow_traces for delete
  using (auth.uid() = user_id);

create table if not exists public.brain_ai_memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('episodic','semantic','canonical','procedural','reflection','curriculum','device')),
  namespace text not null default 'default',
  content text not null,
  summary text,
  source text,
  importance real not null default 0.5 check (importance >= 0 and importance <= 1),
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  access_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  is_canonical boolean not null default false,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(summary, '') || ' ' || coalesce(content, ''))
  ) stored
);

create index if not exists brain_ai_memory_user_kind_idx
  on public.brain_ai_memory_entries(user_id, kind, updated_at desc);
create index if not exists brain_ai_memory_namespace_idx
  on public.brain_ai_memory_entries(user_id, namespace, updated_at desc);
create index if not exists brain_ai_memory_search_idx
  on public.brain_ai_memory_entries using gin(search_tsv);
create index if not exists brain_ai_memory_canonical_idx
  on public.brain_ai_memory_entries(user_id, is_canonical)
  where is_canonical = true;

alter table public.brain_ai_memory_entries enable row level security;

drop policy if exists "brain ai users read own memory" on public.brain_ai_memory_entries;
create policy "brain ai users read own memory"
  on public.brain_ai_memory_entries for select
  using (auth.uid() = user_id);

drop policy if exists "brain ai users insert own memory" on public.brain_ai_memory_entries;
create policy "brain ai users insert own memory"
  on public.brain_ai_memory_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "brain ai users update own memory" on public.brain_ai_memory_entries;
create policy "brain ai users update own memory"
  on public.brain_ai_memory_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "brain ai users delete own memory" on public.brain_ai_memory_entries;
create policy "brain ai users delete own memory"
  on public.brain_ai_memory_entries for delete
  using (auth.uid() = user_id);

comment on table public.brain_ai_shadow_traces is 'Privacy-safe Brain AI Shadow Mode telemetry. Never stores the full prompt.';
comment on table public.brain_ai_memory_entries is 'Brain AI long-term memory foundation. Writes remain gated by the Memory Controller and Production Gate.';
