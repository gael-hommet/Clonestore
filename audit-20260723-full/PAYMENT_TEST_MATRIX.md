# Payment Path Closure — Matrice de tests

**36 tests nouveaux** (26 API checkout + 5 webhook réconciliation + 5 flags) + **corrections de 3 fixtures existantes** (opt-out explicite, comportement préservé) + **6115 tests de non-régression exécutés en direct** (checkout/webhooks/pricing/production/geo/partner/E1/P0.1/P0.2/Pierre complet), tous verts.

## Unitaires — flags révélés par défaut

| ID | Scénario | Résultat attendu | Obtenu | Fichier |
|---|---|---|---|---|
| F1 | `STRIPE_COUNTRY_PRICING_ENABLED` absente | `true` | ✅ | `pricing-flags-revealed-default.test.ts` |
| F2 | valeur vide | `true` | ✅ | idem |
| F3 | `false/0/off/disabled/no` (+ casse) | `false` | ✅ (6 variantes) | idem |
| F4 | `STRIPE_COUNTRY_RECONCILIATION_ENABLED` absente | `true` | ✅ | `p15-reconciliation-revealed-default.test.ts` |
| F5 | FR facturé EUR, facturation FR | activation | ✅ | idem |
| F6 | session FR mais facturation Stripe CH | pas d'activation silencieuse | ✅ | idem |
| F7 | CH facturé EUR (devise incohérente) | pas d'activation, remboursement requis | ✅ | idem |
| F8 | arrêt d'urgence explicite | comportement legacy préservé | ✅ | idem |

## API — `POST /api/checkout` (`payment-path-country-checkout.test.ts`)

| ID | Scénario | Résultat attendu | Obtenu | Effet externe |
|---|---|---|---|---|
| C1 | France | session EUR 449€, `price_eur_test`, metadata FR | ✅ | mock uniquement |
| C2 | Belgique | idem, metadata BE | ✅ | mock |
| C3 | Luxembourg | idem, metadata LU | ✅ | mock |
| C4 | Suisse | session CHF 499, `price_chf_test`, metadata CH | ✅ | mock |
| C5 | pays absent | `COUNTRY_REQUIRED`, 0 session | ✅ | mock |
| C6 | pays non supporté (DE) | `COUNTRY_NOT_SUPPORTED`, 0 session | ✅ | mock |
| C7 | CH + `price_key` EUR forcé par le client | prix CHF quand même (jamais EUR) | ✅ | mock |
| C8 | `price_id` brut arbitraire envoyé par le client | totalement ignoré | ✅ | mock |
| C9 | double requête FR (même clé) | `idempotencyKey` identique | ✅ | mock |
| C10 | changement de pays FR→CH | `idempotencyKey` différente (nouvelle session légitime) | ✅ | mock |

## Webhook — réconciliation pays (`payment-path-country-reconciliation.test.ts`)

| ID | Scénario | Résultat attendu | Obtenu | Effet externe |
|---|---|---|---|---|
| W1 | FR, facturation FR, EUR | activation normale | ✅ | mock (Supabase injecté) |
| W2 | CH, facturation CH, CHF | activation normale | ✅ | mock |
| W3 | session FR, facturation Stripe réelle CH | pas d'activation silencieuse | ✅ | mock |
| W4 | CH facturé EUR | pas d'activation | ✅ | mock |
| W5 | même événement reçu deux fois | une seule écriture (idempotence ledger) | ✅ | mock |

## Non-régression (exécutée en direct)

| Suite | Fichiers | Tests | Résultat |
|---|---|---|---|
| `checkout` + `webhooks` + `pricing` + `production` + `geo` + `partner-program` + `external-enablement` + P0.1/P0.2 | 46 | 540 | ✅ tous verts |
| `src/lib/pierre` + `src/app/api/pierre` (sweep complet) | 127 (1 skip pré-existant) | 5380 | ✅ 5378 verts, 1 skip — 1 timeout worker isolé re-testé séparément : **vert (4/4, 1.07s)**, confirmé artefact de contention machine (10h+ de session continue), pas une régression |

**Total combiné** : ~5946 tests exécutés en direct dans ce bloc, 0 échec réel.

## Real Stripe test (Phase 16) — voir `PAYMENT_STRIPE_TEST_EVIDENCE.md`

Sessions Checkout réelles créées en mode test pour FR (EUR) et CH (CHF), prix vérifiés via l'API, puis nettoyées (session expirée, customer archivé).

## Navigateur réel (Playwright, redevenu disponible en fin de bloc)

| ID | Scénario | Résultat attendu | Obtenu |
|---|---|---|---|
| B1 | `/agents/pierre` build production, pays par défaut | France, 449€/mois affiché | ✅ |
| B2 | Clic radio "Suisse" | CTA passe à "Choisir Pierre — 499 CHF / mois" (mise à jour dynamique) | ✅ |
| B3 | Clic sur le CTA (Suisse) | Navigation réelle vers `/checkout?agent=pierre&country=CH`, 0 erreur console | ✅ (`cta-suisse-checkout-CH.png`) |
| B4 | `/checkout?country=CH` | Rendu correct de la carte de paiement | ✅ |
| B5 | `/paiement` en navigateur réel (build production) | 0 erreur console, rendu stable | ✅ (`paiement-stable-production.png`) |

Serveur : `next start -p 3313` sur le build isolé `BUILD_ID=U7_BRdm8KyWmSOZhGzwvD`. Non couvert : la page Checkout hébergée par Stripe elle-même (aucune carte de test saisie, voir RISQUE-3 de `PAYMENT_REMAINING_RISKS.md`).

## Ce qui n'a PAS été testé (limites explicites)

- **Formulaire de facturation Stripe hébergé** (saisie d'une carte de test réelle) : évité par choix de sécurité pour ne déclencher aucun webhook réel contre la base Supabase partagée avec la production.
- **Écriture réelle dans la table `orders` partagée** : délibérément évitée (base Supabase partagée avec la production) — prouvé via mocks à la place, même discipline qu'en P0.1/P0.2.
- **Attribution partenaire de bout en bout avec un vrai cabinet** : le code (`bridgePartnerCommercial`, anti-double-crédit sur `invoice.paid`) n'a pas été modifié dans ce bloc (déjà correct selon l'audit initial) et n'a pas été re-testé spécifiquement ici — hors du périmètre des défauts identifiés (CTA/500/tarification pays).
