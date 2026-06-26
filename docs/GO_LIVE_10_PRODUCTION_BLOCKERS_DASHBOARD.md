# GO-LIVE 10 — Production Blockers Dashboard & Final Launch Gate

## Purpose

Single source of truth for public launch readiness. Gael can open `/profile/go-live` and immediately see what is ready, what is blocked, what is pending, and what the exact next actions are.

## Verdict: Public launch = NO-GO

Pierre est techniquement pret cote repo. Le lancement public est bloque par des conditions externes non encore remplies.

**Repo pret != Commercialement lancable.**

## Production blockers actuels

| Blocker | Statut | Propriétaire | Bloque launch |
|---|---|---|---|
| Société immatriculée | BLOQUANT | Gael | Oui |
| Revue juridique humaine | BLOQUANT | Juriste | Oui |
| Stripe live configuration | BLOQUANT | Stripe + Gael | Oui |
| RLS Supabase production | BLOQUANT | Supabase + Gael | Oui |
| Paid customer E2E live | BLOQUANT | Gael | Oui |
| Copy public — revue manuelle | Partiel | Gael | Oui |
| Stripe test mode E2E formel | Partiel | Gael | Non (reporting) |
| Support & FAQ | Partiel | Gael | Non |

## Pourquoi public launch est NO-GO

1. **Société non immatriculée** — Aurexia / CloneStore n'a pas de SIREN/SIRET. Bloque: Stripe live KYC, mentions legales, email pro, responsabilite legale.

2. **Stripe live non configure** — Pas de cles sk_live_, pas de produit Pierre 449 EUR/mois, pas de webhook live. Sans Stripe live: aucun paiement reel possible.

3. **Revue juridique non effectuée** — CGU, CGV, DPA, politique de confidentialite n'ont pas ete relus par un avocat ou juriste specialise. Engagement de responsabilite impossible sans cette etape.

4. **RLS Supabase production non verifie** — RLS staging valide (7/7 PASS) mais non applique en production. Isolation cross-company en production non confirmee.

5. **Paid customer E2E live non execute** — Le flux checkout -> webhook -> activation Pierre -> setup -> cockpit n'a jamais ete execute avec un vrai paiement en production.

## Ce qui est pret cote repo

- Pierre moteur IA (B38-B48): contrats, onboarding, gouvernance, CloneGuard, CloneTrust, audit trail.
- Site public: homepage, demo Pierre, funnel demo, visual QA (GO-LIVE 05/06/07).
- Securite pre-prod: RLS staging valide (GO-LIVE 01D/01E).
- Stripe test tooling: env test configure, scripts E2E prets (GO-LIVE 08).
- Onboarding premier client: /paiement/success -> /agents/pierre/setup -> cockpit (GO-LIVE 09).
- Access gate cockpit: non-payes voient NoAccessGate.
- 8039 tests valides. tsc clean. Build propre.

## Ce qui depend de Gael / parents

- Immatriculer la societe Aurexia / CloneStore.
- Obtenir SIREN/SIRET + recepisse RCS.
- Remplir les informations societe dans les pages legales.
- Configurer Stripe live apres immatriculation.
- Tester le flux paid customer live une fois tout configure.
- Valider go-live-proofs.local.json apres chaque preuve.

## Ce qui depend de Stripe live

- sk_live_ + pk_live_ configures en production.
- Produit Pierre 449 EUR/mois cree (price ID live).
- STRIPE_WEBHOOK_SECRET=whsec_live_... configure.
- Flux paiement complet teste avec vraie carte.

Attention: Stripe live necessite une societe immatriculee pour le KYC.

## Ce qui depend du juriste

- Validation CGU (Conditions Generales d'Utilisation).
- Validation CGV (Conditions Generales de Vente, 449 EUR/mois).
- Validation DPA (Data Processing Agreement RGPD).
- Validation politique de confidentialite.
- Validation mentions legales avec infos societe completes.

## Ce qui depend de Supabase prod

- Application du RLS production (meme regles que staging, 7/7 PASS).
- Verification isolation cross-company en production.
- Confirmation audit log production operationnel.

## Ordre exact recommande

1. **Societe** — Immatriculer Aurexia / CloneStore (avec les parents).
2. **Infos legales** — Remplir SIREN, adresse, gerant dans /legal/mentions.
3. **Stripe live** — Creer compte, produit, prix, configurer cles et webhook.
4. **Legal review** — Envoyer dossier au juriste. Attendre validation ecrite.
5. **RLS production** — Appliquer et verifier en production.
6. **Live paid E2E** — Tester le flux complet avec un vrai paiement.
7. **Final public go** — Valider go-live-proofs.local.json. Passer B48_PUBLIC_LAUNCH_ENABLED=true uniquement quand buildGoLiveVerdictFromProofs().is_public_launch_go === true.

## Ce qu'il ne faut PAS refaire

- Ne pas refaire Stripe test inutilement — tooling prêt, ne dépasse pas l'objectif.
- Ne pas rouvrir le moteur Pierre sans bug reel — B38-B48 clos.
- Ne pas refaire le site public si pas de bug confirme.
- Ne pas refaire /demo/pierre si pas de regression.
- Ne pas marquer de proof ID comme verifie sans preuve reelle.
- Ne pas passer B48_PUBLIC_LAUNCH_ENABLED=true sans verdict programmatique GO.
- Ne pas auto-ecrire dans go-live-proofs.local.json.
- Ne pas appeler Stripe live, OpenAI, Anthropic depuis les scripts de check.
- Ne pas envoyer d'email reel depuis les scripts.

## Ce qu'on peut faire en attendant

- Continuer les demonstrations privees (demo Pierre accessible).
- Preparer la prospection et les decks commerciaux.
- Preparer la documentation commerciale et les tarifs.
- Tester l'UX manuellement (onboarding, setup Pierre, cockpit).
- Rediger la FAQ et le processus de support client.
- Preparer les emails de bienvenue et le plan d'onboarding.

## Preuve attendues (Proof IDs)

### Staging / Test (deja verifiables)
- `SUPABASE_RLS_STAGING_VERIFIED`
- `PUBLIC_COPY_SCAN_CLEAN`
- `STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED`
- `STRIPE_TEST_WEBHOOK_RECEIVED`

### Humain / Juridique (validation manuelle requise)
- `LEGAL_ENTITY_INFO_COMPLETED`
- `LEGAL_HUMAN_REVIEW_COMPLETED`

### Production / Live (necessitent environnement production reel)
- `STRIPE_LIVE_SECRET_SET`
- `STRIPE_LIVE_PRICE_PIERRE_449_CREATED`
- `STRIPE_LIVE_WEBHOOK_CONFIGURED`
- `STRIPE_LIVE_PAYMENT_SUCCESS_TESTED`
- `SUPABASE_RLS_PRODUCTION_VERIFIED`
- `PAID_CUSTOMER_PRODUCTION_E2E_COMPLETED`

### Repo / Tooling (verifiables automatiquement)
- `BUILD_AND_TESTS_CLEAN`
- `PIERRE_ACCESS_GATE_DEPLOYED`

## Safety note

Pierre n'est pas avocat, juriste ni logiciel de paie officiel. La conformite juridique finale necessite une revue humaine par un professionnel qualifie.

Aucun proof ID ne doit etre marque verifie sans preuve reelle. Aucun flag public launch ne doit passer a true automatiquement.
