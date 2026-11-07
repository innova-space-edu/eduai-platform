begin;
do $$
declare actor uuid; other_user uuid; candidate uuid; reviewer uuid; payload jsonb; n int;
begin
select u.id into actor from auth.users u join public.admin_emails a on a.email=u.email limit 1;
select id into other_user from auth.users where id<>actor limit 1;
if actor is null or other_user is null then raise exception 'test needs two accounts'; end if;
insert into public.ai_training_consents(owner_id,enabled,policy_version) values(actor,true,'2026-11-06-v1'),(other_user,true,'2026-11-06-v1')
on conflict(owner_id) do update set enabled=true,policy_version=excluded.policy_version;
perform set_config('request.jwt.claim.sub',actor::text,true);
set local role authenticated;
insert into public.ai_training_candidates(owner_id,source_module,origin,messages,fingerprint,policy_version)
values(actor,'transaction-test','generation','[{"role":"system","content":"EDUAI"},{"role":"user","content":"Crear patrones con bloques grandes"},{"role":"assistant","content":"Ordenar bloques y explicar la secuencia."}]',repeat('a',64),'2026-11-06-v1') returning id into candidate;
select count(*) into n from public.ai_training_consents where owner_id=other_user;
if n<>0 then raise exception 'owner isolation failed'; end if;
begin
insert into public.ai_training_candidates(owner_id,source_module,origin,messages,fingerprint,policy_version)
values(other_user,'test','generation','[{},{},{}]',repeat('b',64),'2026-11-06-v1');
raise exception 'cross-owner insert accepted';
exception when insufficient_privilege then null; end;
begin
update public.ai_training_candidates set status='approved' where id=candidate;
raise exception 'client approval accepted';
exception when insufficient_privilege then null; end;
begin
perform public.export_eduai_training_dataset(actor,'2026-11-06-v1');
raise exception 'client export accepted';
exception when insufficient_privilege then null; end;
set local role service_role;
update public.ai_training_candidates set status='approved',reviewed_by=actor,reviewed_at=now() where id=candidate;
payload:=public.export_eduai_training_dataset(actor,'2026-11-06-v1');
if jsonb_array_length(payload->'train')+jsonb_array_length(payload->'validation')<1 then raise exception 'export missing'; end if;
update public.ai_training_candidates set status='rejected' where id=candidate;
if not exists(select 1 from public.ai_training_exports where id=(payload->>'exportId')::uuid and revoked_at is not null) then raise exception 'correction did not invalidate export'; end if;
update public.ai_training_consents set enabled=false where owner_id=actor;
if exists(select 1 from public.ai_training_candidates where owner_id=actor) then raise exception 'withdrawal did not delete'; end if;
set local role postgres;
end $$;
select 'passed: ownership, pending insert, no client approval/export, atomic reviewed export, correction revocation, withdrawal purge' as test;
rollback;
