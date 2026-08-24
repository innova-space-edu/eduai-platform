begin;

create or replace function public.capture_ai_generation_provider_health()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_key text;
  health_status text;
begin
  if new.status not in ('completed', 'failed')
     or new.provider is null
     or btrim(new.provider) = ''
     or new.status = 'reused' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.provider is not distinct from old.provider
     and new.model is not distinct from old.model
     and new.latency_ms is not distinct from old.latency_ms then
    return new;
  end if;

  provider_key := case
    when lower(btrim(new.provider)) in ('google', 'gemini', 'google gemini') then 'google'
    when lower(btrim(new.provider)) like 'groq%' then 'groq'
    when lower(btrim(new.provider)) like 'openrouter%' then 'openrouter'
    when lower(btrim(new.provider)) like 'together%' then 'together'
    when lower(btrim(new.provider)) like 'cerebras%' then 'cerebras'
    else lower(regexp_replace(btrim(new.provider), '[^a-zA-Z0-9._-]+', '-', 'g'))
  end;

  health_status := case when new.status = 'completed' then 'healthy' else 'degraded' end;

  insert into public.ai_provider_health (
    provider,
    model,
    capability,
    status,
    latency_ms,
    error_code,
    metadata,
    checked_at
  ) values (
    provider_key,
    new.model,
    new.capability,
    health_status,
    new.latency_ms,
    case when new.status = 'failed' then 'generation_failed' else null end,
    jsonb_build_object('source', 'ai_generation_requests'),
    coalesce(new.completed_at, now())
  );

  return new;
end;
$$;

revoke execute on function public.capture_ai_generation_provider_health() from public, anon;
grant execute on function public.capture_ai_generation_provider_health() to authenticated, service_role;

drop trigger if exists ai_generation_requests_provider_health on public.ai_generation_requests;
create trigger ai_generation_requests_provider_health
after insert or update of status, provider, model, latency_ms
on public.ai_generation_requests
for each row
execute function public.capture_ai_generation_provider_health();

-- Backfill no sensible de generaciones históricas ya completadas. No copia prompts,
-- request_json, response_metadata ni respuestas; solo identidad técnica y latencia.
insert into public.ai_provider_health (
  provider,
  model,
  capability,
  status,
  latency_ms,
  error_code,
  metadata,
  checked_at
)
select
  case
    when lower(btrim(r.provider)) in ('google', 'gemini', 'google gemini') then 'google'
    when lower(btrim(r.provider)) like 'groq%' then 'groq'
    when lower(btrim(r.provider)) like 'openrouter%' then 'openrouter'
    when lower(btrim(r.provider)) like 'together%' then 'together'
    when lower(btrim(r.provider)) like 'cerebras%' then 'cerebras'
    else lower(regexp_replace(btrim(r.provider), '[^a-zA-Z0-9._-]+', '-', 'g'))
  end,
  r.model,
  r.capability,
  'healthy',
  r.latency_ms,
  null,
  jsonb_build_object('source', 'ai_generation_requests', 'backfill', true),
  coalesce(r.completed_at, r.updated_at, r.created_at, now())
from public.ai_generation_requests r
where r.status = 'completed'
  and r.provider is not null
  and btrim(r.provider) <> ''
  and not exists (
    select 1
    from public.ai_provider_health h
    where h.metadata ->> 'source' = 'ai_generation_requests'
      and h.provider = case
        when lower(btrim(r.provider)) in ('google', 'gemini', 'google gemini') then 'google'
        when lower(btrim(r.provider)) like 'groq%' then 'groq'
        when lower(btrim(r.provider)) like 'openrouter%' then 'openrouter'
        when lower(btrim(r.provider)) like 'together%' then 'together'
        when lower(btrim(r.provider)) like 'cerebras%' then 'cerebras'
        else lower(regexp_replace(btrim(r.provider), '[^a-zA-Z0-9._-]+', '-', 'g'))
      end
      and h.model is not distinct from r.model
      and h.capability is not distinct from r.capability
      and h.checked_at = coalesce(r.completed_at, r.updated_at, r.created_at, now())
  );

commit;
