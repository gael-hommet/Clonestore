-- supabase/migrations/2026-06-26_09__clonestory_fp_scale_indexes.sql
-- CLONESTORY — FINAL PUBLIC : index de mise à l'échelle (chemins chauds multi-comptes).
--
-- ADDITIF, IDEMPOTENT, NON destructif. PostgreSQL 17 / PGlite compatible.
-- Filtre migrator : clonestory_fp. ORDRE : après _08.
-- Ajoute les index manquants sur les requêtes exécutées à CHAQUE trafic réel, pour
-- éviter un balayage séquentiel quand le nombre de partenaires/introductions grandit :
--   1. résolution d'attribution par e-mail prospect (à chaque capture de compte /profile) ;
--   2. résolution de contribution par PaymentIntent / Invoice (remboursements & litiges).
-- Aucune RLS/politique à ajouter (les index n'ont pas de politique). Aucune donnée touchée.
--
-- ACTIVATION PRODUCTION (contrôlée, séparée) :
--   MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
-- ROLLBACK :
--   drop index if exists idx_csy_intro_prospect_email;
--   drop index if exists idx_csy_cc_payment_intent;
--   drop index if exists idx_csy_cc_invoice;

-- 1) Lookup d'introduction par e-mail prospect normalisé (capture d'attribution). L'unique
--    composite (partner_id, prospect_email_normalized) ne couvre PAS un prédicat mono-colonne.
create index if not exists idx_csy_intro_prospect_email
  on clonestory_fp_introductions(prospect_email_normalized)
  where prospect_email_normalized is not null;

-- 2) Résolution de contribution par référence Stripe (remboursement / litige) sans abonnement.
create index if not exists idx_csy_cc_payment_intent
  on clonestory_fp_commercial_contributions(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists idx_csy_cc_invoice
  on clonestory_fp_commercial_contributions(stripe_invoice_id)
  where stripe_invoice_id is not null;
