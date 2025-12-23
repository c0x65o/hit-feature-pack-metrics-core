-- Feature Pack: metrics-core
-- Seed "core" user segments that other packs (auth-core, vault ACL, dashboards) can depend on.
--
-- These segments are NOT app-specific:
-- - segment.user.everyone
-- - segment.user.admins
-- - segment.user.unverified
-- - segment.user.locked
--
-- NOTE: This migration runs inside the app database (hit-dashboard DB) because `metrics_segments`
-- lives there. Segment evaluation for user attributes queries the auth database at runtime.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'metrics_segments'
  ) THEN
    RAISE EXCEPTION 'Table metrics_segments does not exist. Run migrations first!';
  END IF;
END $$;

INSERT INTO "metrics_segments" (
  "id",
  "key",
  "entity_kind",
  "label",
  "description",
  "rule",
  "is_active",
  "created_at",
  "updated_at"
)
VALUES
  (
    'seg_core_user_everyone',
    'segment.user.everyone',
    'user',
    'Everyone',
    'All users.',
    '{"kind":"all_entities"}'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'seg_core_user_admins',
    'segment.user.admins',
    'user',
    'Admin Users',
    'Users whose role is admin.',
    '{"kind":"entity_attribute","attribute":"role","op":"==","value":"admin"}'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'seg_core_user_unverified',
    'segment.user.unverified',
    'user',
    'Unverified Users',
    'Users who have not verified their email address.',
    '{"kind":"entity_attribute","attribute":"email_verified","op":"==","value":false}'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'seg_core_user_locked',
    'segment.user.locked',
    'user',
    'Locked Users',
    'Users whose account is locked.',
    '{"kind":"entity_attribute","attribute":"locked","op":"==","value":true}'::jsonb,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT ("key") DO UPDATE SET
  "entity_kind" = EXCLUDED."entity_kind",
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "rule" = EXCLUDED."rule",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = EXCLUDED."updated_at";


