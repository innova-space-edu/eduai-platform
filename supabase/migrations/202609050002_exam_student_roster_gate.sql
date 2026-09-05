-- Defensa en profundidad para evaluaciones públicas.
-- Un RUT no puede crear un intento ni una entrega si no pertenece a la
-- nómina activa del año escolar vigente. La API sigue siendo responsable de
-- mostrar el mensaje amigable y derivar al código provisorio.

create or replace function public.enforce_exam_student_active_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_rut text;
  resolved_roster_id uuid;
begin
  normalized_rut := regexp_replace(
    upper(coalesce(new.student_rut_clean, '')),
    '[^0-9K]',
    '',
    'g'
  );

  if normalized_rut = '' then
    raise exception using
      errcode = '23514',
      message = 'STUDENT_NOT_IN_ROSTER: RUT requerido para iniciar una evaluación.';
  end if;

  if new.student_roster_id is not null then
    select sr.id
      into resolved_roster_id
      from public.student_roster sr
     where sr.id = new.student_roster_id
       and sr.rut_clean = normalized_rut
       and sr.active = true
       and sr.school_year = extract(year from current_date)::text
     limit 1;
  else
    select sr.id
      into resolved_roster_id
      from public.student_roster sr
     where sr.rut_clean = normalized_rut
       and sr.active = true
       and sr.school_year = extract(year from current_date)::text
     order by sr.updated_at desc
     limit 1;
  end if;

  if resolved_roster_id is null then
    raise exception using
      errcode = '23503',
      message = 'STUDENT_NOT_IN_ROSTER: Este RUT no está registrado en ningún curso activo del año escolar vigente.';
  end if;

  new.student_rut_clean := normalized_rut;
  new.student_roster_id := resolved_roster_id;
  return new;
end;
$$;

drop trigger if exists exam_attempt_drafts_require_active_roster
  on public.exam_attempt_drafts;
create trigger exam_attempt_drafts_require_active_roster
before insert or update of student_rut_clean, student_roster_id
on public.exam_attempt_drafts
for each row
execute function public.enforce_exam_student_active_roster();

drop trigger if exists exam_submissions_require_active_roster
  on public.exam_submissions;
create trigger exam_submissions_require_active_roster
before insert or update of student_rut_clean, student_roster_id
on public.exam_submissions
for each row
execute function public.enforce_exam_student_active_roster();

comment on function public.enforce_exam_student_active_roster() is
  'Impide crear intentos o entregas de examen para RUT fuera de la nómina activa del año escolar vigente.';
