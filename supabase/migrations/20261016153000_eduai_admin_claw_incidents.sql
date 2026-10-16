-- EDUAI Admin Claw / provider incident ledger V1.
-- No prompts, user data, API keys or generated images are retained in incidents.
begin;

create table if not exists public.eduai_admin_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (length(fingerprint) between 5 and 180),
  category text not null check (category in ('provider_quota','provider_auth','provider_timeout','provider_down','provider_error','storage','configuration','task','runtime')),
  severity text not null check (severity in ('low','medium','high','critical')),
  module text not null,
  provider text,
  title text not null,
  message text not null default '',
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  occurrences integer not null default 1 check (occurrences > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists eduai_admin_incidents_open_idx
  on public.eduai_admin_incidents (status, severity, last_seen_at desc);
alter table public.eduai_admin_incidents enable row level security;
revoke all on public.eduai_admin_incidents from anon, authenticated;
grant select, insert, update, delete on public.eduai_admin_incidents to service_role;

create table if not exists public.eduai_admin_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  module text not null,
  title text not null,
  detail text not null default '',
  priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
  status text not null default 'pending' check(status in ('pending','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists eduai_admin_tasks_pending_idx on public.eduai_admin_tasks (status, priority, created_at);
alter table public.eduai_admin_tasks enable row level security;
revoke all on public.eduai_admin_tasks from anon, authenticated;
grant select, insert, update, delete on public.eduai_admin_tasks to service_role;

-- SECURITY DEFINER is intentionally service-role only, not callable by users.
create or replace function public.eduai_record_admin_incident(
  p_fingerprint text, p_category text, p_severity text,
  p_module text, p_provider text, p_title text, p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if length(coalesce(p_fingerprint,'')) not between 5 and 180
    or p_fingerprint !~ '^[a-z0-9:_-]+$'
    or p_category not in ('provider_quota','provider_auth','provider_timeout','provider_down','provider_error','storage','configuration','task','runtime')
    or p_severity not in ('low','medium','high','critical')
    or length(coalesce(p_module,'')) > 80 or length(coalesce(p_title,'')) > 180
    or length(coalesce(p_message,'')) > 500 then
    raise exception 'invalid incident fields';
  end if;
  insert into public.eduai_admin_incidents (
    fingerprint, category, severity, module, provider, title, message, metadata
  ) values (
    p_fingerprint, p_category, p_severity, p_module, nullif(left(coalesce(p_provider,''),64),''),
    p_title, p_message, coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(fingerprint) do update
    set category = excluded.category, severity = excluded.severity, module=excluded.module,
        provider=excluded.provider, title=excluded.title, message=excluded.message,
        metadata=excluded.metadata,
        occurrences=case when eduai_admin_incidents.status='resolved' then 1 else eduai_admin_incidents.occurrences+1 end,
        first_seen_at=case when eduai_admin_incidents.status='resolved' then now() else eduai_admin_incidents.first_seen_at end,
        last_seen_at=now(), updated_at=now(),
        status='open', resolved_at=null,
        acknowledged_at=case when eduai_admin_incidents.status='resolved' then null else eduai_admin_incidents.acknowledged_at end
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.eduai_record_admin_incident(text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.eduai_record_admin_incident(text,text,text,text,text,text,text,jsonb) to service_role;

-- Existing, explicitly known project follow-ups. Never reset completed entries.
insert into public.eduai_admin_tasks(task_key,module,title,detail,priority)
values
('model-lab:bonsai-native','model-lab','Validar backend Bonsai nativo','Pendiente instalar y medir el motor PrismML en un computador compatible; el panel web es solo un planificador.', 'medium'),
('integrations:kaggle-mcp','integrations','Reanudar Kaggle MCP','La integración MCP está pausada hasta recuperar Innova Server Debian.', 'low'),
('image-studio:provider-benchmarks','image-studio','Medir proveedores de imágenes','Faltan benchmarks reales de texto, costo y latencia para ordenar proveedores por capacidad.', 'medium')
on conflict(task_key) do nothing;

commit;
