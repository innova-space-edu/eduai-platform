create table public.ai_training_consents (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  policy_version text not null,
  updated_at timestamptz not null default now()
);
create table public.ai_training_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.ai_training_consents(owner_id) on delete cascade,
  source_module text not null,
  origin text not null check(origin in ('generation','feedback')),
  messages jsonb not null check(jsonb_typeof(messages)='array' and jsonb_array_length(messages)=3 and octet_length(messages::text)<=100000),
  fingerprint text not null check(length(fingerprint)=64),
  policy_version text not null,
  rating text check(rating in ('useful','incorrect','corrected')),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  provider text, model text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '90 days',
  unique(owner_id,fingerprint),
  check(status<>'approved' or (reviewed_by is not null and reviewed_at is not null and rating is distinct from 'incorrect'))
);
create index ai_training_candidates_review_idx on public.ai_training_candidates(status,created_at desc);
create table public.ai_training_exports (
  id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id) on delete set null,
  dataset_sha256 text not null, candidate_ids uuid[] not null,
  train_count integer not null, validation_count integer not null,
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.ai_training_runs (
  id uuid primary key default gen_random_uuid(),
  export_id uuid references public.ai_training_exports(id) on delete set null,
  status text not null check(status in ('queued','running','completed','failed','rejected')),
  kaggle_url text not null,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_training_consents enable row level security;
alter table public.ai_training_candidates enable row level security;
alter table public.ai_training_exports enable row level security;
alter table public.ai_training_runs enable row level security;
revoke all on public.ai_training_consents,public.ai_training_candidates,public.ai_training_exports,public.ai_training_runs from anon,authenticated;
grant all on public.ai_training_consents,public.ai_training_candidates,public.ai_training_exports,public.ai_training_runs to service_role;
grant select on public.ai_training_consents to authenticated;
grant select,delete on public.ai_training_candidates to authenticated;
grant insert(owner_id,source_module,origin,messages,fingerprint,policy_version,provider,model) on public.ai_training_candidates to authenticated;
create policy training_consent_owner_read on public.ai_training_consents for select to authenticated using((select auth.uid())=owner_id);
create policy training_candidate_owner_read on public.ai_training_candidates for select to authenticated using((select auth.uid())=owner_id);
create policy training_candidate_owner_delete on public.ai_training_candidates for delete to authenticated using((select auth.uid())=owner_id);
create policy training_candidate_owner_insert on public.ai_training_candidates for insert to authenticated with check(
  (select auth.uid())=owner_id and status='pending' and origin='generation' and rating is null and reviewed_by is null and reviewed_at is null
  and exists(select 1 from public.ai_training_consents c where c.owner_id=ai_training_candidates.owner_id and c.enabled and c.policy_version=ai_training_candidates.policy_version)
);
create function public.revoke_eduai_training_contribution() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.enabled=false or new.policy_version is distinct from old.policy_version then
    update public.ai_training_exports set revoked_at=now() where revoked_at is null and candidate_ids && array(select id from public.ai_training_candidates where owner_id=new.owner_id);
    delete from public.ai_training_candidates where owner_id=new.owner_id;
  end if;
  return new;
end $$;
revoke execute on function public.revoke_eduai_training_contribution() from public,anon,authenticated;
create trigger revoke_eduai_training_contribution after update on public.ai_training_consents for each row execute function public.revoke_eduai_training_contribution();
