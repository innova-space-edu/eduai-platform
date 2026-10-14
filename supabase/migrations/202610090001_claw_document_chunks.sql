-- Índices privados de los adjuntos no-PDF de Claw.
-- Los PDF reutilizan paper_documents y paper_chunks de Chat Paper.
create table if not exists public.claw_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null,
  chars integer not null default 0,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.claw_document_chunks (
  document_id uuid not null references public.claw_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  section_title text,
  content text not null,
  primary key (document_id,chunk_index)
);
create index if not exists claw_documents_user_idx on public.claw_documents(user_id,created_at desc);
create index if not exists claw_document_chunks_user_idx on public.claw_document_chunks(user_id,document_id);
alter table public.claw_documents enable row level security;
alter table public.claw_document_chunks enable row level security;

drop policy if exists claw_documents_owner on public.claw_documents;
create policy claw_documents_owner on public.claw_documents for all to authenticated
using (auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists claw_document_chunks_owner on public.claw_document_chunks;
create policy claw_document_chunks_owner on public.claw_document_chunks for all to authenticated
using (
  auth.uid()=user_id and exists(
    select 1 from public.claw_documents d
    where d.id=document_id and d.user_id=auth.uid()
  )
)
with check (
  auth.uid()=user_id and exists(
    select 1 from public.claw_documents d
    where d.id=document_id and d.user_id=auth.uid()
  )
);
