-- Draft family authorization record. Do not deploy without legal/privacy review.
-- Enrollment and basic educational processing may have a separate lawful basis.
-- This form is for genuinely optional purposes; never substitute it for an
-- independently validated capacity of the parent/guardian/caregiver.

create table if not exists public.family_authorization_requests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('eduai', 'sello')),
  institution_name text not null,
  guardian_email text not null,
  token_sha256 char(64) not null unique,
  document_version text not null default 'family-2026-10-v1',
  status text not null default 'invited'
    check (status in ('invited','submitted','approved','rejected','revoked','expired')),
  expires_at timestamptz not null,
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  submitted_at timestamptz,
  guardian_full_name text,
  guardian_relationship text
    check (guardian_relationship in ('madre','padre','representante_legal','cuidador_personal')),
  guardian_declaration boolean not null default false,
  signature_name text,
  signature_method text check (signature_method in ('electronic_simple')),
  signature_sha256 char(64),
  decisions jsonb not null default '{}'::jsonb,
  identity_verified_at timestamptz,
  legal_capacity_verified_at timestamptz,
  verified_by uuid references auth.users(id),
  verified_evidence_ref text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  decision_note text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_auth_expiry check (expires_at > issued_at)
);

create index if not exists family_authorization_student_idx
  on public.family_authorization_requests(student_user_id, platform, status);
create index if not exists family_authorization_issued_idx
  on public.family_authorization_requests(issued_at desc);

create table if not exists public.family_authorization_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.family_authorization_requests(id) on delete cascade,
  event_type text not null,
  performed_by uuid references auth.users(id),
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists family_authorization_events_request_idx
  on public.family_authorization_events(request_id, created_at);

-- All business operations are performed through authenticated admin server routes
-- and server-only anonymous invitation validation. No direct browser table access.
alter table public.family_authorization_requests enable row level security;
alter table public.family_authorization_events enable row level security;
revoke all on public.family_authorization_requests from public, anon, authenticated;
revoke all on public.family_authorization_events from public, anon, authenticated;
grant all on public.family_authorization_requests to service_role;
grant all on public.family_authorization_events to service_role;
grant usage, select on sequence public.family_authorization_events_id_seq to service_role;

comment on table public.family_authorization_requests is
  'Per-minor and per-platform optional family permissions. Signed != identity/capacity verified. Only approved records may unlock permissions.';
comment on column public.family_authorization_requests.signature_sha256 is
  'Digest of the immutable signature statement and choices, not an advanced electronic-signature certificate.';
