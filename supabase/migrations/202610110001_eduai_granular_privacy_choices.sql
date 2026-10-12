-- EDUAI 2026: registro verificable de aceptación de términos y preferencias por finalidad.
-- El reconocimiento de términos y advertencias NO constituye consentimiento general para todos los tratamientos.
-- Los permisos opcionales comienzan desactivados; no se autorizan datos sensibles ni publicación por este mecanismo.

create table if not exists public.eduai_privacy_choices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  terms_acknowledged_at timestamptz not null,
  data_warning_acknowledged_at timestamptz not null,
  ai_generation boolean not null default false,
  ai_documents boolean not null default false,
  ai_voice boolean not null default false,
  optional_analytics boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.eduai_privacy_choice_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  choices jsonb not null,
  event_type text not null default 'preferences_recorded',
  recorded_at timestamptz not null default now()
);

create index if not exists eduai_privacy_choice_events_user_at_idx
  on public.eduai_privacy_choice_events(user_id, recorded_at desc);

alter table public.eduai_privacy_choices enable row level security;
alter table public.eduai_privacy_choice_events enable row level security;

drop policy if exists "eduai_privacy_choices_read_own" on public.eduai_privacy_choices;
create policy "eduai_privacy_choices_read_own" on public.eduai_privacy_choices
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "eduai_privacy_events_read_own" on public.eduai_privacy_choice_events;
create policy "eduai_privacy_events_read_own" on public.eduai_privacy_choice_events
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.eduai_privacy_choices from public, anon;
revoke all on public.eduai_privacy_choice_events from public, anon;
revoke insert, update, delete on public.eduai_privacy_choices from authenticated;
revoke insert, update, delete on public.eduai_privacy_choice_events from authenticated;
grant select on public.eduai_privacy_choices to authenticated;
grant select on public.eduai_privacy_choice_events to authenticated;

create or replace function public.record_eduai_privacy_choices(
  p_policy_version text,
  p_terms_acknowledged boolean,
  p_data_warning_acknowledged boolean,
  p_choices jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_birth_date text;
  v_is_minor boolean := false;
  v_ai_generation boolean;
  v_ai_documents boolean;
  v_ai_voice boolean;
  v_optional_analytics boolean;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Se requiere autenticación' using errcode = '28000';
  end if;
  if p_policy_version is distinct from '2026-10-11-v1'
     or p_terms_acknowledged is distinct from true
     or p_data_warning_acknowledged is distinct from true then
    raise exception 'Las condiciones y advertencias vigentes deben reconocerse explícitamente'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_choices) is distinct from 'object'
    or p_choices is null then
    raise exception 'Preferencias inválidas' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_choices) as k(key)
    where k.key not in ('ai_generation','ai_documents','ai_voice','optional_analytics')
  ) then
    raise exception 'Finalidad desconocida' using errcode = '22023';
  end if;

  -- Solo valores booleanos; ausencias equivalen a false.
  if exists (
    select 1 from jsonb_each(p_choices) as entry(key, val)
    where jsonb_typeof(entry.val) <> 'boolean'
  ) then
    raise exception 'Las finalidades opcionales deben ser booleanas' using errcode = '22023';
  end if;
  v_ai_generation := coalesce((p_choices ->> 'ai_generation')::boolean, false);
  v_ai_documents := coalesce((p_choices ->> 'ai_documents')::boolean, false);
  v_ai_voice := coalesce((p_choices ->> 'ai_voice')::boolean, false);
  v_optional_analytics := coalesce((p_choices ->> 'optional_analytics')::boolean, false);

  -- La fecha es solo autodeclarada y NO demuestra edad ni representación;
  -- no permite habilitar capacidades opcionales de menores en este flujo.
  select declared_birth_date::text
    into v_birth_date from public.family_age_status where user_id = v_user_id;
  if v_birth_date ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      v_is_minor := (v_birth_date::date > (current_date - interval '18 years')::date);
    exception when others then
      v_is_minor := true;
    end;
  else
    v_is_minor := true;
  end if;
  if v_is_minor and (v_ai_generation or v_ai_documents or v_ai_voice or v_optional_analytics) then
    raise exception 'Permisos opcionales de cuentas menores o sin edad validable requieren un proceso separado'
      using errcode = '22023';
  end if;

  v_snapshot := jsonb_build_object(
    'ai_generation', v_ai_generation,
    'ai_documents', v_ai_documents,
    'ai_voice', v_ai_voice,
    'optional_analytics', v_optional_analytics
  );

  insert into public.eduai_privacy_choices
    (user_id, policy_version, terms_acknowledged_at, data_warning_acknowledged_at,
     ai_generation, ai_documents, ai_voice, optional_analytics, updated_at)
  values
    (v_user_id, p_policy_version, now(), now(),
     v_ai_generation, v_ai_documents, v_ai_voice, v_optional_analytics, now())
  on conflict (user_id) do update set
    policy_version = excluded.policy_version,
    terms_acknowledged_at = excluded.terms_acknowledged_at,
    data_warning_acknowledged_at = excluded.data_warning_acknowledged_at,
    ai_generation = excluded.ai_generation,
    ai_documents = excluded.ai_documents,
    ai_voice = excluded.ai_voice,
    optional_analytics = excluded.optional_analytics,
    updated_at = excluded.updated_at;

  insert into public.eduai_privacy_choice_events
    (user_id, policy_version, choices, event_type, recorded_at)
  values
    (v_user_id, p_policy_version, v_snapshot, 'preferences_recorded', now());
end;
$$;

revoke all on function public.record_eduai_privacy_choices(text,boolean,boolean,jsonb) from public, anon;
grant execute on function public.record_eduai_privacy_choices(text,boolean,boolean,jsonb) to authenticated;

comment on table public.eduai_privacy_choices is 'EDUAI consent and necessary-terms acknowledgment; optional permissions default denied.';
comment on table public.eduai_privacy_choice_events is 'Append-only auditable user preference events; access restricted to user and trusted operators.';
