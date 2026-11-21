-- GESTION DOCENTE Dell PostgreSQL 17 — RESERVATIONS / DURABILITY CANDIDATE
-- REVIEW ONLY; NEVER RUN ON LIVE Dell DB; no production changes.
-- Must be executed after DELL_POSTGRES_GESTION_DRAFT.sql on a disposable PostgreSQL.
BEGIN;
CREATE TABLE gestion.storage_quotas (
  school_id uuid PRIMARY KEY REFERENCES gestion.schools(id) ON DELETE RESTRICT,
  hard_limit_bytes bigint NOT NULL CHECK(hard_limit_bytes>0),
  used_bytes bigint NOT NULL DEFAULT 0 CHECK(used_bytes>=0),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(used_bytes+reserved_bytes<=hard_limit_bytes)
);
CREATE TABLE gestion.upload_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  folder_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 100
      AND idempotency_key ~ '^[a-zA-Z0-9._:-]+$'),
  size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520),
  state text NOT NULL DEFAULT 'reserved'
      CHECK(state IN ('reserved','ready','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  committed_at timestamptz,
  digest_sha256 text CHECK(digest_sha256 ~ '^[a-f0-9]{64}$'),
  file_id uuid,
  FOREIGN KEY(school_id) REFERENCES gestion.storage_quotas(school_id),
  FOREIGN KEY(school_id,owner_id) REFERENCES gestion.memberships(school_id,user_id),
  FOREIGN KEY(school_id,folder_id) REFERENCES gestion.folders(school_id,id),
  FOREIGN KEY(school_id,file_id) REFERENCES gestion.file_objects(school_id,id),
  UNIQUE(school_id,owner_id,idempotency_key),
  UNIQUE(school_id,id),
  CHECK(expires_at>created_at),
  CHECK((state='ready' AND digest_sha256 IS NOT NULL
         AND file_id IS NOT NULL AND committed_at IS NOT NULL)
        OR (state<>'ready' AND committed_at IS NULL))
);
CREATE INDEX upload_reservations_expiring ON gestion.upload_reservations
  (school_id,expires_at) WHERE state='reserved';
CREATE INDEX upload_reservations_user ON gestion.upload_reservations
  (school_id,owner_id,state,created_at DESC);
CREATE TABLE gestion.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  task_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  previous_state text NOT NULL,
  next_state text NOT NULL,
  previous_revision integer NOT NULL CHECK(previous_revision>=0),
  new_revision integer NOT NULL CHECK(new_revision=previous_revision+1),
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(school_id,task_id,recipient_id)
    REFERENCES gestion.task_recipients(school_id,task_id,user_id),
  FOREIGN KEY(school_id,actor_id)
    REFERENCES gestion.memberships(school_id,user_id),
  CHECK(next_state IN ('submitted','returned','approved','cancelled'))
);
CREATE INDEX review_events_history ON gestion.review_events
  (school_id,task_id,recipient_id,created_at DESC);
CREATE TABLE gestion.storage_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES gestion.schools(id),
  object_id uuid NOT NULL,
  discrepancy text NOT NULL
    CHECK(discrepancy IN ('object_without_manifest','manifest_without_object',
                          'db_record_without_object','object_without_db_record',
                          'hash_or_tag_mismatch','quota_counter_mismatch')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  FOREIGN KEY(school_id,resolved_by)
    REFERENCES gestion.memberships(school_id,user_id)
);
CREATE UNIQUE INDEX storage_reconciliation_open_unique ON gestion.storage_reconciliation
  (school_id,object_id,discrepancy) WHERE resolved_at IS NULL;
-- All tables remain fail-closed, with no direct API role grants or write policies.
ALTER TABLE gestion.storage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion.upload_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion.review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion.storage_reconciliation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON gestion.storage_quotas,gestion.upload_reservations,
  gestion.review_events,gestion.storage_reconciliation FROM PUBLIC;
-- A dedicated audited server role + server-side functions are required before use.
COMMIT;
