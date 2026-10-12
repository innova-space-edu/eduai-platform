-- Audit each confidential consolidated report download. No exported PII in the audit log.
create table if not exists public.eduai_admin_export_events (
  id bigint generated always as identity primary key,
  exported_by uuid not null references auth.users(id),
  file_format text not null check (file_format in ('xlsx','pdf')),
  dataset text not null default 'registro_documental_completo',
  counts jsonb not null,
  exported_at timestamptz not null default now()
);
create index if not exists eduai_admin_export_events_time_idx on public.eduai_admin_export_events(exported_at desc);
alter table public.eduai_admin_export_events enable row level security;
revoke all on public.eduai_admin_export_events from public, anon, authenticated;
grant select, insert on public.eduai_admin_export_events to service_role;
grant usage, select on sequence public.eduai_admin_export_events_id_seq to service_role;
comment on table public.eduai_admin_export_events is 'Audit of protected administrative report exports (no exported personal content stored in this log).';
