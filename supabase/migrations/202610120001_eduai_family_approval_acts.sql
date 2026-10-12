-- EDUAI: archivo interno de actas de aprobación familiar.
-- Las actas describen decisiones registradas; no son certificados de identidad.
-- Solo servicio interno puede leer. La secuencia se asigna bajo bloqueo transaccional.
create table if not exists public.eduai_family_approval_acts (
  request_id uuid primary key references public.family_authorization_requests(id),
  folio text not null unique check (folio ~ '^ACTA-[0-9]{4}-[0-9]{3,}$'),
  student_user_id uuid not null references auth.users(id),
  student_name text,
  guardian_name text not null,
  guardian_relationship text,
  institution_name text not null,
  reviewer_user_id uuid not null references auth.users(id),
  approved_at timestamptz not null,
  identity_verified_at timestamptz not null,
  legal_capacity_verified_at timestamptz not null,
  verified_method text not null,
  evidence_reference text,
  document_version text not null,
  signature_sha256 text not null,
  decisions jsonb not null,
  archived_at timestamptz not null default now()
);
create index if not exists eduai_family_acts_approved_idx on public.eduai_family_approval_acts(approved_at desc);
alter table public.eduai_family_approval_acts enable row level security;
revoke all on public.eduai_family_approval_acts from public,anon,authenticated;
grant select on public.eduai_family_approval_acts to service_role;

create or replace function public.eduai_capture_family_act(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v record;
  v_year text;
  v_number integer;
  v_folio text;
begin
  select * into v from public.family_authorization_requests r
   where r.id = p_request_id and r.platform = 'eduai'
     and r.status in ('approved','revoked')
     and r.reviewed_at is not null
     and r.verified_by is not null
     and r.identity_verified_at is not null and r.legal_capacity_verified_at is not null
     and r.signature_sha256 is not null and r.guardian_full_name is not null
     and r.decisions->>'platform_access' = 'true';
  if not found then return; end if;
  if exists (select 1 from public.eduai_family_approval_acts where request_id = p_request_id) then return; end if;
  v_year := to_char(v.reviewed_at at time zone 'America/Santiago', 'YYYY');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('eduai-family-actas'), v_year::integer);
  if exists (select 1 from public.eduai_family_approval_acts where request_id = p_request_id) then return; end if;
  -- Respect the first historical folio already assigned by the administrator.
  if v.verified_evidence_ref ~ ('^ACTA-' || v_year || '-[0-9]{3,}$')
    and not exists (select 1 from public.eduai_family_approval_acts where folio = v.verified_evidence_ref) then
    v_folio := v.verified_evidence_ref;
  else
    select coalesce(max(substring(folio from '[0-9]+$')::integer), 0) + 1 into v_number
    from public.eduai_family_approval_acts
    where folio like 'ACTA-' || v_year || '-%';
    v_folio := 'ACTA-' || v_year || '-' || lpad(v_number::text, 3, '0');
  end if;
  insert into public.eduai_family_approval_acts(
    request_id,folio,student_user_id,student_name,guardian_name,guardian_relationship,
    institution_name,reviewer_user_id,approved_at,identity_verified_at,
    legal_capacity_verified_at,verified_method,evidence_reference,
    document_version,signature_sha256,decisions
  ) values (
    v.id,v_folio,v.student_user_id,v.student_name_declared,v.guardian_full_name,v.guardian_relationship,
    v.institution_name,v.verified_by,v.reviewed_at,v.identity_verified_at,
    v.legal_capacity_verified_at,v.verified_method,v.verified_evidence_ref,
    v.document_version,v.signature_sha256,v.decisions
  ) on conflict (request_id) do nothing;
end;
$$;
revoke all on function public.eduai_capture_family_act(uuid) from public,anon,authenticated;
grant execute on function public.eduai_capture_family_act(uuid) to service_role;

create or replace function public.eduai_family_act_on_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.platform = 'eduai' and new.status = 'approved' then
    perform public.eduai_capture_family_act(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists eduai_family_act_approved on public.family_authorization_requests;
create trigger eduai_family_act_approved after update of status on public.family_authorization_requests
for each row when (new.status = 'approved') execute function public.eduai_family_act_on_approval();

-- Preserve existing approved acts, including ACTA-2026-001.
do $$
declare x record;
begin
  for x in select id from public.family_authorization_requests
    where platform='eduai' and status in ('approved','revoked')
    order by reviewed_at asc nulls last
  loop
    perform public.eduai_capture_family_act(x.id);
  end loop;
end;
$$;

comment on table public.eduai_family_approval_acts is
  'Archivo de actas administrativas de aprobación. No representa prueba independiente de identidad; evidencia referenciada se conserva fuera de esta tabla. Solo servicio privado.';
