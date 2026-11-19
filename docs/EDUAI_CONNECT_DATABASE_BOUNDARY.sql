-- EDUAI Connect: database boundary for an independent teacher-only web integration.
-- No external app credential, no automatically approved user, no service-role distribution.
begin;

create table public.eduai_connect_teacher_authorizations (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  scopes text[] not null,
  constraint eduai_connect_teacher_scopes check (
    cardinality(scopes) between 1 and 6 and array_position(scopes,null) is null
    and scopes <@ array['exams:read','exams:content','plannings:read','plannings:content','documents:read','documents:content']::text[]
  ),
  constraint eduai_connect_teacher_expiry check (expires_at > approved_at and expires_at <= approved_at + interval '365 days')
);

create table public.eduai_connect_resource_authorizations (
  teacher_id uuid not null references public.eduai_connect_teacher_authorizations(teacher_id) on delete cascade,
  source_kind text not null check (source_kind in ('exam','planning','document')),
  source_id uuid not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  primary key (teacher_id,source_kind,source_id),
  constraint eduai_connect_resource_expiry check (expires_at > approved_at and expires_at <= approved_at + interval '365 days')
);
alter table public.eduai_connect_teacher_authorizations enable row level security;
alter table public.eduai_connect_resource_authorizations enable row level security;
revoke all on public.eduai_connect_teacher_authorizations,public.eduai_connect_resource_authorizations from public,anon,authenticated;
grant select on public.eduai_connect_teacher_authorizations,public.eduai_connect_resource_authorizations to authenticated;
grant select,insert,update,delete on public.eduai_connect_teacher_authorizations,public.eduai_connect_resource_authorizations to service_role;
create policy connect_teacher_reads_own_authorization on public.eduai_connect_teacher_authorizations
for select to authenticated using (teacher_id=(select auth.uid()));
create policy connect_teacher_reads_own_resource_authorization on public.eduai_connect_resource_authorizations
for select to authenticated using (teacher_id=(select auth.uid()));

-- Invoker functions: RLS on the source tables remains active. No service_role or
-- SECURITY DEFINER is needed by the external application. Ownership is also
-- explicitly checked because source tables have legacy public/shared policies.
create function public.eduai_connect_has_scope(p_scope text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1 from public.eduai_connect_teacher_authorizations a
      join public.eduai_user_access u on u.user_id=a.teacher_id
      where a.teacher_id=(select auth.uid())
        and a.revoked_at is null and a.expires_at>now()
        and p_scope=any(a.scopes)
        and u.account_type='teacher' and u.age_band='adult'
        and u.birth_date <= (current_date-interval '18 years')::date
        and u.access_tier in ('standard','teacher','admin')
    ),false)
$$;

create function public.eduai_connect_catalog(p_kind text,p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_scope text;
  v_rows jsonb;
begin
  v_scope := case p_kind when 'exam' then 'exams:read' when 'planning' then 'plannings:read' when 'document' then 'documents:read' else null end;
  if v_scope is null or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Parámetros inválidos' using errcode='22023';
  end if;
  if not public.eduai_connect_has_scope(v_scope) then
    raise exception 'Acceso docente no autorizado' using errcode='42501';
  end if;
  if p_kind='exam' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into v_rows
    from (select e.id,e.title,e.topic,e.status,e.created_at,e.updated_at
          from public.teacher_exams e where e.teacher_id=v_uid and e.deleted_at is null
          order by e.created_at desc,e.id offset p_offset limit p_limit) x;
  elsif p_kind='planning' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into v_rows
    from (select p.id,p.title,coalesce(p.curso,p.course) as course,coalesce(p.asignatura,p.subject) as subject,p.nivel,p.mes,p.created_at,p.updated_at
          from public.saved_plannings p where p.user_id=v_uid
          order by p.created_at desc,p.id offset p_offset limit p_limit) x;
  else
    -- Only explicitly approved educational assets, not the entire generic workspace.
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into v_rows
    from (select a.id,a.title,a.asset_type,a.mime_type,a.created_at,a.updated_at
          from public.eduai_assets a
          join public.eduai_connect_resource_authorizations r on r.teacher_id=v_uid and r.source_kind='document' and r.source_id=a.id
          where a.owner_id=v_uid and a.deleted_at is null and r.revoked_at is null and r.expires_at>now()
          order by a.created_at desc,a.id offset p_offset limit p_limit) x;
  end if;
  return jsonb_build_object('items',v_rows,'offset',p_offset,'limit',p_limit);
end
$$;

create function public.eduai_connect_read_text(p_kind text,p_id uuid,p_offset integer default 0,p_limit integer default 12000)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_scope text;
  v_title text;
  v_text text;
  v_found boolean := false;
begin
  v_scope:=case p_kind when 'exam' then 'exams:content' when 'planning' then 'plannings:content' when 'document' then 'documents:content' else null end;
  if v_scope is null or p_id is null or p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>12000 then
    raise exception 'Parámetros inválidos' using errcode='22023';
  end if;
  if not public.eduai_connect_has_scope(v_scope) then
    raise exception 'Acceso docente no autorizado' using errcode='42501';
  end if;
  if not exists (select 1 from public.eduai_connect_resource_authorizations r
    where r.teacher_id=v_uid and r.source_kind=p_kind and r.source_id=p_id and r.revoked_at is null and r.expires_at>now()) then
    raise exception 'Recurso no disponible' using errcode='42501';
  end if;
  if p_kind='exam' then
    -- Never transmit active exam answer keys to an external app in this version.
    select e.title,jsonb_build_object('instructions',e.instructions,'questions',e.questions)::text into v_title,v_text
    from public.teacher_exams e where e.id=p_id and e.teacher_id=v_uid and e.deleted_at is null and e.status='closed';
    v_found:=found;
  elsif p_kind='planning' then
    select p.title,coalesce(nullif(p.content,''),nullif(p.planning_text,''),p.planning_json::text) into v_title,v_text
    from public.saved_plannings p where p.id=p_id and p.user_id=v_uid;
    v_found:=found;
  else
    select a.title,a.text_content into v_title,v_text from public.eduai_assets a
    where a.id=p_id and a.owner_id=v_uid and a.deleted_at is null
      and (a.retention_until is null or a.retention_until>now());
    v_found:=found;
  end if;
  if not v_found then raise exception 'Recurso no disponible' using errcode='42501'; end if;
  if v_text is null then
    return jsonb_build_object('id',p_id,'title',v_title,'content_available',false);
  end if;
  if char_length(v_text)>1000000 then raise exception 'Documento excede el límite de lectura' using errcode='22023'; end if;
  return jsonb_build_object('id',p_id,'title',v_title,'content_available',true,
    'content',substring(v_text from p_offset+1 for p_limit),'offset',p_offset,'total_characters',char_length(v_text),
    'next_offset',case when p_offset+p_limit<char_length(v_text) then p_offset+p_limit else null end);
end
$$;

revoke all on function public.eduai_connect_has_scope(text),public.eduai_connect_catalog(text,integer,integer),public.eduai_connect_read_text(text,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.eduai_connect_has_scope(text),public.eduai_connect_catalog(text,integer,integer),public.eduai_connect_read_text(text,uuid,integer,integer) to authenticated;

-- Transactional smoke assertions: empty approvals; no anonymous access or client writes.
do $$
begin
  if exists(select 1 from public.eduai_connect_teacher_authorizations) then raise exception 'Unexpected initial approvals'; end if;
  if has_table_privilege('anon','public.eduai_connect_teacher_authorizations','SELECT')
    or has_table_privilege('authenticated','public.eduai_connect_teacher_authorizations','INSERT')
    or has_table_privilege('authenticated','public.eduai_connect_teacher_authorizations','UPDATE')
    or has_table_privilege('authenticated','public.eduai_connect_resource_authorizations','INSERT')
    or has_function_privilege('anon','public.eduai_connect_catalog(text,integer,integer)','EXECUTE')
    or has_function_privilege('anon','public.eduai_connect_read_text(text,uuid,integer,integer)','EXECUTE') then
    raise exception 'Unexpected Connect grant';
  end if;
end $$;
commit;
