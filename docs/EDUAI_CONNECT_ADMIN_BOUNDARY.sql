begin;
create schema eduai_connect_private;
revoke all on schema eduai_connect_private from public,anon,authenticated,service_role;
grant usage on schema eduai_connect_private to authenticated;

create table public.eduai_connect_requests (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('access','exam','planning','document')),
 source_id uuid,
 scopes text[] not null default '{}',
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id) on delete set null,
 check ((kind='access' and source_id is null and cardinality(scopes) between 1 and 6
   and array_position(scopes,null) is null and scopes <@ array['exams:read','exams:content','plannings:read','plannings:content','documents:read','documents:content']::text[])
   or (kind<>'access' and source_id is not null and cardinality(scopes)=0))
);
create unique index eduai_connect_one_pending_access on public.eduai_connect_requests(teacher_id) where status='pending' and kind='access';
create unique index eduai_connect_one_pending_resource on public.eduai_connect_requests(teacher_id,kind,source_id) where status='pending' and kind<>'access';
create index eduai_connect_requests_owner_idx on public.eduai_connect_requests(teacher_id,created_at desc);
create table eduai_connect_private.audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 teacher_id uuid not null,
 action text not null,
 request_id uuid,
 source_kind text,
 source_id uuid,
 created_at timestamptz not null default now()
);
alter table public.eduai_connect_requests enable row level security;
alter table eduai_connect_private.audit enable row level security;
revoke all on public.eduai_connect_requests from public,anon,authenticated,service_role;
revoke all on eduai_connect_private.audit from public,anon,authenticated,service_role;
grant select on public.eduai_connect_requests to authenticated;
create policy connect_request_read_own on public.eduai_connect_requests for select to authenticated using(teacher_id=(select auth.uid()));

-- Private narrow helpers. Check live session and account rather than trusting editable metadata.
create function eduai_connect_private.session_ok(p_admin boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
    and u.email_confirmed_at is not null and u.deleted_at is null
    and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<=now())
    and (s.not_after is null or s.not_after>now())
    and (not p_admin or ((select auth.jwt()->>'aal')='aal2' and s.aal::text='aal2'
      and exists(select 1 from public.admin_emails a where a.email=u.email)))
 )
$$;
create function eduai_connect_private.eligible(p_teacher uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.eduai_user_access a join auth.users u on u.id=a.user_id
 where a.user_id=p_teacher and a.account_type='teacher' and a.age_band='adult'
 and a.birth_date <= (current_date-interval '18 years')::date
 and a.access_tier in ('standard','teacher','admin') and u.email_confirmed_at is not null
 and u.deleted_at is null and not coalesce(u.is_anonymous,false)
 and (u.banned_until is null or u.banned_until<=now()))
$$;
create function eduai_connect_private.owns_resource(p_teacher uuid,p_kind text,p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'exam' then exists(select 1 from public.teacher_exams e where e.id=p_id and e.teacher_id=p_teacher and e.deleted_at is null and e.status='closed')
 when 'planning' then exists(select 1 from public.saved_plannings p where p.id=p_id and p.user_id=p_teacher)
 when 'document' then exists(select 1 from public.eduai_assets a where a.id=p_id and a.owner_id=p_teacher and a.deleted_at is null and (a.retention_until is null or a.retention_until>now()))
 else false end
$$;
create function eduai_connect_private.lock_teacher(p_teacher uuid)
returns void language sql volatile security invoker set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_teacher::text,716230))
$$;
create function eduai_connect_private.request_access(p_scopes text[],p_kind text,p_source_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_scope text;
begin
 if not eduai_connect_private.session_ok(false) or not eduai_connect_private.eligible(v_uid) then raise exception 'Cuenta docente no habilitada' using errcode='42501';end if;
 perform eduai_connect_private.lock_teacher(v_uid);
 if p_kind='access' then
   if p_source_id is not null or p_scopes is null or cardinality(p_scopes) not between 1 and 6 or array_position(p_scopes,null) is not null
     or not(p_scopes <@ array['exams:read','exams:content','plannings:read','plannings:content','documents:read','documents:content']::text[]) then raise exception 'Solicitud inválida' using errcode='22023';end if;
 elsif p_kind in ('exam','planning','document') then
   v_scope:=case p_kind when 'exam' then 'exams:content' when 'planning' then 'plannings:content' else 'documents:content' end;
   if p_source_id is null or coalesce(cardinality(p_scopes),0)<>0 or not eduai_connect_private.owns_resource(v_uid,p_kind,p_source_id) then raise exception 'Recurso no disponible' using errcode='42501';end if;
   if not exists(select 1 from public.eduai_connect_teacher_authorizations a where a.teacher_id=v_uid and a.revoked_at is null and a.expires_at>now() and v_scope=any(a.scopes)) then raise exception 'Permiso de categoría requerido' using errcode='42501';end if;
 else raise exception 'Solicitud inválida' using errcode='22023';end if;
 if (select count(*) from public.eduai_connect_requests r where r.teacher_id=v_uid and r.status='pending')>=50 then raise exception 'Límite de solicitudes pendientes' using errcode='22023';end if;
 insert into public.eduai_connect_requests(teacher_id,kind,source_id,scopes) values(v_uid,p_kind,p_source_id,coalesce(p_scopes,'{}')) returning id into v_id;
 insert into eduai_connect_private.audit(actor_id,teacher_id,action,request_id,source_kind,source_id) values(v_uid,v_uid,'request',v_id,p_kind,p_source_id);
 return v_id;
end $$;

create function eduai_connect_private.admin_action(p_action text,p_request_id uuid,p_teacher_id uuid,p_days integer,p_scopes text[],p_kind text,p_source_id uuid,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=auth.uid();v_req public.eduai_connect_requests%rowtype;v_teacher uuid;v_until timestamptz;v_rows jsonb;v_scope text;
begin
 if not eduai_connect_private.session_ok(true) then raise exception 'Administrador con MFA requerido' using errcode='42501';end if;
 if p_action='list' then
   if p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Paginación inválida' using errcode='22023';end if;
   select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into v_rows from (
      select r.id,r.teacher_id,u.email,r.kind,r.source_id,r.scopes,r.status,r.created_at,
       a.expires_at as access_expires_at,a.revoked_at as access_revoked_at
      from public.eduai_connect_requests r join auth.users u on u.id=r.teacher_id
      left join public.eduai_connect_teacher_authorizations a on a.teacher_id=r.teacher_id
      order by r.created_at desc,r.id offset p_offset limit p_limit) x;
   return jsonb_build_object('items',v_rows,'offset',p_offset,'limit',p_limit);
 elsif p_action in ('approve','reject') then
   select teacher_id into v_teacher from public.eduai_connect_requests where id=p_request_id;
   if not found then raise exception 'Solicitud no disponible' using errcode='22023';end if;
   perform eduai_connect_private.lock_teacher(v_teacher);
   select * into v_req from public.eduai_connect_requests where id=p_request_id and status='pending' for update;
   if not found then raise exception 'Solicitud no disponible' using errcode='22023';end if;
   if p_action='approve' then
     if not eduai_connect_private.eligible(v_teacher) then raise exception 'Cuenta docente no habilitada' using errcode='42501';end if;
     if p_days is null or p_days not between 1 and 365 then raise exception 'Vigencia inválida' using errcode='22023';end if;
     v_until:=now()+make_interval(days=>p_days);
     if v_req.kind='access' then
       if p_scopes is null or cardinality(p_scopes) not between 1 and 6 or array_position(p_scopes,null) is not null or not(p_scopes <@ v_req.scopes) then raise exception 'Permisos fuera de solicitud' using errcode='22023';end if;
       -- New approval never resurrects old individual resource grants.
       update public.eduai_connect_resource_authorizations set revoked_at=now() where teacher_id=v_teacher and revoked_at is null;
       update public.eduai_connect_requests set status='cancelled',decided_at=now(),decided_by=v_admin where teacher_id=v_teacher and kind<>'access' and status='pending';
       insert into public.eduai_connect_teacher_authorizations(teacher_id,approved_by,approved_at,expires_at,revoked_at,scopes)
       values(v_teacher,v_admin,now(),v_until,null,p_scopes)
       on conflict(teacher_id) do update set approved_by=excluded.approved_by,approved_at=excluded.approved_at,expires_at=excluded.expires_at,revoked_at=null,scopes=excluded.scopes;
     else
       v_scope:=case v_req.kind when 'exam' then 'exams:content' when 'planning' then 'plannings:content' else 'documents:content' end;
       if not eduai_connect_private.owns_resource(v_teacher,v_req.kind,v_req.source_id) then raise exception 'Recurso no disponible' using errcode='42501';end if;
       select least(v_until,a.expires_at) into v_until from public.eduai_connect_teacher_authorizations a where a.teacher_id=v_teacher and a.revoked_at is null and a.expires_at>now() and v_scope=any(a.scopes);
       if not found then raise exception 'Permiso de categoría requerido' using errcode='42501';end if;
       insert into public.eduai_connect_resource_authorizations(teacher_id,source_kind,source_id,approved_by,approved_at,expires_at,revoked_at)
       values(v_teacher,v_req.kind,v_req.source_id,v_admin,now(),v_until,null)
       on conflict(teacher_id,source_kind,source_id) do update set approved_by=excluded.approved_by,approved_at=excluded.approved_at,expires_at=excluded.expires_at,revoked_at=null;
     end if;
   end if;
   update public.eduai_connect_requests set status=case when p_action='approve' then 'approved' else 'rejected' end,decided_at=now(),decided_by=v_admin where id=p_request_id;
   insert into eduai_connect_private.audit(actor_id,teacher_id,action,request_id,source_kind,source_id) values(v_admin,v_teacher,p_action,p_request_id,v_req.kind,v_req.source_id);
   return jsonb_build_object('ok',true,'request_id',p_request_id);
 elsif p_action in ('revoke','revoke_resource') then
   if p_teacher_id is null then raise exception 'Docente requerido' using errcode='22023';end if;
   perform eduai_connect_private.lock_teacher(p_teacher_id);
   if p_action='revoke' then
     update public.eduai_connect_teacher_authorizations set revoked_at=now() where teacher_id=p_teacher_id and revoked_at is null;
     if not found then raise exception 'Autorización no disponible' using errcode='22023';end if;
     update public.eduai_connect_resource_authorizations set revoked_at=now() where teacher_id=p_teacher_id and revoked_at is null;
     update public.eduai_connect_requests set status='cancelled',decided_at=now(),decided_by=v_admin where teacher_id=p_teacher_id and status='pending';
   else
     if p_kind not in ('exam','planning','document') or p_source_id is null then raise exception 'Recurso inválido' using errcode='22023';end if;
     update public.eduai_connect_resource_authorizations set revoked_at=now() where teacher_id=p_teacher_id and source_kind=p_kind and source_id=p_source_id and revoked_at is null;
     if not found then raise exception 'Autorización no disponible' using errcode='22023';end if;
     update public.eduai_connect_requests set status='cancelled',decided_at=now(),decided_by=v_admin where teacher_id=p_teacher_id and kind=p_kind and source_id=p_source_id and status='pending';
   end if;
   insert into eduai_connect_private.audit(actor_id,teacher_id,action,source_kind,source_id) values(v_admin,p_teacher_id,p_action,case when p_action='revoke_resource' then p_kind else null end,case when p_action='revoke_resource' then p_source_id else null end);
   return jsonb_build_object('ok',true);
 else raise exception 'Operación inválida' using errcode='22023';end if;
end $$;

-- Public functions are invokers; private implementations explicitly validate identity/role.
create function public.eduai_connect_request(p_scopes text[] default '{}',p_kind text default 'access',p_source_id uuid default null)
returns uuid language sql volatile security invoker set search_path='' as $$
 select eduai_connect_private.request_access(p_scopes,p_kind,p_source_id)
$$;
create function public.eduai_connect_admin(p_action text,p_request_id uuid default null,p_teacher_id uuid default null,p_days integer default 90,p_scopes text[] default '{}',p_kind text default null,p_source_id uuid default null,p_offset integer default 0,p_limit integer default 25)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select eduai_connect_private.admin_action(p_action,p_request_id,p_teacher_id,p_days,p_scopes,p_kind,p_source_id,p_offset,p_limit)
$$;

create or replace function public.eduai_connect_has_scope(p_scope text)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(eduai_connect_private.session_ok(false) and exists (
   select 1 from public.eduai_connect_teacher_authorizations a join public.eduai_user_access u on u.user_id=a.teacher_id
   where a.teacher_id=(select auth.uid()) and a.revoked_at is null and a.expires_at>now() and p_scope=any(a.scopes)
     and u.account_type='teacher' and u.age_band='adult' and u.birth_date <= (current_date-interval '18 years')::date
     and u.access_tier in ('standard','teacher','admin')
 ),false)
$$;

revoke all on all functions in schema eduai_connect_private from public,anon,authenticated,service_role;
grant execute on function eduai_connect_private.session_ok(boolean),eduai_connect_private.request_access(text[],text,uuid),eduai_connect_private.admin_action(text,uuid,uuid,integer,text[],text,uuid,integer,integer) to authenticated;
revoke all on function public.eduai_connect_request(text[],text,uuid),public.eduai_connect_admin(text,uuid,uuid,integer,text[],text,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.eduai_connect_request(text[],text,uuid),public.eduai_connect_admin(text,uuid,uuid,integer,text[],text,uuid,integer,integer) to authenticated;

-- No credentials or grants are seeded. Admin decisions only through checked functions.
do $$
begin
 if has_table_privilege('authenticated','public.eduai_connect_requests','INSERT')
 or has_table_privilege('authenticated','public.eduai_connect_requests','UPDATE')
 or has_table_privilege('authenticated','eduai_connect_private.audit','SELECT')
 or has_function_privilege('anon','public.eduai_connect_admin(text,uuid,uuid,integer,text[],text,uuid,integer,integer)','EXECUTE')
 or has_function_privilege('authenticated','eduai_connect_private.eligible(uuid)','EXECUTE')
 then raise exception 'Unexpected Connect administration grants';end if;
end $$;
commit;
