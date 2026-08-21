create table if not exists public.eduai_google_file_search_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  store_name text not null unique,
  display_name text not null,
  embedding_model text not null default 'models/gemini-embedding-2',
  status text not null default 'active' check (status in ('active','error','deleting')),
  last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, notebook_id)
);

create table if not exists public.eduai_google_file_search_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  source_id uuid not null references public.notebook_sources(id) on delete cascade,
  store_id uuid not null references public.eduai_google_file_search_stores(id) on delete cascade,
  content_hash text not null,
  document_name text null,
  operation_name text null,
  display_name text not null,
  status text not null default 'indexing' check (status in ('queued','indexing','ready','failed','deleting')),
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  indexed_at timestamptz null,
  unique(owner_id, source_id)
);

create index if not exists eduai_google_file_search_stores_owner_notebook_idx
  on public.eduai_google_file_search_stores(owner_id, notebook_id);
create index if not exists eduai_google_file_search_documents_owner_notebook_status_idx
  on public.eduai_google_file_search_documents(owner_id, notebook_id, status, updated_at desc);
create index if not exists eduai_google_file_search_documents_hash_idx
  on public.eduai_google_file_search_documents(owner_id, content_hash);

alter table public.eduai_google_file_search_stores enable row level security;
alter table public.eduai_google_file_search_documents enable row level security;

revoke all on table public.eduai_google_file_search_stores from anon, authenticated;
revoke all on table public.eduai_google_file_search_documents from anon, authenticated;
grant select on table public.eduai_google_file_search_stores to authenticated;
grant select on table public.eduai_google_file_search_documents to authenticated;

create policy eduai_google_file_search_stores_select_own
  on public.eduai_google_file_search_stores
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy eduai_google_file_search_documents_select_own
  on public.eduai_google_file_search_documents
  for select to authenticated
  using (owner_id = (select auth.uid()));

comment on table public.eduai_google_file_search_stores is
  'Índices Google File Search opcionales por Notebook. Escrituras solo server/service-role; no reemplazan el RAG propio de EduAI.';
comment on table public.eduai_google_file_search_documents is
  'Estado de sincronización SHA-256 de fuentes de Notebook hacia Google File Search. Escrituras solo server/service-role.';
