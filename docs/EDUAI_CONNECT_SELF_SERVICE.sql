begin;
-- Teacher-facing self-service discovery. No contents or foreign resources.
create function public.eduai_connect_status(p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_uid uuid:=auth.uid();v_access jsonb;v_rows jsonb;
begin
 if not eduai_connect_private.session_ok(false) or not exists (
   select 1 from public.eduai_user_access a where a.user_id=v_uid
   and a.account_type='teacher' and a.age_band='adult'
   and a.birth_date<=(current_date-interval '18 years')::date and a.access_tier in ('standard','teacher','admin')
 ) then raise exception 'Cuenta docente no habilitada' using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 100 then
   raise exception 'Paginación inválida' using errcode='22023';end if;
 select jsonb_build_object('scopes',a.scopes,'expires_at',a.expires_at,'revoked_at',a.revoked_at,
 'active',a.revoked_at is null and a.expires_at>now()) into v_access
 from public.eduai_connect_teacher_authorizations a where a.teacher_id=v_uid;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into v_rows
 from (select r.id,r.kind,r.source_id,r.scopes,r.status,r.created_at,r.decided_at
       from public.eduai_connect_requests r where r.teacher_id=v_uid
       order by r.created_at desc,r.id offset p_offset limit p_limit) x;
 return jsonb_build_object('access',v_access,'requests',v_rows,'offset',p_offset,'limit',p_limit);
end $$;
create function public.eduai_connect_document_candidates(p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_uid uuid:=auth.uid();v_rows jsonb;
begin
 if not public.eduai_connect_has_scope('documents:content') then raise exception 'Permiso de documentos requerido' using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 100 then
 raise exception 'Paginación inválida' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into v_rows
 from (select a.id,a.title,a.asset_type,a.mime_type,a.created_at,a.updated_at
   from public.eduai_assets a where a.owner_id=v_uid and a.deleted_at is null
   and (a.retention_until is null or a.retention_until>now())
   order by a.created_at desc,a.id offset p_offset limit p_limit) x;
 return jsonb_build_object('items',v_rows,'offset',p_offset,'limit',p_limit);
end $$;
revoke all on function public.eduai_connect_status(integer,integer),public.eduai_connect_document_candidates(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.eduai_connect_status(integer,integer),public.eduai_connect_document_candidates(integer,integer) to authenticated;
commit;