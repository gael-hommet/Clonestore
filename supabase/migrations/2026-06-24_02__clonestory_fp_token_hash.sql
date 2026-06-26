-- supabase/migrations/2026-06-24_02__clonestory_fp_token_hash.sql
-- CLONESTORY — durcissement (PASS FINAL DE SÉCURITÉ). Additif et idempotent.
--   - Le lien personnel n'est plus conservé en clair : seul son HASH est persisté
--     (link_token_hash). Le token brut est montré une seule fois au membre.
--   - Le code personnel garde une représentation normalisée affichable, mais le
--     LOOKUP passe désormais par code_lookup_hash (hash du code normalisé).
--   - status_before_suspension : restaure le vrai statut à la réactivation.
-- Filtre migrator : clonestory_fp.

alter table clonestory_fp_partners add column if not exists link_token_hash text;
alter table clonestory_fp_partners add column if not exists code_lookup_hash text;
alter table clonestory_fp_partners add column if not exists status_before_suspension text;

create unique index if not exists uq_csy_partner_link_hash on clonestory_fp_partners(link_token_hash) where link_token_hash is not null;
create unique index if not exists uq_csy_partner_code_hash on clonestory_fp_partners(code_lookup_hash) where code_lookup_hash is not null;

-- Le token brut ne doit plus jamais être stocké en clair : on neutralise les
-- éventuelles valeurs héritées (sécurité défensive ; aucune donnée de preuve perdue).
update clonestory_fp_partners set link_token = null where link_token is not null;
