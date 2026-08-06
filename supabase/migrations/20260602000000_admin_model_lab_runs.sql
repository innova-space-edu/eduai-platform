-- Auditoría de ejecuciones del laboratorio experimental de imágenes.
create table if not exists public.admin_model_lab_runs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  model_id text not null,
  provider_model_id text,
  prompt text not null,
  status text not null check (status in ('completed', 'failed', 'blocked')),
  safety_flags jsonb not null default '[]'::jsonb,
  duration_ms integer,
  request_id text,
  image_url text,
  seed bigint,
  output_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.admin_model_lab_runs enable row level security;

create index if not exists admin_model_lab_runs_created_at_idx
  on public.admin_model_lab_runs (created_at desc);

create index if not exists admin_model_lab_runs_model_id_idx
  on public.admin_model_lab_runs (model_id, created_at desc);

-- Las inserciones se realizan exclusivamente desde el backend con service_role.
-- No se crean policies públicas para evitar lectura o escritura desde el navegador.
comment on table public.admin_model_lab_runs is
  'Audit log privado para ejecuciones del laboratorio experimental de imágenes del administrador.';
