# CloneStory — BLOC 2 : Ouverture réelle des inscriptions & moteur de contribution vérifiée

Les inscriptions au **Cercle des Partenaires Fondateurs** sont **ouvertes immédiatement** (avant le lancement commercial de Pierre, le 5 août). À l'inscription, une personne devient **Membre du Cercle Fondateur**. Le titre **Partenaire Fondateur de CloneStore**, le numéro de registre définitif et l'apparition au registre public n'arrivent qu'**après une première contribution réelle et vérifiée**.

## 1. Parcours livré (fonctionnel, prouvé en navigateur)

`découverte → /join → email de vérification → /verify (session ouverte) → « Mon Registre » → lien + code personnels → « Faire une introduction » (< 2 min) → le prospect confirme → introduction confirmée + historique → branche rattachée.`

Prouvé bout-en-bout dans un vrai navigateur contre un vrai Postgres (captures : `docs/clonestory/visual-proof/bloc2/`).

## 2. Base de données (réelle, RLS, append-only)

Migration `supabase/migrations/2026-06-24_01__clonestory_fp_founding_partners.sql` (+ `2026-06-24_02__clonestory_fp_token_hash.sql`, filtre migrator `clonestory_fp`) — Postgres runtime, jamais exposé via REST Supabase :

- `clonestory_fp_partners` — membres (statut, lien/code, `introduced_by_partner_id` = origine de branche, `registry_number` alloué seulement à la vérification, `verification_token_hash`).
- `clonestory_fp_introductions` — introductions (méthode, statut, `company_fingerprint` haché, `confirm_token_hash`, horodatages).
- `clonestory_fp_contribution_events` *(append-only)* — seule source des chiffres.
- `clonestory_fp_link_usage` *(append-only)* — journal d'usage des liens/codes.
- `clonestory_fp_admin_audit` *(append-only)* — toute action admin (raison + ancien/nouvel état).
- `clonestory_fp_withdrawals` — demandes de retrait (RGPD).

**Isolation réelle** : RLS **FORCÉE** + politiques pilotées par GUC. Tout accès passe par `withService` (code serveur de confiance) ou `withPartner` (lecture « Mon Registre » — ne voit QUE les lignes du membre). Chaque transaction fait `set local role pierre_rt_app` → RLS appliquée même si la connexion est superuser (test ET prod). Une transaction du rôle restreint sans GUC ne voit **rien** (fail-closed). Append-only structurel : `revoke update/delete` + trigger `clonestory_forbid_mutation`. Secrets (vérification, confirmation) stockés en **hash** uniquement ; lien/code = identifiants partageables (en clair, uniques, révocables).

## 3. Attribution

- **Directe** : une introduction confirmée crédite **un seul** membre direct ; première attribution valide avant l'achat ; conflit d'entreprise → **revue manuelle** (statut `disputed`), jamais d'attribution automatique.
- **Réseau** : l'origine de branche (`introduced_by_partner_id`) et l'impact de réseau (introductions confirmées des descendants) sont reconnus **séparément**, sans retirer le mérite direct. Cas Jérémie/Paul prouvé (intégration) : Paul direct=1, Jérémie réseau=1, aucun titre tant qu'aucun achat vérifié.
- **Anti-fraude** : auto-attribution refusée, domaine jetable refusé, déclaration après achat refusée (règle Bloc 1), doublon entreprise → litige, comptes/IP → revue. Aucun compteur modifiable par le membre.

## 4. Routes & pages (isolées, `[data-clonestory]`)

Pages : `/founding-partners` (principale), `/join`, `/verify` (handler GET), `/my-registry` (« Mon Registre »), `/r/[token]` (atterrissage lien), `/confirm` + `/refuse` (handlers GET), `/merci`, `/conditions`, `/admin` (gardé). API : `POST /api/founding-partners/{register,introduce,rotate-link,withdraw}`, `POST /api/founding-partners/admin/action`.

## 5. Emails

Vérification, bienvenue, demande de confirmation au prospect, (confirmée / refusée / lien révoqué / contribution vérifiée). Ton institutionnel, très court, **aucun vocabulaire d'affiliation, de gain ou de promesse de part**. Réutilise le fournisseur Phase E (Resend + mode local explicite, jamais de faux succès en production).

## 6. Administration

`/founding-partners/admin` (session Supabase + allowlist propriétaire, fail-closed 404) : recherche, détail, conflits, journal immuable, suspension, révocation de lien, résolution de litige. **Chaque action exige une raison**, conserve l'ancien/nouvel état, est horodatée et tracée (append-only).

## 7. Conditions (transparence)

`/founding-partners/conditions` : statut honorifique ; aucune action/part/droit de vote/rémunération/relation de travail/mandat ; critères de vérification ; suspension pour fraude ; droit de retrait ; règles du registre public futur.

## 8. Tests & preuves

- Intégration PGlite (`test:clonestory-bloc2`) — **11/11** : parcours complet Jérémie→Paul→entreprise (direct/réseau), isolation RLS inter-membre, fail-closed sans GUC, email déjà utilisé, lien invalide/révoqué, auto-introduction, doublon entreprise → litige, refus + purge PII, append-only (update/delete refusés), unicité code, administration + audit, résolution de litige.
- Unitaires (`test:clonestory`) — **63** (Bloc 1 invariants + session membre).
- Navigateur réel — register → verify → Mon Registre → introduction → confirmation → registre mis à jour, desktop **et** mobile.
- `tsc` 0 · `next build` OK · Phase E (voisin) **113/113** (aucune régression).

## 9. Dev / E2E local

`CLONESTORY_LOCAL_PGLITE=<dir>` active une base PGlite **en process** (dev/E2E uniquement, import dynamique — jamais chargée en production) + expose `devVerifyUrl`/`devConfirmUrl` dans les réponses pour suivre les liens d'email sans boîte mail. `@electric-sql/pglite` déclaré dans `serverExternalPackages` (next.config) pour résoudre ses assets natifs côté serveur. **En production**, ces variables sont absentes : le runtime utilise `getRuntimeDb()` (Supabase / DATABASE_URL).

## 10. Variables d'environnement (production)

`DATABASE_URL` (Postgres runtime, rôle pouvant assumer `pierre_rt_app`), `RESEND_API_KEY` + `CLONESTORE_FOUNDER_EMAIL_FROM` (emails), `CLONESTORY_SESSION_SECRET` (signature session membre), `CLONESTORE_OWNER_ADMIN_EMAILS` (allowlist admin), `CLONESTORY_COMPANY_SALT` (empreinte entreprise). Migration à appliquer : `MIGRATIONS_FILTER=clonestory_fp DATABASE_URL=… npm run db:migrate:pg`.
