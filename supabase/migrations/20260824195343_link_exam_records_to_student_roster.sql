alter table public.exam_attempt_drafts
  add column if not exists student_roster_id uuid null references public.student_roster(id) on delete set null;

alter table public.exam_submissions
  add column if not exists student_roster_id uuid null references public.student_roster(id) on delete set null;

create index if not exists exam_attempt_drafts_student_roster_idx
  on public.exam_attempt_drafts(student_roster_id)
  where student_roster_id is not null;

create index if not exists exam_submissions_student_roster_idx
  on public.exam_submissions(student_roster_id)
  where student_roster_id is not null;

create or replace function public.bind_exam_record_to_student_roster()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  roster_row public.student_roster%rowtype;
  incoming_rut text;
begin
  incoming_rut := upper(regexp_replace(coalesce(new.student_rut_clean, new.student_rut, ''), '[^0-9K]', '', 'g'));

  if incoming_rut = '' or nullif(btrim(coalesce(new.student_course, '')), '') is null then
    return new;
  end if;

  select r.*
    into roster_row
  from public.student_roster r
  where r.rut_clean = incoming_rut
    and r.course = btrim(new.student_course)
    and r.active = true
  order by r.school_year desc, r.updated_at desc
  limit 1;

  if found then
    new.student_roster_id := roster_row.id;
    new.student_name := roster_row.student_name;
    new.student_course := roster_row.course;
    new.student_rut := roster_row.rut;
    new.student_rut_clean := roster_row.rut_clean;
  end if;

  return new;
end;
$$;

revoke all on function public.bind_exam_record_to_student_roster() from public, anon, authenticated;

drop trigger if exists bind_exam_attempt_draft_roster on public.exam_attempt_drafts;
create trigger bind_exam_attempt_draft_roster
before insert or update of student_name, student_course, student_rut, student_rut_clean
on public.exam_attempt_drafts
for each row execute function public.bind_exam_record_to_student_roster();

drop trigger if exists bind_exam_submission_roster on public.exam_submissions;
create trigger bind_exam_submission_roster
before insert or update of student_name, student_course, student_rut, student_rut_clean
on public.exam_submissions
for each row execute function public.bind_exam_record_to_student_roster();

update public.exam_attempt_drafts d
set student_roster_id = (
  select r.id
  from public.student_roster r
  where r.rut_clean = d.student_rut_clean
    and r.course = d.student_course
  order by r.active desc, r.school_year desc, r.updated_at desc
  limit 1
)
where d.student_roster_id is null
  and exists (
    select 1 from public.student_roster r
    where r.rut_clean = d.student_rut_clean
      and r.course = d.student_course
  );

update public.exam_submissions s
set student_roster_id = (
  select r.id
  from public.student_roster r
  where r.rut_clean = coalesce(s.student_rut_clean, upper(regexp_replace(coalesce(s.student_rut, ''), '[^0-9K]', '', 'g')))
    and r.course = s.student_course
  order by r.active desc, r.school_year desc, r.updated_at desc
  limit 1
)
where s.student_roster_id is null
  and exists (
    select 1 from public.student_roster r
    where r.rut_clean = coalesce(s.student_rut_clean, upper(regexp_replace(coalesce(s.student_rut, ''), '[^0-9K]', '', 'g')))
      and r.course = s.student_course
  );