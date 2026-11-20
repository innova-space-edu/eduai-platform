-- Preserve the exact question definitions for every submitted answer.
-- Backfill before allowing edits to forms with existing submissions.
ALTER TABLE public.eduai_form_responses
  ADD COLUMN IF NOT EXISTS questions_snapshot jsonb;

UPDATE public.eduai_form_responses AS r
SET questions_snapshot = f.questions
FROM public.eduai_forms AS f
WHERE r.form_id = f.id
  AND r.questions_snapshot IS NULL;

ALTER TABLE public.eduai_form_responses
  ALTER COLUMN questions_snapshot SET NOT NULL;

DO $history$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eduai_form_responses_snapshot_check'
      AND conrelid = 'public.eduai_form_responses'::regclass
  ) THEN
    ALTER TABLE public.eduai_form_responses
      ADD CONSTRAINT eduai_form_responses_snapshot_check
      CHECK (
        jsonb_typeof(questions_snapshot) = 'array'
        AND jsonb_array_length(questions_snapshot) <= 60
        AND octet_length(questions_snapshot::text) < 300000
      );
  END IF;
END
$history$;

-- Only the service-role submission endpoint can insert replies. Capture
-- the validated published question version for each incoming response.
CREATE OR REPLACE FUNCTION public.eduai_capture_questions_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $capture$
BEGIN
  IF NEW.questions_snapshot IS NULL THEN
    SELECT f.questions INTO NEW.questions_snapshot
    FROM public.eduai_forms f WHERE f.id = NEW.form_id;
  END IF;
  IF NEW.questions_snapshot IS NULL THEN
    RAISE EXCEPTION 'No se pudo guardar el historial de preguntas para esta respuesta.';
  END IF;
  RETURN NEW;
END
$capture$;

REVOKE ALL ON FUNCTION public.eduai_capture_questions_snapshot() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS eduai_form_responses_snapshot_trg ON public.eduai_form_responses;
CREATE TRIGGER eduai_form_responses_snapshot_trg
BEFORE INSERT ON public.eduai_form_responses
FOR EACH ROW EXECUTE FUNCTION public.eduai_capture_questions_snapshot();

-- Question edits are now safe: earlier answers retain their own immutable
-- question snapshot. Continue blocking edits if legacy snapshots are missing.
CREATE OR REPLACE FUNCTION public.eduai_lock_form_questions_after_response()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $guard$
BEGIN
  IF OLD.questions IS DISTINCT FROM NEW.questions
     AND EXISTS (
       SELECT 1 FROM public.eduai_form_responses r
       WHERE r.form_id = OLD.id AND r.questions_snapshot IS NULL
     )
  THEN
    RAISE EXCEPTION 'Este formulario tiene respuestas sin historial de preguntas y aún no puede editarse.';
  END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION public.eduai_lock_form_questions_after_response() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.eduai_form_responses.questions_snapshot
IS 'Preguntas exactas vigentes al enviar la respuesta; permite editar formularios publicados sin reinterpretar respuestas históricas.';
