-- EDUAI Formularios: private forms, public submission only via a validated server endpoint.
create table if not exists public.eduai_forms (
  id uuid primary key default gen_random_uuid(),
  slug uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  description text not null default '' check (length(description) <= 1500),
  kind text not null default 'encuesta' check (kind in ('encuesta','entrevista','registro','checklist','ticket','evaluacion')),
  status text not null default 'draft' check (status in ('draft','published','closed')),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 60 and octet_length(questions::text) < 300000),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) < 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists eduai_forms_user_updated_idx on public.eduai_forms (user_id, updated_at desc);
create index if not exists eduai_forms_public_slug_idx on public.eduai_forms (slug) where status = 'published';

create table if not exists public.eduai_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.eduai_forms(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) < 35000),
  identity jsonb not null default '{}'::jsonb check (jsonb_typeof(identity) = 'object' and octet_length(identity::text) < 2000),
  respondent_fingerprint text,
  submitted_at timestamptz not null default now()
);
create unique index if not exists eduai_form_one_response_idx on public.eduai_form_responses (form_id,respondent_fingerprint) where respondent_fingerprint is not null;
create index if not exists eduai_form_responses_date_idx on public.eduai_form_responses (form_id,submitted_at desc);

alter table public.eduai_forms enable row level security;
alter table public.eduai_form_responses enable row level security;

revoke all on public.eduai_forms from public,anon,authenticated;
revoke all on public.eduai_form_responses from public,anon,authenticated;
grant select,insert,update,delete on public.eduai_forms to authenticated;
grant select,delete on public.eduai_form_responses to authenticated;
grant select,insert,update,delete on public.eduai_forms to service_role;
grant select,insert,update,delete on public.eduai_form_responses to service_role;

drop policy if exists eduai_forms_own_read on public.eduai_forms;
create policy eduai_forms_own_read on public.eduai_forms
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists eduai_forms_own_create on public.eduai_forms;
create policy eduai_forms_own_create on public.eduai_forms
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists eduai_forms_own_update on public.eduai_forms;
create policy eduai_forms_own_update on public.eduai_forms
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists eduai_forms_own_delete on public.eduai_forms;
create policy eduai_forms_own_delete on public.eduai_forms
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists eduai_form_responses_owner_read on public.eduai_form_responses;
create policy eduai_form_responses_owner_read on public.eduai_form_responses
for select to authenticated using (
  exists (select 1 from public.eduai_forms f where f.id = form_id and f.user_id = (select auth.uid()))
);
drop policy if exists eduai_form_responses_owner_delete on public.eduai_form_responses;
create policy eduai_form_responses_owner_delete on public.eduai_form_responses
for delete to authenticated using (
  exists (select 1 from public.eduai_forms f where f.id = form_id and f.user_id = (select auth.uid()))
);

comment on table public.eduai_forms is 'Formularios privados por propietario; acceso público exclusivamente por endpoint validado.';
comment on table public.eduai_form_responses is 'Respuestas privadas; inserción exclusiva del servidor con llave de servicio, sin Data API pública.';
