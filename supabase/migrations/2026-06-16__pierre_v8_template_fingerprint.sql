-- supabase/migrations/2026-06-16__pierre_v8_template_fingerprint.sql
-- PHASE 8.3-B2C §5 — approval fingerprint binding for template versions. Idempotent.
alter table pierre_rt_document_template_versions add column if not exists schema_hash text;
alter table pierre_rt_document_template_versions add column if not exists approved_fingerprint text;
alter table pierre_rt_document_template_versions add column if not exists locale text not null default 'fr-FR';
alter table pierre_rt_document_template_versions add column if not exists jurisdiction text not null default 'FR';
