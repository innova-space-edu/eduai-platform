-- All lifecycle writes go through the authenticated server routes; no client can approve or mutate examples.
revoke delete on public.ai_training_candidates from authenticated;
drop policy training_candidate_owner_delete on public.ai_training_candidates;
create function public.invalidate_eduai_training_exports() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.ai_training_exports set revoked_at=now() where revoked_at is null and old.id=any(candidate_ids);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.invalidate_eduai_training_exports() from public,anon,authenticated;
create trigger invalidate_eduai_training_exports before update or delete on public.ai_training_candidates for each row execute function public.invalidate_eduai_training_exports();
-- Atomic export: consent withdrawal/correction cannot race the snapshot and its audit record.
create function public.export_eduai_training_dataset(p_actor uuid,p_policy text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  row record;
  training jsonb := '[]'::jsonb;
  validation jsonb := '[]'::jsonb;
  ids uuid[] := '{}'::uuid[];
  prompt text;
  bucket integer;
  payload jsonb;
  export_id uuid;
  digest text;
begin
  if not exists(select 1 from auth.users u join public.admin_emails a on a.email=u.email where u.id=p_actor) then raise exception 'admin required'; end if;
  for row in
    select c.id,c.messages from public.ai_training_candidates c join public.ai_training_consents s on s.owner_id=c.owner_id
    where c.status='approved' and c.expires_at>now() and s.enabled and c.policy_version=p_policy and s.policy_version=p_policy
    order by c.id limit 5001 for share of c,s
  loop
    if cardinality(ids)>=5000 then raise exception 'batch exceeds 5000'; end if;
    -- Group identical prompts, including alternate answers, in the same partition.
    prompt := lower(regexp_replace(trim(row.messages->1->>'content'),'\s+',' ','g'));
    bucket := (('x'||substr(md5(prompt),1,8))::bit(32)::bigint % 10)::integer;
    if bucket=0 then validation := validation || jsonb_build_array(jsonb_build_object('messages',row.messages));
    else training := training || jsonb_build_array(jsonb_build_object('messages',row.messages)); end if;
    ids:=array_append(ids,row.id);
  end loop;
  payload:=jsonb_build_object('format','eduai-training-v1','reviewedOnly',true,'policyVersion',p_policy,'train',training,'validation',validation);
  digest:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
  insert into public.ai_training_exports(created_by,dataset_sha256,candidate_ids,train_count,validation_count)
    values(p_actor,digest,ids,jsonb_array_length(training),jsonb_array_length(validation)) returning id into export_id;
  return payload || jsonb_build_object('exportId',export_id,'sha256',digest);
end $$;
revoke execute on function public.export_eduai_training_dataset(uuid,text) from public,anon,authenticated;
grant execute on function public.export_eduai_training_dataset(uuid,text) to service_role;
