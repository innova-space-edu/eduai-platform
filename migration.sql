-- ═══════════════════════════════════════════════════════════════════
-- EduAI Platform — Notebook Hub Migration
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Habilitar extensión vector (pgvector)
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLAS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notebooks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  title          text not null default 'Nuevo cuaderno',
  specialist_role text not null default 'Especialista general',
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.notebook_sources (
  id             uuid primary key default gen_random_uuid(),
  notebook_id    uuid not null references public.notebooks(id) on delete cascade,
  type           text not null check (type in ('url','pdf','docx','txt','text','search_result')),
  title          text,
  url            text,
  file_path      text,
  raw_text       text,
  extracted_text text,
  metadata       jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  status         text not null default 'pending'
                   check (status in ('pending','processing','ready','error')),
  error_message  text,
  created_at     timestamptz not null default now()
);

create table if not exists public.notebook_chunks (
  id             uuid primary key default gen_random_uuid(),
  notebook_id    uuid not null references public.notebooks(id) on delete cascade,
  source_id      uuid not null references public.notebook_sources(id) on delete cascade,
  chunk_index    integer not null,
  chunk_text     text not null,
  token_count    integer,
  embedding      vector(768),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.notebook_summaries (
  id               uuid primary key default gen_random_uuid(),
  notebook_id      uuid not null unique references public.notebooks(id) on delete cascade,
  summary_markdown text,
  key_points       jsonb not null default '[]'::jsonb,
  glossary_json    jsonb not null default '[]'::jsonb,
  topics           jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);

create table if not exists public.notebook_messages (
  id             uuid primary key default gen_random_uuid(),
  notebook_id    uuid not null references public.notebooks(id) on delete cascade,
  role           text not null check (role in ('user','assistant','system')),
  content        text not null,
  citations_json jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.notebook_outputs (
  id           uuid primary key default gen_random_uuid(),
  notebook_id  uuid not null references public.notebooks(id) on delete cascade,
  format       text not null check (
    format in ('infographic','mindmap','presentation','quiz','flashcards','timeline','podcast','cornell','glossary','story','lessonplan')
  ),
  title        text,
  output_json  jsonb not null default '{}'::jsonb,
  version      integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_notebooks_user_id
  on public.notebooks(user_id);

create index if not exists idx_notebook_sources_notebook_id
  on public.notebook_sources(notebook_id);

create index if not exists idx_notebook_chunks_notebook_id
  on public.notebook_chunks(notebook_id);

create index if not exists idx_notebook_chunks_source_id
  on public.notebook_chunks(source_id);

create index if not exists idx_notebook_messages_notebook_id
  on public.notebook_messages(notebook_id);

create index if not exists idx_notebook_messages_created_at
  on public.notebook_messages(created_at);

create index if not exists idx_notebook_outputs_notebook_id
  on public.notebook_outputs(notebook_id);

-- Índice vectorial para similitud coseno (solo si pgvector está habilitado)
create index if not exists idx_notebook_chunks_embedding
  on public.notebook_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notebooks          enable row level security;
alter table public.notebook_sources   enable row level security;
alter table public.notebook_chunks    enable row level security;
alter table public.notebook_summaries enable row level security;
alter table public.notebook_messages  enable row level security;
alter table public.notebook_outputs   enable row level security;

-- notebooks
create policy "notebooks_select" on public.notebooks for select using (auth.uid() = user_id);
create policy "notebooks_insert" on public.notebooks for insert with check (auth.uid() = user_id);
create policy "notebooks_update" on public.notebooks for update using (auth.uid() = user_id);
create policy "notebooks_delete" on public.notebooks for delete using (auth.uid() = user_id);

-- notebook_sources (acceso via notebook)
create policy "nb_sources_select" on public.notebook_sources for select
  using (exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = auth.uid()));
create policy "nb_sources_insert" on public.notebook_sources for insert
  with check (exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = auth.uid()));
create policy "nb_sources_update" on public.notebook_sources for update
  using (exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = auth.uid()));
create policy "nb_sources_delete" on public.notebook_sources for delete
  using (exists (select 1 from public.notebooks n where n.id = notebook_sources.notebook_id and n.user_id = auth.uid()));

-- notebook_chunks
create policy "nb_chunks_select" on public.notebook_chunks for select
  using (exists (select 1 from public.notebooks n where n.id = notebook_chunks.notebook_id and n.user_id = auth.uid()));
create policy "nb_chunks_insert" on public.notebook_chunks for insert
  with check (exists (select 1 from public.notebooks n where n.id = notebook_chunks.notebook_id and n.user_id = auth.uid()));
create policy "nb_chunks_delete" on public.notebook_chunks for delete
  using (exists (select 1 from public.notebooks n where n.id = notebook_chunks.notebook_id and n.user_id = auth.uid()));

-- notebook_summaries
create policy "nb_summaries_select" on public.notebook_summaries for select
  using (exists (select 1 from public.notebooks n where n.id = notebook_summaries.notebook_id and n.user_id = auth.uid()));
create policy "nb_summaries_insert" on public.notebook_summaries for insert
  with check (exists (select 1 from public.notebooks n where n.id = notebook_summaries.notebook_id and n.user_id = auth.uid()));
create policy "nb_summaries_update" on public.notebook_summaries for update
  using (exists (select 1 from public.notebooks n where n.id = notebook_summaries.notebook_id and n.user_id = auth.uid()));

-- notebook_messages
create policy "nb_messages_select" on public.notebook_messages for select
  using (exists (select 1 from public.notebooks n where n.id = notebook_messages.notebook_id and n.user_id = auth.uid()));
create policy "nb_messages_insert" on public.notebook_messages for insert
  with check (exists (select 1 from public.notebooks n where n.id = notebook_messages.notebook_id and n.user_id = auth.uid()));

-- notebook_outputs
create policy "nb_outputs_select" on public.notebook_outputs for select
  using (exists (select 1 from public.notebooks n where n.id = notebook_outputs.notebook_id and n.user_id = auth.uid()));
create policy "nb_outputs_insert" on public.notebook_outputs for insert
  with check (exists (select 1 from public.notebooks n where n.id = notebook_outputs.notebook_id and n.user_id = auth.uid()));
create policy "nb_outputs_update" on public.notebook_outputs for update
  using (exists (select 1 from public.notebooks n where n.id = notebook_outputs.notebook_id and n.user_id = auth.uid()));
create policy "nb_outputs_delete" on public.notebook_outputs for delete
  using (exists (select 1 from public.notebooks n where n.id = notebook_outputs.notebook_id and n.user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: Búsqueda vectorial de chunks
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function match_notebook_chunks(
  p_notebook_id uuid,
  p_embedding   vector(768),
  p_limit       int default 6,
  p_active_only boolean default true
)
returns table (
  id         uuid,
  source_id  uuid,
  chunk_text text,
  score      float
)
language sql stable
as $$
  select
    c.id,
    c.source_id,
    c.chunk_text,
    1 - (c.embedding <=> p_embedding) as score
  from public.notebook_chunks c
  join public.notebook_sources s on s.id = c.source_id
  where c.notebook_id = p_notebook_id
    and (not p_active_only or s.is_active = true)
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit p_limit;
$$;
