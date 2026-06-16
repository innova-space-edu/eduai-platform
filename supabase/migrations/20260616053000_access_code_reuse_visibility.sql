alter table public.exam_access_codes
add column if not exists code_value text null;

comment on column public.exam_access_codes.code_value is
  'Código temporal visible solo para docentes autorizados mientras no venza. Se limpia al vencer o revocar.';

create index if not exists exam_access_codes_reusable_idx
on public.exam_access_codes (exam_id, student_id, status, expires_at desc);
