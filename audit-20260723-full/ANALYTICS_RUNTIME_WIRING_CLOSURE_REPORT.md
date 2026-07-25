# Canonical Analytics Runtime Wiring Closure — Rapport

Bloc exécuté 2026-07-25, HEAD initial `6c82768270a92a563349f8d237b7fa21f9ef1a6e` (le HEAD attendu
`871c5d266…` avait avancé d'un commit Pierre HR concurrent, vérifié disjoint des fichiers
analytics — voir `CLONESTORE_AUDIT_EVIDENCE/analytics-runtime-wiring/00_BASELINE.md`).

## 1. Mission

Brancher réellement chaque étape importante du funnel au système Analytics canonique construit au
bloc précédent, sans casser le métier, sans double comptage, sans transformer un signal client en
vérité serveur.

## 2. Ce qui a été branché

- **Founder-access** (`bridgeFounderServerEvent`, event_id déterministe, après persistance métier) :
  `reservation_created` (SERVER_PERSISTED), `reservation_email_confirmed` (SERVER_CONFIRMED),
  `activation_completed` (PAYMENT_PROVIDER_CONFIRMED).
- **`/demo`** (`track()` additif) : `demo_started`, `demo_step_completed`, `demo_completed`,
  `demo_pierre_reveal_viewed`, `discover_pierre_clicked` — avec un `demo_run_id` par run.
- **`/demo/pierre`** : `pierre_demo_started`, `pierre_demo_step_completed`, `pierre_demo_completed`
  — `demo_run_id` propre au run Pierre.
- **GuidedTour** (observation pure de la machine à états) : `guided_tour_started/step_completed/
  completed/skipped`.
- **Intentions client** : `reservation_form_started`, `reservation_submitted`, `activation_started`,
  `checkout_started` (jamais des vérités serveur).
- **`/api/checkout`** : `checkout_session_created` (SERVER_CONFIRMED) après création Stripe réelle.
- **Webhook Stripe signé** (`emitCanonicalPaymentEvent`, auto-avalant) : `payment_succeeded`,
  `payment_failed`, `payment_refunded` (PAYMENT_PROVIDER_CONFIRMED), clé = `stripe_event_id`.
- **Attribution Partner** : résolveur lecture seule (`resolvePartnerAttributionForUser`) branché
  sur `payment_succeeded`, jamais un partner_id client.

## 3. Un seul producteur canonique par conversion

Décision anti-double-comptage clé : le pont founder n'émet jamais `founder_payment_completed→
payment_succeeded` ; `payment_succeeded` a un unique producteur (la route webhook). Le dashboard
canonique lit exclusivement `clonestore_analytics_events_v1` — aucune union avec les tables legacy.
Voir `ANALYTICS_CROSS_SYSTEM_DEDUPLICATION_REPORT.md`.

## 4. Collision de nom legacy résolue (Phase 14)

`founder_checkout_started` (vue de page `/checkout` ET action réelle) est désormais scindé en
`checkout_started` (intention client) vs `checkout_session_created` (vérité serveur). Les anciennes
données restent `LEGACY_NON_COMPARABLE`, jamais réécrites.

## 5. Évolution de contrat

Un seul ajout : l'événement canonique `demo_step_completed` (manquant du schéma v1, requis par le
funnel). Additif, rétrocompatible (nouveau membre d'enum), couvert par le funnel synthétique et le
wiring `/demo`. Le schéma reste v1 (32 événements). Le niveau de confiance de l'adaptateur founder
est passé d'un binaire simpliste à un mapping par événement (aligné sur le contrat) — les 6 tests
existants de l'adaptateur restent verts.

## 6. Doctrine respectée

Métier avant analytics, toujours. Analytics best-effort/auto-avalante partout : une écriture
analytics qui échoue ne casse jamais réservation/email/activation/checkout/paiement/remboursement,
et n'est jamais visible de l'utilisateur. Conversions serveur (9) rejetées si soumises par le
client (endpoint 422 + API serveur `NOT_A_SERVER_EVENT`).

## 7. Preuve

Funnel synthétique complet de bout en bout (1 visiteur → paiement + remboursement), 12/12 verts +
4 scénarios d'échec — voir `ANALYTICS_SYNTHETIC_END_TO_END_PROOF.md`. Aucune PII, aucun montant
exact (tranches bornées), aucun secret Stripe.

## 8. Sécurité / production

`PRODUCTION_AUTHORIZED=false` intact. Aucun push, aucun déploiement, aucune migration distante,
aucun paiement/webhook/email/transfert réel. Stripe test uniquement.

## 9. Verdict

Voir `ANALYTICS_RUNTIME_WIRING_VERDICT.md`.
