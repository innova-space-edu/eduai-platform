-- Personal teaching contexts. No institutional access or student records.
begin;
create table public.eduai_teacher_contexts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  institution_label text not null check(char_length(btrim(institution_label)) between 1 and 160),
  academic_year integer not null check(academic_year between 2000 and 2100),
  education_level text not null check(education_level in ('parvularia','basica','media')),
  grade integer not null,
  section text not null default '' check(char_length(section)<=12 and section ~ '^[A-Z0-9]*$'),
  subject text not null check(char_length(btrim(subject)) between 1 and 120),
  period text not null check(period in ('semestre_1','semestre_2','anual','trimestre_1','trimestre_2','trimestre_3')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check ((education_level='parvularia' and grade between 1 and 2)
      or (education_level='basica' and grade between 1 and 8)
      or (education_level='media' and grade between 1 and 4))
);
create unique index eduai_teacher_contexts_active_key on public.eduai_teacher_contexts
 (teacher_id,lower(btrim(institution_label)),academic_year,education_level,grade,section,lower(btrim(subject)),period)
 where archived_at is null;
create index eduai_teacher_contexts_owner_year on public.eduai_teacher_contexts(teacher_id,academic_year desc,created_at desc);
alter table public.eduai_teacher_contexts enable row level security;
revoke all on public.eduai_teacher_contexts from public,anon,authenticated,service_role;
grant select on public.eduai_teacher_contexts to authenticated;
grant insert(institution_label,academic_year,education_level,grade,section,subject,period) on public.eduai_teacher_contexts to authenticated;
grant update(archived_at) on public.eduai_teacher_contexts to authenticated;
create policy eduai_teacher_contexts_select on public.eduai_teacher_contexts for select to authenticated
using(teacher_id=(select auth.uid()) and (select eduai_connect_private.session_ok(false))
 and exists(select 1 from public.eduai_user_access a where a.user_id=(select auth.uid())
 and a.account_type='teacher' and a.age_band='adult' and a.birth_date<=(current_date-interval '18 years')::date
 and a.access_tier in ('standard','teacher','admin')));
create policy eduai_teacher_contexts_insert on public.eduai_teacher_contexts for insert to authenticated
with check(teacher_id=(select auth.uid()) and archived_at is null and (select eduai_connect_private.session_ok(false))
 and exists(select 1 from public.eduai_user_access a where a.user_id=(select auth.uid())
 and a.account_type='teacher' and a.age_band='adult' and a.birth_date<=(current_date-interval '18 years')::date
 and a.access_tier in ('standard','teacher','admin')));
create policy eduai_teacher_contexts_archive on public.eduai_teacher_contexts for update to authenticated
using(teacher_id=(select auth.uid()) and (select eduai_connect_private.session_ok(false))
 and exists(select 1 from public.eduai_user_access a where a.user_id=(select auth.uid())
 and a.account_type='teacher' and a.age_band='adult' and a.birth_date<=(current_date-interval '18 years')::date
 and a.access_tier in ('standard','teacher','admin')))
with check(teacher_id=(select auth.uid()) and (select eduai_connect_private.session_ok(false))
 and exists(select 1 from public.eduai_user_access a where a.user_id=(select auth.uid())
 and a.account_type='teacher' and a.age_band='adult' and a.birth_date<=(current_date-interval '18 years')::date
 and a.access_tier in ('standard','teacher','admin')));
-- No external Connect scopes or RPC grants are changed.
do $$ begin
 if has_table_privilege('anon','public.eduai_teacher_contexts','SELECT')
 or has_table_privilege('authenticated','public.eduai_teacher_contexts','DELETE')
 or has_column_privilege('authenticated','public.eduai_teacher_contexts','teacher_id','INSERT')
 or has_column_privilege('authenticated','public.eduai_teacher_contexts','teacher_id','UPDATE')
 then raise exception 'Unexpected personal-context grants';end if;
end $$;
commit;
