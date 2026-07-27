-- Pizarra matemática aislada: cuadernos, páginas, reconocimiento y soluciones

create extension if not exists pgcrypto;

create table if not exists public.whiteboard_notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Cuaderno sin título' check (char_length(title) between 1 and 240),
  active_page_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whiteboard_notebooks_user_updated_idx
  on public.whiteboard_notebooks (user_id, updated_at desc);

create table if not exists public.whiteboard_pages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.whiteboard_notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Página',
  page_order integer not null default 0 check (page_order >= 0),
  strokes jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  active_block_id text,
  canvas_height integer not null default 1200 check (canvas_height between 400 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notebook_id, page_order)
);

create index if not exists whiteboard_pages_notebook_order_idx
  on public.whiteboard_pages (notebook_id, page_order);

create table if not exists public.whiteboard_recognition_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid references public.whiteboard_notebooks(id) on delete cascade,
  page_id uuid references public.whiteboard_pages(id) on delete cascade,
  block_id text,
  provider text not null default 'none',
  latex text,
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whiteboard_recognition_page_idx
  on public.whiteboard_recognition_runs (page_id, created_at desc);

create table if not exists public.whiteboard_solution_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid references public.whiteboard_notebooks(id) on delete cascade,
  page_id uuid references public.whiteboard_pages(id) on delete cascade,
  block_id text,
  mode text not null check (mode in ('solve', 'verify', 'hint', 'explain', 'graph')),
  input_latex text not null,
  result jsonb not null default '{}'::jsonb,
  engine text not null default 'ai-assisted',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists whiteboard_solution_page_idx
  on public.whiteboard_solution_runs (page_id, created_at desc);

create or replace function public.set_whiteboard_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists whiteboard_notebooks_set_updated_at on public.whiteboard_notebooks;
create trigger whiteboard_notebooks_set_updated_at
before update on public.whiteboard_notebooks
for each row execute function public.set_whiteboard_updated_at();

drop trigger if exists whiteboard_pages_set_updated_at on public.whiteboard_pages;
create trigger whiteboard_pages_set_updated_at
before update on public.whiteboard_pages
for each row execute function public.set_whiteboard_updated_at();

alter table public.whiteboard_notebooks enable row level security;
alter table public.whiteboard_pages enable row level security;
alter table public.whiteboard_recognition_runs enable row level security;
alter table public.whiteboard_solution_runs enable row level security;

create policy whiteboard_notebooks_select_own on public.whiteboard_notebooks
for select to authenticated using ((select auth.uid()) = user_id);
create policy whiteboard_notebooks_insert_own on public.whiteboard_notebooks
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy whiteboard_notebooks_update_own on public.whiteboard_notebooks
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy whiteboard_notebooks_delete_own on public.whiteboard_notebooks
for delete to authenticated using ((select auth.uid()) = user_id);

create policy whiteboard_pages_select_own on public.whiteboard_pages
for select to authenticated using ((select auth.uid()) = user_id);
create policy whiteboard_pages_insert_own on public.whiteboard_pages
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy whiteboard_pages_update_own on public.whiteboard_pages
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy whiteboard_pages_delete_own on public.whiteboard_pages
for delete to authenticated using ((select auth.uid()) = user_id);

create policy whiteboard_recognition_select_own on public.whiteboard_recognition_runs
for select to authenticated using ((select auth.uid()) = user_id);
create policy whiteboard_recognition_insert_own on public.whiteboard_recognition_runs
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy whiteboard_recognition_delete_own on public.whiteboard_recognition_runs
for delete to authenticated using ((select auth.uid()) = user_id);

create policy whiteboard_solution_select_own on public.whiteboard_solution_runs
for select to authenticated using ((select auth.uid()) = user_id);
create policy whiteboard_solution_insert_own on public.whiteboard_solution_runs
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy whiteboard_solution_delete_own on public.whiteboard_solution_runs
for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.whiteboard_notebooks to authenticated;
grant select, insert, update, delete on public.whiteboard_pages to authenticated;
grant select, insert, delete on public.whiteboard_recognition_runs to authenticated;
grant select, insert, delete on public.whiteboard_solution_runs to authenticated;
