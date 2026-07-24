-- Analítica integral de EDUAI por módulo y agente.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.eduai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  module_key text not null,
  module_name text not null,
  module_category text not null default 'General',
  agent_key text,
  agent_name text,

  event_type text not null default 'page_view'
    check (event_type in (
      'page_view',
      'action',
      'generation',
      'export',
      'upload',
      'download',
      'error'
    )),

  path text,
  success boolean not null default true,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(14, 6) check (estimated_cost is null or estimated_cost >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.eduai_usage_events is
  'Eventos de uso de EDUAI para reportes administrativos por módulo y agente.';
comment on column public.eduai_usage_events.module_key is
  'Identificador estable del módulo, por ejemplo planner, exams o image-studio.';
comment on column public.eduai_usage_events.agent_key is
  'Identificador estable del agente cuando el módulo utiliza uno.';
comment on column public.eduai_usage_events.estimated_cost is
  'Costo estimado en USD cuando el proveedor entrega información de consumo.';

create index if not exists eduai_usage_events_created_at_idx
  on public.eduai_usage_events (created_at desc);

create index if not exists eduai_usage_events_user_created_idx
  on public.eduai_usage_events (user_id, created_at desc);

create index if not exists eduai_usage_events_module_created_idx
  on public.eduai_usage_events (module_key, created_at desc);

create index if not exists eduai_usage_events_agent_created_idx
  on public.eduai_usage_events (agent_key, created_at desc)
  where agent_key is not null;

create index if not exists eduai_usage_events_type_created_idx
  on public.eduai_usage_events (event_type, created_at desc);

create index if not exists eduai_usage_events_failed_idx
  on public.eduai_usage_events (created_at desc)
  where success = false or event_type = 'error';

alter table public.eduai_usage_events enable row level security;

-- El usuario autenticado solo puede registrar eventos para su propia cuenta.
drop policy if exists "usage_events_insert_own" on public.eduai_usage_events;
create policy "usage_events_insert_own"
  on public.eduai_usage_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- El usuario puede consultar únicamente su propio historial.
-- El dashboard administrativo usa SUPABASE_SERVICE_ROLE_KEY en el servidor.
drop policy if exists "usage_events_select_own" on public.eduai_usage_events;
create policy "usage_events_select_own"
  on public.eduai_usage_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No se permite modificar ni eliminar eventos desde el cliente.
revoke update, delete on table public.eduai_usage_events from anon, authenticated;
grant select, insert on table public.eduai_usage_events to authenticated;
revoke all on table public.eduai_usage_events from anon;

-- Asegura que PostgREST reconozca los permisos después de crear la tabla.
notify pgrst, 'reload schema';
