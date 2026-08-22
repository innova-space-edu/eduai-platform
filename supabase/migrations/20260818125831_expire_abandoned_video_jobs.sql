begin;

-- Un job que nunca comenzó no debe disparar una generación días/meses después.
-- Se conserva el registro para auditoría, pero se cierra como fallido tras 24h.
update public.video_jobs
set status = 'failed',
    error_message = case
      when nullif(btrim(coalesce(error_message, '')), '') is not null then error_message
      else 'La solicitud de video expiró antes de iniciar. Vuelve a generar el video para crear una solicitud nueva.'
    end,
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
where status = 'queued'
  and created_at < now() - interval '24 hours'
  and started_at is null
  and operation_name is null
  and provider_request_id is null;

commit;
