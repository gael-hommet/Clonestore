-- BLOC 3 — Conversion integration schema (runtime Postgres, NON Supabase REST).
--
-- À appliquer manuellement via `MIGRATIONS_FILTER=bloc3_conversion DATABASE_URL=...
-- npm run db:migrate:pg` sur l'opérateur. Le contrat exige une application explicite :
-- aucun apply automatique de SQL en CI.
--
-- Tables servent l'attribution opaque LeadForge→CloneStore + les sessions
-- de conversion + le ledger d'événements first-party. Aucune PII : pas d'email
-- de prospect, pas de SIREN exposé. Le token complet n'est jamais stocké —
-- seulement son fingerprint.
--
-- Toutes les tables sont écrites uniquement par l'application serveur ; le
-- navigateur ne lit jamais directement ces tables (pas de Supabase REST).
-- Les triggers append-only protègent l'historique de conversion.

BEGIN;

-- ── attribution_grants ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clonestore_bloc3_attribution_grants (
  id                       text PRIMARY KEY,
  token_id_hex             text NOT NULL UNIQUE,
  token_fingerprint        text NOT NULL UNIQUE,
  key_version              integer NOT NULL CHECK (key_version BETWEEN 1 AND 9),
  leadforge_prospect_id    text,
  campaign                 text NOT NULL,
  cohort                   text NOT NULL CHECK (cohort IN (
                              'COHORT_DIRECT_A','COHORT_DIRECT_B',
                              'COHORT_GATEWAY_A','COHORT_GATEWAY_B')),
  variant                  text NOT NULL CHECK (variant IN (
                              'VARIANT_DEPARTMENT_OUTCOME','VARIANT_PROOF_FIRST')),
  contact_kind             text NOT NULL CHECK (contact_kind IN ('DIRECT','GATEWAY')),
  segment                  text,
  email_tier               text,
  funnel_version           text NOT NULL,
  status                   text NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','expired','revoked')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL,
  revoked_at               timestamptz,
  last_resolved_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_b3_grants_cohort ON clonestore_bloc3_attribution_grants(cohort);
CREATE INDEX IF NOT EXISTS idx_b3_grants_variant ON clonestore_bloc3_attribution_grants(variant);
CREATE INDEX IF NOT EXISTS idx_b3_grants_status ON clonestore_bloc3_attribution_grants(status);

-- ── conversion_sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clonestore_bloc3_conversion_sessions (
  id                       uuid PRIMARY KEY,
  grant_id                 text REFERENCES clonestore_bloc3_attribution_grants(id) ON DELETE SET NULL,
  variant                  text NOT NULL CHECK (variant IN (
                              'VARIANT_DEPARTMENT_OUTCOME','VARIANT_PROOF_FIRST','VARIANT_ORGANIC')),
  campaign                 text,
  cohort                   text,
  contact_kind             text,
  funnel_version           text NOT NULL,
  stage                    text NOT NULL CHECK (stage IN (
                              'landed','demo_seen','diagnostic_in_progress','diagnostic_completed',
                              'checkout_pending','checkout_completed','onboarding','activated','expired')),
  user_id                  uuid,
  tenant_id                uuid,
  order_id                 text,
  diagnostic_draft_key     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_b3_sessions_user ON clonestore_bloc3_conversion_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_b3_sessions_tenant ON clonestore_bloc3_conversion_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_b3_sessions_grant ON clonestore_bloc3_conversion_sessions(grant_id);

-- ── conversion_events (append-only) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clonestore_bloc3_conversion_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               uuid NOT NULL REFERENCES clonestore_bloc3_conversion_sessions(id) ON DELETE CASCADE,
  event_id                 text NOT NULL,
  idempotency_key          text NOT NULL UNIQUE,
  variant                  text NOT NULL,
  server_timestamp         timestamptz NOT NULL DEFAULT now(),
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_b3_events_session ON clonestore_bloc3_conversion_events(session_id);
CREATE INDEX IF NOT EXISTS idx_b3_events_event ON clonestore_bloc3_conversion_events(event_id);

-- Append-only : refuse update/delete via trigger générique (réutilisable).
CREATE OR REPLACE FUNCTION clonestore_bloc3_forbid_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '0L000',
        MESSAGE = 'append-only: mutation interdite sur ' || TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_b3_events_no_update ON clonestore_bloc3_conversion_events;
CREATE TRIGGER trg_b3_events_no_update
  BEFORE UPDATE ON clonestore_bloc3_conversion_events
  FOR EACH ROW EXECUTE FUNCTION clonestore_bloc3_forbid_mutation();

DROP TRIGGER IF EXISTS trg_b3_events_no_delete ON clonestore_bloc3_conversion_events;
CREATE TRIGGER trg_b3_events_no_delete
  BEFORE DELETE ON clonestore_bloc3_conversion_events
  FOR EACH ROW EXECUTE FUNCTION clonestore_bloc3_forbid_mutation();

-- ── Permissions runtime ─────────────────────────────────────────────────────
-- L'application serveur utilise getRuntimeDb (rôle `pierre_rt_app` ou équivalent).
-- Le navigateur ne lit JAMAIS ces tables. Ces tables n'ont pas besoin d'être
-- exposées à Supabase REST ; on les laisse dans le schéma `public` (runtime PG).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pierre_rt_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON clonestore_bloc3_attribution_grants TO pierre_rt_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON clonestore_bloc3_conversion_sessions TO pierre_rt_app';
    -- Append-only : pas d'UPDATE/DELETE sur events. Le trigger l'interdit en plus.
    EXECUTE 'GRANT SELECT, INSERT ON clonestore_bloc3_conversion_events TO pierre_rt_app';
  END IF;
END $$;

-- Toutes les opérations REST publiques sont refusées par défaut : les tables
-- restent inaccessibles depuis le navigateur.

COMMIT;
