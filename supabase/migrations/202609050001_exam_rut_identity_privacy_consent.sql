-- Trazabilidad del consentimiento de privacidad en evaluaciones EduAI.
alter table public.exam_attempt_drafts
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_consent_version text;

alter table public.exam_submissions
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_consent_version text;

comment on column public.exam_attempt_drafts.privacy_consent_at is
  'Momento en que el estudiante aceptó el aviso de privacidad al iniciar o reanudar la evaluación.';
comment on column public.exam_attempt_drafts.privacy_consent_version is
  'Versión del aviso de privacidad aceptado por el estudiante.';
comment on column public.exam_submissions.privacy_consent_at is
  'Consentimiento de privacidad asociado a la entrega de la evaluación.';
comment on column public.exam_submissions.privacy_consent_version is
  'Versión del aviso de privacidad asociada a la entrega de la evaluación.';
