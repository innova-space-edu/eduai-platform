-- Align the database constraint with the statuses already used by Video Studio.
alter table public.video_jobs
  drop constraint if exists video_jobs_status_check;

alter table public.video_jobs
  add constraint video_jobs_status_check
  check (status = any (array[
    'queued'::text,
    'processing'::text,
    'completed'::text,
    'failed'::text,
    'blocked'::text,
    'canceled'::text
  ]));
