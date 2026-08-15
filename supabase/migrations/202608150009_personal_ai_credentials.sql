-- EduAI Personal AI Marketplace (BYOK)
-- Server-side encrypted provider credentials + user-controlled budgets.
-- Secrets are NEVER intended to be read through Supabase client RLS.

create table if not exists public.user_ai_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('fal','huggingface','replicate')),
  label text,
  encrypted_secret text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  secret_last4 text,
  enabled boolean not null default true,
  max_request_usd numeric(10,4),
  daily_budget_usd numeric(10,4),
  currency text not null default 'USD',
  test_status text check (test_status is null or test_status in ('untested','healthy','invalid','error')),
  test_message text,
  tested_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists idx_user_ai_credentials_user_enabled
  on public.user_ai_credentials(user_id, enabled);

alter table public.user_ai_credentials enable row level security;

-- Deliberately no authenticated-user policies. All access goes through EduAI server
-- routes after auth, using the service role. This prevents encrypted_secret/IV/tag
-- from being queryable from the browser even by the record owner.

create table if not exists public.user_ai_spend_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid references public.user_ai_credentials(id) on delete set null,
  provider text not null,
  capability text not null,
  model text,
  external_request_id text,
  status text not null default 'submitted' check (status in ('estimated','submitted','processing','completed','failed','cancelled')),
  estimated_cost_usd numeric(12,6),
  actual_cost_usd numeric(12,6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_user_ai_spend_events_user_created
  on public.user_ai_spend_events(user_id, created_at desc);
create index if not exists idx_user_ai_spend_events_external
  on public.user_ai_spend_events(provider, external_request_id)
  where external_request_id is not null;

alter table public.user_ai_spend_events enable row level security;

comment on table public.user_ai_credentials is 'Encrypted user-owned API credentials for personal paid AI providers. Server-only access.';
comment on table public.user_ai_spend_events is 'Estimated/actual personal-provider spend ledger. No EduAI platform billing responsibility.';
