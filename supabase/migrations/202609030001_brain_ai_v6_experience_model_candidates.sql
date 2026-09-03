-- Brain AI V6 persistent laboratory store + model candidate evaluation queue.
-- Dream hypotheses remain isolated from factual memory and production promotion.

create table if not exists public.brain_ai_v6_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  mode text not null check (mode in ('SHADOW','REFLECTION','SLEEP','DREAM','EVALUATION')),
  readiness real not null check (readiness >= 0 and readiness <= 1),
  gate_snapshot jsonb not null default '[]'::jsonb,
  experience_count integer not null default 0 check (experience_count >= 0),
  reflection_count integer not null default 0 check (reflection_count >= 0),
  dream_count integer not null default 0 check (dream_count >= 0),
  skill_candidate_count integer not null default 0 check (skill_candidate_count >= 0),
  production_write_allowed boolean not null default false check (production_write_allowed = false),
  model_weight_update_allowed boolean not null default false check (model_weight_update_allowed = false),
  created_at timestamptz not null default now()
);

create table if not exists public.brain_ai_v6_experiences (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.brain_ai_v6_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id text not null,
  intent text not null,
  route text not null,
  modalities text[] not null default '{}',
  locality text not null,
  complexity real not null check (complexity >= 0 and complexity <= 1),
  confidence real not null check (confidence >= 0 and confidence <= 1),
  gate_pass_rate real not null check (gate_pass_rate >= 0 and gate_pass_rate <= 1),
  plan_length integer not null default 0 check (plan_length >= 0),
  production_stage text not null,
  source_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (cycle_id, trace_id)
);

create table if not exists public.brain_ai_v6_reflections (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.brain_ai_v6_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id text not null,
  kind text not null check (kind in ('reinforce','repair')),
  observation text not null,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.brain_ai_v6_dream_hypotheses (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.brain_ai_v6_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dream_key text not null,
  based_on_experience_ids text[] not null default '{}',
  intent text not null,
  hypothesis text not null,
  counterfactual text not null,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  origin text not null default 'simulated' check (origin = 'simulated'),
  truth_status text not null default 'hypothesis' check (truth_status = 'hypothesis'),
  eligible_for_fact_memory boolean not null default false check (eligible_for_fact_memory = false),
  eligible_for_production_promotion boolean not null default false check (eligible_for_production_promotion = false),
  created_at timestamptz not null default now(),
  unique (cycle_id, dream_key)
);

create table if not exists public.brain_ai_v6_skill_candidates (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.brain_ai_v6_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_key text not null,
  intent text not null,
  route text not null,
  evidence_count integer not null check (evidence_count >= 1),
  average_gate_pass_rate real not null check (average_gate_pass_rate >= 0 and average_gate_pass_rate <= 1),
  average_confidence real not null check (average_confidence >= 0 and average_confidence <= 1),
  stage text not null default 'candidate' check (stage = 'candidate'),
  production_promotion_allowed boolean not null default false check (production_promotion_allowed = false),
  created_at timestamptz not null default now(),
  unique (cycle_id, skill_key)
);

create index if not exists brain_ai_v6_cycles_user_generated_idx on public.brain_ai_v6_cycles(user_id, generated_at desc);
create index if not exists brain_ai_v6_experiences_user_trace_idx on public.brain_ai_v6_experiences(user_id, trace_id);
create index if not exists brain_ai_v6_reflections_cycle_idx on public.brain_ai_v6_reflections(cycle_id);
create index if not exists brain_ai_v6_dreams_cycle_idx on public.brain_ai_v6_dream_hypotheses(cycle_id);
create index if not exists brain_ai_v6_skills_cycle_idx on public.brain_ai_v6_skill_candidates(cycle_id);

alter table public.brain_ai_v6_cycles enable row level security;
alter table public.brain_ai_v6_experiences enable row level security;
alter table public.brain_ai_v6_reflections enable row level security;
alter table public.brain_ai_v6_dream_hypotheses enable row level security;
alter table public.brain_ai_v6_skill_candidates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brain_ai_v6_cycles' and policyname='brain_ai_v6_cycles_select_own') then
    create policy brain_ai_v6_cycles_select_own on public.brain_ai_v6_cycles for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brain_ai_v6_experiences' and policyname='brain_ai_v6_experiences_select_own') then
    create policy brain_ai_v6_experiences_select_own on public.brain_ai_v6_experiences for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brain_ai_v6_reflections' and policyname='brain_ai_v6_reflections_select_own') then
    create policy brain_ai_v6_reflections_select_own on public.brain_ai_v6_reflections for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brain_ai_v6_dream_hypotheses' and policyname='brain_ai_v6_dreams_select_own') then
    create policy brain_ai_v6_dreams_select_own on public.brain_ai_v6_dream_hypotheses for select using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='brain_ai_v6_skill_candidates' and policyname='brain_ai_v6_skills_select_own') then
    create policy brain_ai_v6_skills_select_own on public.brain_ai_v6_skill_candidates for select using ((select auth.uid()) = user_id);
  end if;
end $$;

create table if not exists public.ai_model_candidates (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  label text not null,
  capabilities text[] not null default '{}',
  source_url text,
  release_channel text not null default 'unknown' check (release_channel in ('stable','preview','experimental','unknown')),
  status text not null default 'discovered' check (status in ('discovered','queued','testing','validated','rejected','implemented')),
  priority integer not null default 100,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, model)
);

create table if not exists public.ai_model_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.ai_model_candidates(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  suite text not null default 'model-lab-smoke',
  status text not null default 'queued' check (status in ('queued','running','passed','failed','blocked')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  quality_score real check (quality_score is null or (quality_score >= 0 and quality_score <= 1)),
  reliability_score real check (reliability_score is null or (reliability_score >= 0 and reliability_score <= 1)),
  cost_score real check (cost_score is null or (cost_score >= 0 and cost_score <= 1)),
  notes text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_model_candidates_status_priority_idx on public.ai_model_candidates(status, priority, provider, model);
create index if not exists ai_model_evaluations_candidate_created_idx on public.ai_model_evaluations(candidate_id, created_at desc);

alter table public.ai_model_candidates enable row level security;
alter table public.ai_model_evaluations enable row level security;

-- Initial candidate queue from official Google Gemini and Groq model catalogs checked 2026-09-03.
insert into public.ai_model_candidates(provider, model, label, capabilities, source_url, release_channel, status, priority, metadata)
values
  ('google','gemini-3.8-flash','Gemini 3.8 Flash',array['text','structured','vision','long_context','code','agentic'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',5,'{"catalog_checked":"2026-09-03","reason":"newest stable Flash"}'::jsonb),
  ('google','gemini-3.7-flash','Gemini 3.7 Flash',array['text','structured','vision','long_context','code','agentic'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',10,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('google','gemini-3.5-flash','Gemini 3.5 Flash',array['text','structured','vision','long_context'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',20,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('google','gemini-3.1-flash-lite','Gemini 3.1 Flash-Lite',array['text','structured','vision','long_context'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',30,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('google','gemini-3.1-flash-lite-image','Nano Banana 2 Lite',array['image'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',30,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('google','gemini-omni-1.1-flash','Gemini Omni Flash',array['video','audio','image','editing'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',15,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('google','gemini-3.5-transcribe','Gemini 3.5 Transcribe',array['audio','transcription'],'https://ai.google.dev/gemini-api/docs/models','stable','queued',20,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('google','gemini-3.1-flash-tts-preview','Gemini 3.1 Flash TTS',array['audio','tts'],'https://ai.google.dev/gemini-api/docs/models','preview','discovered',40,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','openai/gpt-oss-120b','GPT OSS 120B · Groq',array['text','structured','long_context','code','reasoning','tools'],'https://console.groq.com/docs/models','stable','queued',5,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','openai/gpt-oss-20b','GPT OSS 20B · Groq',array['text','structured','long_context','code','reasoning','tools'],'https://console.groq.com/docs/models','stable','queued',10,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','groq/compound-mini','Groq Compound Mini',array['research','tools','text'],'https://console.groq.com/docs/models','stable','queued',20,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','whisper-large-v3-turbo','Whisper Large V3 Turbo',array['audio','transcription'],'https://console.groq.com/docs/models','stable','queued',20,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','qwen/qwen3.8-27b','Qwen 3.8 27B · Groq',array['text','structured','long_context','code','reasoning'],'https://console.groq.com/docs/models','preview','discovered',25,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','qwen/qwen3.6-27b','Qwen 3.6 27B · Groq',array['text','structured','long_context','code','reasoning'],'https://console.groq.com/docs/models','preview','discovered',30,'{"catalog_checked":"2026-09-03"}'::jsonb),
  ('groq','meta-llama/llama-prompt-guard-2-86m','Llama Prompt Guard 2 86M',array['safety','classification'],'https://console.groq.com/docs/models','preview','discovered',35,'{"catalog_checked":"2026-09-03","purpose":"safety gate"}'::jsonb),
  ('groq','minimaxai/minimax-m2.7','MiniMax M2.7 · Groq',array['text','structured','long_context','code','reasoning'],'https://console.groq.com/docs/models','preview','discovered',45,'{"catalog_checked":"2026-09-03"}'::jsonb)
on conflict (provider, model) do update set
  label = excluded.label,
  capabilities = excluded.capabilities,
  source_url = excluded.source_url,
  release_channel = excluded.release_channel,
  priority = excluded.priority,
  metadata = public.ai_model_candidates.metadata || excluded.metadata,
  updated_at = now();

-- Mark models already present in the production registry as implemented in the lab queue.
insert into public.ai_model_candidates(provider, model, label, capabilities, release_channel, status, priority, metadata)
select provider, model, coalesce(label, model), capabilities, 'unknown', 'implemented', priority, jsonb_build_object('synced_from','ai_provider_models')
from public.ai_provider_models
on conflict (provider, model) do update set
  status = 'implemented',
  label = excluded.label,
  capabilities = excluded.capabilities,
  metadata = public.ai_model_candidates.metadata || excluded.metadata,
  updated_at = now();
