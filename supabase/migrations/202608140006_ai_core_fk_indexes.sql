-- Índices de soporte para claves foráneas del nuevo AI Core.
-- Reducen scans innecesarios en borrados/cascadas y eliminan warnings del Advisor
-- sin tocar todavía las tablas legacy de EduAI.

create index if not exists ai_generation_cache_asset_id_idx
  on public.ai_generation_cache (asset_id)
  where asset_id is not null;

create index if not exists ai_generation_requests_asset_id_idx
  on public.ai_generation_requests (asset_id)
  where asset_id is not null;

create index if not exists eduai_assets_generation_request_id_idx
  on public.eduai_assets (generation_request_id)
  where generation_request_id is not null;

create index if not exists eduai_assets_parent_asset_id_idx
  on public.eduai_assets (parent_asset_id)
  where parent_asset_id is not null;

create index if not exists video_jobs_asset_id_idx
  on public.video_jobs (asset_id)
  where asset_id is not null;
