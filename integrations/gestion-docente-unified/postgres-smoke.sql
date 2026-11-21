-- Integration tests on a DISPOSABLE PostgreSQL 17 CI service only.
-- Requires both Dell PostgreSQL draft files. Never point at a live database.
\set ON_ERROR_STOP on
INSERT INTO gestion.schools(id,name,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Colegio de prueba A','active'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Colegio de prueba B','active');
INSERT INTO gestion.memberships(school_id,user_id,group_key,status,expires_at,approved_by) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','administrativos','active','2099-01-01','11111111-1111-4111-8111-111111111111'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','pie','active','2099-01-01','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','administrativos','active','2099-01-01','33333333-3333-4333-8333-333333333333');
INSERT INTO gestion.folders(id,school_id,owner_id,title,depth) VALUES
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','Carpeta PIE',0);
INSERT INTO gestion.storage_quotas(school_id,hard_limit_bytes,used_bytes,reserved_bytes)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,0,40);
DO $$
BEGIN
  -- Cross-school folder owner must be rejected by composite FK.
  BEGIN
    INSERT INTO gestion.folders(id,school_id,owner_id,title,depth) VALUES
    ('55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Incorrecta',0);
    RAISE EXCEPTION 'CROSS_SCHOOL_FOLDER_OWNER_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Cross-school upload reservation must be rejected by composite FK.
  BEGIN
    INSERT INTO gestion.upload_reservations(id,school_id,owner_id,folder_id,idempotency_key,size_bytes,expires_at)
    VALUES ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
      'reservation-cross-school-0001',10,now()+interval '1 hour');
    RAISE EXCEPTION 'CROSS_SCHOOL_RESERVATION_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Cannot exceed a school's quota.
  BEGIN
    UPDATE gestion.storage_quotas SET reserved_bytes=101 WHERE school_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'QUOTA_OVERFLOW_ACCEPTED';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- No duplicate idempotency key.
  INSERT INTO gestion.upload_reservations(id,school_id,owner_id,folder_id,idempotency_key,size_bytes,expires_at)
  VALUES ('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',
    'reservation-valid-00001',10,now()+interval '1 hour');
  BEGIN
    INSERT INTO gestion.upload_reservations(id,school_id,owner_id,folder_id,idempotency_key,size_bytes,expires_at)
    VALUES ('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',
      'reservation-valid-00001',10,now()+interval '1 hour');
    RAISE EXCEPTION 'IDEMPOTENCY_DUPLICATE_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- Tables must be fail-closed for a regular non-privileged database role.
DO $$
DECLARE count_tables int;
BEGIN
 SELECT COUNT(*) INTO count_tables FROM pg_tables WHERE schemaname='gestion' AND rowsecurity;
 IF count_tables<>16 THEN
   RAISE EXCEPTION 'RLS_NOT_ENABLED_ON_ALL_TABLES: %',count_tables;
 END IF;
END $$;
CREATE ROLE gestion_ci_unprivileged NOLOGIN;
GRANT USAGE ON SCHEMA gestion TO gestion_ci_unprivileged;
GRANT SELECT ON gestion.schools,gestion.memberships,gestion.folders,
  gestion.upload_reservations,gestion.storage_quotas TO gestion_ci_unprivileged;
SET ROLE gestion_ci_unprivileged;
DO $$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM gestion.schools;
 IF n<>0 THEN RAISE EXCEPTION 'RLS_LEAK_SCHOOLS: %', n; END IF;
 SELECT count(*) INTO n FROM gestion.memberships;
 IF n<>0 THEN RAISE EXCEPTION 'RLS_LEAK_MEMBERS: %', n; END IF;
 SELECT count(*) INTO n FROM gestion.folders;
 IF n<>0 THEN RAISE EXCEPTION 'RLS_LEAK_FOLDERS: %', n; END IF;
 SELECT count(*) INTO n FROM gestion.storage_quotas;
 IF n<>0 THEN RAISE EXCEPTION 'RLS_LEAK_QUOTAS: %', n; END IF;
END $$;
RESET ROLE;
SELECT 'GESTION_POSTGRES_SMOKE_OK' AS result;
