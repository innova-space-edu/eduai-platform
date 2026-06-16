create extension if not exists pgcrypto;

create table if not exists public.student_roster (
  id uuid primary key default gen_random_uuid(),
  school_year text not null default '2026',
  course text not null,
  student_name text not null,
  student_name_normalized text not null,
  rut text not null,
  rut_clean text not null,
  source text not null default 'manual',
  active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year, course, rut_clean)
);

create table if not exists public.exam_access_codes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.teacher_exams(id) on delete cascade,
  student_id uuid not null references public.student_roster(id) on delete cascade,
  course text not null,
  student_name text not null,
  code_hash text not null unique,
  code_hint text null,
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  used_at timestamptz null,
  used_client_attempt_id text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_access_code_audit (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid null references public.teacher_exams(id) on delete set null,
  student_id uuid null references public.student_roster(id) on delete set null,
  access_code_id uuid null references public.exam_access_codes(id) on delete set null,
  event_type text not null,
  event_detail jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create unique index if not exists exam_access_codes_one_active_per_student
on public.exam_access_codes (exam_id, student_id)
where status = 'active';

create index if not exists student_roster_course_idx on public.student_roster (school_year, course) where active = true;
create index if not exists student_roster_name_idx on public.student_roster (student_name_normalized);
create index if not exists exam_access_codes_exam_course_idx on public.exam_access_codes (exam_id, course, status, expires_at);
create index if not exists exam_access_codes_student_idx on public.exam_access_codes (student_id, status);
create index if not exists exam_access_code_audit_exam_idx on public.exam_access_code_audit (exam_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_roster_updated_at on public.student_roster;
create trigger set_student_roster_updated_at
before update on public.student_roster
for each row execute function public.set_updated_at();

drop trigger if exists set_exam_access_codes_updated_at on public.exam_access_codes;
create trigger set_exam_access_codes_updated_at
before update on public.exam_access_codes
for each row execute function public.set_updated_at();

alter table public.student_roster enable row level security;
alter table public.exam_access_codes enable row level security;
alter table public.exam_access_code_audit enable row level security;

-- No public policies intentionally. Access only from server routes using SUPABASE_SERVICE_ROLE_KEY.