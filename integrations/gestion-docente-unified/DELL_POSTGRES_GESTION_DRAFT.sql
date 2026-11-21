-- Dell PostgreSQL 17 / Gestión Docente HUB V2
-- SCHEMA CANDIDATE ONLY, DO NOT APPLY. No production DB/schema changed.
-- Database: new dedicated 'gestion_docente' (not intranet shared public schema).
-- TLS/auth gateway validates EDUAI identity and grants before starting any DB transaction.
begin;
create extension if not exists pgcrypto;
create schema if not exists gestion;
revoke all on schema gestion from public;
-- Members are account UUIDs validated against EDUAI, without direct foreign keys
-- to Supabase auth.users across database boundaries.
create table gestion.schools(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 3 and 120),
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table gestion.memberships(
 school_id uuid not null references gestion.schools(id) on delete restrict,
 user_id uuid not null,
 group_key text not null check(group_key in
 ('administrativos','pie','orientacion_convivencia','utp','docentes','inspectoria','contabilidad','estudiantes','apoderados','otros')),
 status text not null default 'active' check(status in ('active','revoked')),
 expires_at timestamptz not null,
 approved_by uuid not null,
 created_at timestamptz not null default now(),
 primary key(school_id,user_id)
);
create index memberships_lookup on gestion.memberships(user_id,school_id) where status='active';
create table gestion.oversight_grants(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references gestion.schools(id) on delete restrict,
 viewer_id uuid not null,
 owner_id uuid,
 scope text not null check(scope in ('seguimiento:leer','contenido:revisar')),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 approved_by uuid not null,
 foreign key(school_id,viewer_id) references gestion.memberships(school_id,user_id),
 foreign key(school_id,owner_id) references gestion.memberships(school_id,user_id),
 unique(school_id,id)
);
create table gestion.folders(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references gestion.schools(id) on delete restrict,
 owner_id uuid not null,
 parent_id uuid,
 title text not null check(length(btrim(title)) between 1 and 120),
 depth integer not null check(depth between 0 and 5),
 created_at timestamptz not null default now(),
 archived_at timestamptz,
 foreign key(school_id,owner_id) references gestion.memberships(school_id,user_id),
 unique(school_id,id),
 foreign key(school_id,parent_id) references gestion.folders(school_id,id) deferrable initially immediate,
 check(parent_id is distinct from id)
);
create index folder_owner on gestion.folders(school_id,owner_id,parent_id);
create table gestion.folder_access(
 school_id uuid not null,
 folder_id uuid not null,
 user_id uuid not null,
 permission text not null check(permission in ('viewer','editor')),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 approved_by uuid not null,
 primary key(school_id,folder_id,user_id),
 foreign key(school_id,folder_id) references gestion.folders(school_id,id),
 foreign key(school_id,user_id) references gestion.memberships(school_id,user_id)
);
create table gestion.file_objects(
 id uuid primary key,
 school_id uuid not null,
 owner_id uuid not null,
 folder_id uuid not null,
 file_name text not null check(length(btrim(file_name)) between 1 and 160),
 mime_type text not null,
 plain_size_bytes integer not null check(plain_size_bytes between 1 and 20971520),
 plain_sha256 text not null check(plain_sha256 ~ '^[a-f0-9]{64}$'),
 encryption_key_version integer not null check(encryption_key_version>=1),
 gcm_iv bytea not null check(octet_length(gcm_iv)=12),
 gcm_tag bytea not null check(octet_length(gcm_tag)=16),
 antivirus_engine text not null check(antivirus_engine='clamav'),
 antivirus_signature_version text not null check(length(antivirus_signature_version)>0),
 status text not null check(status in ('pending','ready','quarantined','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(school_id,owner_id) references gestion.memberships(school_id,user_id),
 foreign key(school_id,folder_id) references gestion.folders(school_id,id),
 unique(school_id,id),
 unique(school_id,id,owner_id),
 unique(school_id,id,folder_id)
);
create index file_folder on gestion.file_objects(school_id,folder_id,status,created_at desc);
create index file_owner on gestion.file_objects(school_id,owner_id,created_at desc);
create table gestion.task_templates(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references gestion.schools(id) on delete restrict,
 created_by uuid not null,
 template_version integer not null check(template_version>=1),
 schema_json jsonb not null,
 min_files integer not null check(min_files between 0 and 5),
 created_at timestamptz not null default now(),
 foreign key(school_id,created_by) references gestion.memberships(school_id,user_id),
 unique(school_id,id)
);
create table gestion.tasks(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references gestion.schools(id) on delete restrict,
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '',
 created_by uuid not null,
 template_id uuid not null,
 deadline_at timestamptz not null,
 created_at timestamptz not null default now(),
 status text not null default 'active' check(status in ('active','cancelled')),
 foreign key(school_id,created_by) references gestion.memberships(school_id,user_id),
 foreign key(school_id,template_id) references gestion.task_templates(school_id,id),
 unique(school_id,id)
);
create table gestion.task_recipients(
 school_id uuid not null,
 task_id uuid not null,
 user_id uuid not null,
 state text not null default 'assigned' check(state in ('assigned','draft','submitted','returned','approved','cancelled')),
 revision integer not null default 0 check(revision>=0),
 answers jsonb not null default '{}'::jsonb,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid,
 return_reason text,
 created_at timestamptz not null default now(),
 primary key(school_id,task_id,user_id),
 foreign key(school_id,task_id) references gestion.tasks(school_id,id),
 foreign key(school_id,user_id) references gestion.memberships(school_id,user_id),
 foreign key(school_id,reviewed_by) references gestion.memberships(school_id,user_id),
 check(state<>'approved' or (reviewed_at is not null and reviewed_by is not null))
);
create index task_recipient_status on gestion.task_recipients(school_id,user_id,state);
create index task_review_queue on gestion.task_recipients(school_id,state,submitted_at) where state='submitted';
create table gestion.evidence(
 school_id uuid not null,
 task_id uuid not null,
 recipient_id uuid not null,
 file_id uuid not null,
 linked_at timestamptz not null default now(),
 primary key(school_id,task_id,recipient_id,file_id),
 foreign key(school_id,task_id,recipient_id) references gestion.task_recipients(school_id,task_id,user_id),
 foreign key(school_id,file_id,recipient_id) references gestion.file_objects(school_id,id,owner_id)
);
create table gestion.notifications(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 recipient_id uuid not null,
 event_type text not null,
 reference_id uuid,
 created_at timestamptz not null default now(),
 seen_at timestamptz,
 foreign key(school_id,recipient_id) references gestion.memberships(school_id,user_id)
);
create index notification_inbox on gestion.notifications(school_id,recipient_id,created_at desc);
create table gestion.audit_events(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references gestion.schools(id) on delete restrict,
 actor_id uuid not null,
 event_type text not null,
 entity_type text not null,
 entity_id uuid,
 recorded_at timestamptz not null default now(),
 -- Minimal metadata only; never body of email, file, form answers or OAuth.
 foreign key(school_id,actor_id) references gestion.memberships(school_id,user_id)
);
-- Database is private. No browser or Supabase public role can query these tables.
-- Deliberate fail-closed RLS: no policies until authentication, grants and
-- multi-tenant permissions have been tested against an isolated PostgreSQL instance.
do $$ declare t text; begin
 foreach t in array array[
 'schools','memberships','oversight_grants','folders','folder_access',
 'file_objects','task_templates','tasks','task_recipients','evidence',
 'notifications','audit_events']
 loop
 execute format('alter table gestion.%I enable row level security',t);
 execute format('revoke all on gestion.%I from public',t);
 end loop;
end $$;
commit;
