-- DRAFT: review on isolated database, do not apply to production.
-- Manual personal gradebook pilot: coded rows only, no real names/RUT/roster imports.
begin;
alter table public.eduai_teacher_contexts add constraint eduai_teacher_contexts_owner_id_unique unique(teacher_id,id);

-- A distinct pilot entitlement. Never infer institutional permissions from a context label.
create table public.eduai_gradebook_pilot_access(
 teacher_id uuid primary key references auth.users(id) on delete cascade,
 approved_by uuid not null references auth.users(id) on delete restrict,
 approved_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at>approved_at),
 revoked_at timestamptz
);
alter table public.eduai_gradebook_pilot_access enable row level security;
revoke all on public.eduai_gradebook_pilot_access from public,anon,authenticated,service_role;
grant select on public.eduai_gradebook_pilot_access to authenticated;
create policy gradebook_pilot_own on public.eduai_gradebook_pilot_access for select to authenticated
 using(teacher_id=(select auth.uid()));
-- Administrative grant provisioning remains a separate reviewed step. No approvals seeded.

create function public.eduai_gradebook_context_allowed(p_context uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(
   (select eduai_connect_private.session_ok(false)) and exists(
    select 1 from public.eduai_gradebook_pilot_access a
    join public.eduai_teacher_contexts c on c.teacher_id=a.teacher_id
    join public.eduai_privacy_choices p on p.user_id=a.teacher_id
    where a.teacher_id=(select auth.uid()) and c.id=p_context and c.archived_at is null
    and c.education_level in ('basica','media')
    and a.revoked_at is null and a.expires_at>now()
    and p.policy_version='2026-10-11-v1' and p.terms_acknowledged_at is not null and p.data_warning_acknowledged_at is not null
   ),false)
$$;
revoke all on function public.eduai_gradebook_context_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function public.eduai_gradebook_context_allowed(uuid) to authenticated;

create table public.eduai_gradebook_rows(
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null default auth.uid(),
 context_id uuid not null,
 row_code text not null check(row_code ~ '^E[0-9]{3,5}$'),
 created_at timestamptz not null default now(),
 foreign key(teacher_id,context_id) references public.eduai_teacher_contexts(teacher_id,id) on delete restrict,
 unique(teacher_id,context_id,id),
 unique(teacher_id,context_id,row_code)
);
create table public.eduai_gradebook_assessments(
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null default auth.uid(),
 context_id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 assessment_date date not null,
 assessment_type text not null check(assessment_type in ('prueba','control','trabajo','proyecto','exposicion','rubrica','otro')),
 weight_bps integer not null default 10000 check(weight_bps between 1 and 10000),
 created_at timestamptz not null default now(),
 foreign key(teacher_id,context_id) references public.eduai_teacher_contexts(teacher_id,id) on delete restrict,
 unique(teacher_id,context_id,id)
);
create table public.eduai_gradebook_entries(
 teacher_id uuid not null default auth.uid(),
 context_id uuid not null,
 row_id uuid not null,
 assessment_id uuid not null,
 grade numeric check(grade between 1 and 7 and grade=round(grade,1)),
 state text not null default 'pending' check(state in ('pending','draft','validated','absent','exempt')),
 updated_at timestamptz not null default now(),
 check((state in ('draft','validated') and grade is not null) or (state in ('pending','absent','exempt') and grade is null)),
 primary key(teacher_id,context_id,row_id,assessment_id),
 foreign key(teacher_id,context_id,row_id) references public.eduai_gradebook_rows(teacher_id,context_id,id) on delete restrict,
 foreign key(teacher_id,context_id,assessment_id) references public.eduai_gradebook_assessments(teacher_id,context_id,id) on delete restrict
);
create index eduai_gradebook_assessment_lookup on public.eduai_gradebook_entries(teacher_id,context_id,assessment_id);
-- Append-only history for mutations; private schema not exposed through Data API.
create table eduai_connect_private.gradebook_history(
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null,
 context_id uuid not null,
 row_id uuid not null,
 assessment_id uuid not null,
 prior_grade numeric,
 prior_state text,
 new_grade numeric,
 new_state text not null,
 recorded_at timestamptz not null default now()
);
alter table eduai_connect_private.gradebook_history enable row level security;
revoke all on eduai_connect_private.gradebook_history from public,anon,authenticated,service_role;
create function eduai_connect_private.gradebook_record_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is distinct from new.teacher_id then raise exception 'Owner mismatch' using errcode='42501';end if;
 new.updated_at:=now();
 if tg_op='UPDATE' then
   if old.grade is distinct from new.grade or old.state is distinct from new.state then
     insert into eduai_connect_private.gradebook_history(teacher_id,context_id,row_id,assessment_id,prior_grade,prior_state,new_grade,new_state)
     values(new.teacher_id,new.context_id,new.row_id,new.assessment_id,old.grade,old.state,new.grade,new.state);
   end if;
 else
   insert into eduai_connect_private.gradebook_history(teacher_id,context_id,row_id,assessment_id,new_grade,new_state)
   values(new.teacher_id,new.context_id,new.row_id,new.assessment_id,new.grade,new.state);
 end if;
 return new;
end $$;
revoke all on function eduai_connect_private.gradebook_record_change() from public,anon,authenticated,service_role;
create trigger gradebook_record_change before insert or update on public.eduai_gradebook_entries
 for each row execute function eduai_connect_private.gradebook_record_change();

alter table public.eduai_gradebook_rows enable row level security;
alter table public.eduai_gradebook_assessments enable row level security;
alter table public.eduai_gradebook_entries enable row level security;
revoke all on public.eduai_gradebook_rows,public.eduai_gradebook_assessments,public.eduai_gradebook_entries from public,anon,authenticated,service_role;
grant select on public.eduai_gradebook_rows,public.eduai_gradebook_assessments,public.eduai_gradebook_entries to authenticated;
grant insert(context_id,row_code) on public.eduai_gradebook_rows to authenticated;
grant insert(context_id,title,assessment_date,assessment_type,weight_bps) on public.eduai_gradebook_assessments to authenticated;
grant insert(context_id,row_id,assessment_id,grade,state),update(grade,state) on public.eduai_gradebook_entries to authenticated;

create policy gradebook_rows_own_read on public.eduai_gradebook_rows for select to authenticated using(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id));
create policy gradebook_rows_own_insert on public.eduai_gradebook_rows for insert to authenticated with check(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id));
create policy gradebook_assessments_own_read on public.eduai_gradebook_assessments for select to authenticated using(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id));
create policy gradebook_assessments_own_insert on public.eduai_gradebook_assessments for insert to authenticated with check(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id));
create policy gradebook_entries_own_read on public.eduai_gradebook_entries for select to authenticated using(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id));
create policy gradebook_entries_own_insert on public.eduai_gradebook_entries for insert to authenticated with check(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id) and state<>'validated');
create policy gradebook_entries_own_update on public.eduai_gradebook_entries for update to authenticated using(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id)) with check(teacher_id=(select auth.uid()) and public.eduai_gradebook_context_allowed(context_id));

-- Stop before granting pilot users or importing any student records.
do $$begin
 if has_table_privilege('anon','public.eduai_gradebook_entries','SELECT') or
 has_table_privilege('authenticated','public.eduai_gradebook_pilot_access','INSERT') or
 has_column_privilege('authenticated','public.eduai_gradebook_entries','teacher_id','INSERT') or
 has_column_privilege('authenticated','public.eduai_gradebook_entries','context_id','UPDATE') or
 has_table_privilege('authenticated','eduai_connect_private.gradebook_history','SELECT') then raise exception 'Unexpected pilot privileges';end if;
end$$;
commit;