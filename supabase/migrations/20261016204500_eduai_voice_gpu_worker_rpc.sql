-- Temporary, single-profile, zero-shot voice GPU worker bridge.
-- Existing render-job table also stores short-lived worker sessions.
-- Do not grant database-table visibility to notebook clients; only these RPCs.
CREATE OR REPLACE FUNCTION public.eduai_voice_worker_claim(p_session_id uuid, p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE session_row public.audio_voice_render_jobs%ROWTYPE;
        queued public.audio_voice_render_jobs%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO session_row FROM public.audio_voice_render_jobs
   WHERE id=p_session_id AND provider IN ('kaggle-voice-bridge','colab-voice-bridge')
     AND status='starting'
     AND metadata->>'token_hash'=encode(extensions.digest(p_token,'sha256'),'hex')
     AND (metadata->>'expires_at')::timestamptz > now()
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'expired',true); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audio_voice_profiles v
    WHERE v.id=session_row.voice_profile_id AND v.user_id=session_row.user_id
      AND v.source_kind='self' AND v.deleted_at IS NULL
      AND v.sample_path IS NOT NULL AND v.consent_audio_path IS NOT NULL
      AND v.consent_confirmed AND v.authorization_confirmed
  ) THEN RETURN jsonb_build_object('ok',false); END IF;

  SELECT * INTO queued FROM public.audio_voice_render_jobs
   WHERE user_id=session_row.user_id AND voice_profile_id=session_row.voice_profile_id
     AND metadata->>'worker_session_id'=p_session_id::text
     AND provider=replace(session_row.provider,'-voice-bridge','-voice-worker')
     AND status='queued' AND created_at>now()-interval '55 minutes'
   ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'job',null); END IF;
  UPDATE public.audio_voice_render_jobs
   SET status='generating',stage='worker_generating',progress=15,updated_at=now()
   WHERE id=queued.id;
  RETURN jsonb_build_object('ok',true,'job',jsonb_build_object(
    'id',queued.id,'text',queued.text,
    'reference_url',queued.metadata->>'reference_url',
    'upload_url',queued.metadata->>'upload_url',
    'language_id','es'));
END $$;

CREATE OR REPLACE FUNCTION public.eduai_voice_worker_finish(
  p_session_id uuid, p_token text, p_job_id uuid, p_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sess public.audio_voice_render_jobs%ROWTYPE;
        job public.audio_voice_render_jobs%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO sess FROM public.audio_voice_render_jobs
    WHERE id=p_session_id AND provider IN ('kaggle-voice-bridge','colab-voice-bridge')
      AND status='starting'
      AND metadata->>'token_hash'=encode(extensions.digest(p_token,'sha256'),'hex')
      AND (metadata->>'expires_at')::timestamptz>now()
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO job FROM public.audio_voice_render_jobs
    WHERE id=p_job_id AND user_id=sess.user_id AND voice_profile_id=sess.voice_profile_id
      AND provider=replace(sess.provider,'-voice-bridge','-voice-worker')
      AND metadata->>'worker_session_id'=p_session_id::text
      AND status='generating'
    LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  IF p_error IS NOT NULL THEN
    UPDATE public.audio_voice_render_jobs
      SET status='failed',stage='worker_error',error=left(p_error,240),updated_at=now()
    WHERE id=job.id;
    RETURN jsonb_build_object('ok',true,'status','failed');
  END IF;
  -- Do not accept "complete" until Supabase Storage registered the signed upload.
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id='generated-voice-audio' AND so.name=job.audio_path
  ) THEN RETURN jsonb_build_object('ok',false,'error','audio_missing'); END IF;
  UPDATE public.audio_voice_render_jobs
    SET status='completed',stage='ready',progress=100,completed_at=now(),updated_at=now()
    WHERE id=job.id;
  RETURN jsonb_build_object('ok',true,'status','completed');
END $$;

REVOKE ALL ON FUNCTION public.eduai_voice_worker_claim(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eduai_voice_worker_finish(uuid,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eduai_voice_worker_claim(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eduai_voice_worker_finish(uuid,text,uuid,text) TO anon, authenticated;
