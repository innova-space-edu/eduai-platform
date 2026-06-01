create schema if not exists private;

create table if not exists private.model_lab_admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  require_aal2 boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
