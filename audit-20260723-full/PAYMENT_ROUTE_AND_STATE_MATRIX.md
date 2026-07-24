# Payment Path Closure — Matrice des routes et états

## Routes (rôle canonique vs compatibilité)

| Route | Rôle | Entrée | État créé | Événement suivant | Idempotence | Statut avant | Statut après |
|---|---|---|---|---|---|---|---|
| `/agents/pierre` (`CountryPricingCard`) | Sélection pays + affichage prix | Clic pays | — | Navigation `/checkout?country=X` | — | CTA mort (aucun `onClick`) | **Corrigé** — navigue avec le pays choisi |
| `/checkout` (page) | Confirmation d'intention + déclenchement paiement | `?agent`, `?country` | — | POST `/api/checkout` | anti double-clic (`isLoading`) | N'envoyait jamais le pays | **Corrigé** — transmet `country` si présent |
| **`POST /api/checkout`** | **CANONIQUE — seule route qui crée une session Stripe** | Bearer + `{agent_slug, country?}` | Session Stripe (test) + Customer résolu | webhook `checkout.session.completed` | clé d'idempotence déterministe (`userId+agentSlug+priceId`), déjà réelle avant ce bloc | tarification pays inerte par défaut | **Révélée par défaut**, CHF désormais configuré |
| `GET /api/checkout` | Vérification proactive d'accès (non-bloquant) | Bearer | — | — | lecture seule | inchangé | inchangé |
| `POST /api/checkout/confirm` | **Compatibilité — fallback d'activation si le webhook est en retard** | Bearer + `session_id` | upsert `orders` (idempotent) | — | upsert (idempotent par construction) | déjà correctement gardé par la même réconciliation pays (flag alors OFF) | **Bénéficie automatiquement** de la réconciliation révélée par défaut — aucune modification de ce fichier nécessaire |
| **`POST /api/webhooks/stripe`** | **CANONIQUE — seule route qui reçoit les webhooks Stripe** | Signature Stripe (double secret) | upsert/update `orders` | — | ledger d'événements (`claimOrdersEvent`/`finishOrdersEvent`), déjà réel avant ce bloc | réconciliation pays inerte par défaut | **Révélée par défaut** |
| `/paiement`, `/paiement/success`, `/paiement/cancel` | Pages marketing/statut (aucune logique paiement propre) | — | — | — | — | `/paiement` : 500 intermittent observé | **Root-cause identifiée : artefact `next dev`, non reproductible en build de production (200 stable, 4/4)** |

## États de commande (`orders.status`) — déjà couverts par le code existant, non réécrits

| État | Déclencheur | Confirmé par |
|---|---|---|
| `active` | `checkout.session.completed` (paid) ou `customer.subscription.created/updated` (status=active), réconciliation cohérente | tests existants + nouveaux |
| `trialing` | `checkout.session.completed` (no_payment_required) | tests existants |
| `past_due` | `invoice.payment_failed`, `customer.subscription.updated` (status=past_due) | tests existants |
| `canceled` | `customer.subscription.deleted` | tests existants |
| **`review_required` / `payment_country_conflict`** | réconciliation pays en conflit fort (désormais active par défaut) | nouveaux tests (`payment-path-country-reconciliation.test.ts`) |

**Note** : le système n'introduit pas de nouvelle machine à états dans ce bloc — `evaluateCheckoutReconciliationGate` (préexistant, P15 §4) couvre déjà `country_review_required`-équivalent (`review_required`/`payment_country_conflict`) exactement comme demandé en Phase 7 du mandat. Aucune réécriture disproportionnée n'a été nécessaire — seule sa révélation par défaut.

## Confirmation Phase 17 (recherche de chemins parallèles)

| Élément trouvé | Classement |
|---|---|
| `POST /api/checkout` (`checkout.sessions.create`) | **Canonique** |
| `POST /api/checkout/confirm` (`sessions.retrieve`, jamais `create`) | **Compatibilité légitime** |
| `POST /api/webhooks/stripe` (seul `constructEvent` dans tout `src/app/api`) | **Canonique, unique** |
| `src/lib/billing/customer-mapping.ts` | Types/logique de décision utilisés PAR la route canonique — pas un chemin parallèle |
| `src/lib/clonestory/founding-partners/server/commercial.ts` | Univers CloneStory séparé (programme fondateurs institutionnel, produit distinct) — hors périmètre Pierre |
| `src/lib/demo/public-demo/*` (`stripe_checkout_allowed: false`) | Simple booléen de capacité, jamais d'appel Stripe réel — territoire démo non touché |
| `src/lib/go-live/proofs/proof-registry.ts` | Registre de preuves/documentation, pas du code d'exécution |

**Conclusion** : un seul chemin canonique crée des sessions Stripe, un seul webhook les reçoit. Aucun doublon à neutraliser trouvé.
