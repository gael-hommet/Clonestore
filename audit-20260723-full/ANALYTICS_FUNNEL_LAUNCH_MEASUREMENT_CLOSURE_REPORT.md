# Analytics, Funnel and Launch Measurement Closure — Rapport

Bloc exécuté 2026-07-25, HEAD initial `9d53a2ddd00ae88a78017745b85e64cc0273eed6` (branche
`main`, `C:\Users\homme\clonestore`).

## 1. Mission

Construire une fondation analytique canonique permettant de répondre honnêtement à : « combien de
vrais visiteurs externes découvrent CloneStore, entrent dans la démo, comprennent Pierre,
accomplissent les étapes importantes, réservent, confirment leur email, commencent l'activation,
ouvrent un checkout et paient réellement ? » — sans présenter les chiffres existants (~141
visiteurs, 177 passages démo, 22 fins de démo, 20 démarrages Pierre, 1 fin Pierre, 0 clic
réservation, 3 formulaires, 1 réservation, 1 email confirmé, 0 activation, 2 checkouts,
0 paiement) comme un funnel fiable.

## 2. Cartographie (Phase 1-2)

Deux agents de recherche indépendants ont établi, par lecture directe de code (orientation
Graphify préalable), l'existence de **cinq systèmes parallèles sans identité partagée** :
founder-access (le seul réellement durable en production, Postgres réel, 9 tables), BLOC3
conversion (déclaré mais **inerte en production** — aucun backend Postgres jamais implémenté,
fail-closed silencieux), l'analytics de présentation démo (ne quitte jamais le navigateur),
GuidedTour (zéro télémétrie), et l'identité orpheline `cs_anon_sid` (générée client, toujours
ignorée serveur). 83 identifiants d'événements inventoriés et classés dans les 10 catégories
obligatoires (voir `ANALYTICS_LEGACY_EVENT_INVENTORY.md`) — aucun non classé.

## 3. Contrat canonique construit (Phase 3-9)

- 31 événements canoniques fermés, 5 niveaux de confiance, 4 identités distinctes
  (`visitor_id`/`session_id`/`page_view_id`/`demo_run_id`, jamais confondues), allowlist stricte
  de 15 propriétés (jamais `Record<string, unknown>` public).
- Table `clonestore_analytics_events_v1` : append-only forcée, RLS forcée, contraintes de
  plausibilité temporelle, purge par rétention créée mais jamais planifiée (décision propriétaire
  en attente).
- Endpoint unique `POST /api/analytics/events` : rejet actif des événements server-only/inconnus,
  dégradation fail-safe si le stockage est indisponible (jamais un faux succès, jamais un blocage
  de la navigation).

## 4. Instrumentation (Phase 10-13)

Tracker de navigation App Router monté (additif, `src/app/layout.tsx`), une vue par navigation
réelle, gère le retour bfcache. Adaptateur founder-access construit et prouvé sur un cas réel
(6 tests contre PGlite) mais **non câblé** dans le code founder-access existant. Ré-instrumentation
démo/Pierre/GuidedTour et branchement du webhook Stripe **délibérément différés** — justifiés en
détail dans `ANALYTICS_LEGACY_MIGRATION_MATRIX.md` : ces trois wirings toucheraient du code
actif/protégé et méritent chacun leur propre suite de non-régression dédiée plutôt qu'un geste
rapide dans un bloc déjà très large.

## 5. Sécurité financière et vie privée

Zéro tracker tiers, zéro fingerprinting, zéro IP brute, zéro PII dans les événements (allowlist
stricte prouvée par test), zéro conversion client-forgée possible (9 événements server-only
rejetés explicitement du client, testé), zéro double comptage possible (idempotence prouvée
contre PGlite réel, 3 niveaux : DB, adaptateur, client).

## 6. Déploiement

Aucun — aucune migration distante, aucun push, aucun déploiement, conformément à l'interdiction
absolue de ce bloc.

## 7. Tests

84/84 tests analytics verts + 224/224 tests combinés (analytics + non-régression P0.1/P21-P22/
Partner Program/Payment Path/Demo-Mobile). `tsc --noEmit` : 0 erreur sur tout le dépôt. ESLint
ciblé : 0 erreur après correction de 4 problèmes mineurs (échappement regex inutile, directives
eslint-disable inutilisées).

## 8. Commits et preuve

Voir `ANALYTICS_COMMITTED_BLOB_PROOF.md` pour les OID exacts et la vérification blob par blob.
Voir `ANALYTICS_CLEAN_CHECKOUT_BUILD_PROOF.md` pour la validation en checkout propre.

## 9. Risques résiduels

Voir `ANALYTICS_REMAINING_RISKS.md` — aucun ne concerne une perte de données ou une régression
d'un système déjà en production, tous concernent des extensions non encore activées.

## 10. Verdict

Voir `ANALYTICS_FUNNEL_LAUNCH_MEASUREMENT_VERDICT.md`.
