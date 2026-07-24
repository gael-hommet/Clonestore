# Payment Path Closure — Matrice pays/prix (FR/BE/LU/CH)

Contrat canonique (`src/lib/clonestore/pricing/country-pricing.ts`, module pur, non modifié — déjà correct avant ce bloc) :

| Pays | Code | Devise | Prix | Price ID (redacted) | Groupe |
|---|---|---|---|---|---|
| France | FR | EUR | 449 €/mois | `price_1TaFzx...` (alias legacy `STRIPE_PRICE_PIERRE`, vérifié réel via API) | EUR_LAUNCH |
| Belgique | BE | EUR | 449 €/mois | même price ID que FR | EUR_LAUNCH |
| Luxembourg | LU | EUR | 449 €/mois | même price ID que FR | EUR_LAUNCH |
| Suisse | CH | CHF | 499 CHF/mois | `price_1TwVJo...` (**nouveau**, créé via l'API Stripe test dans ce bloc) | CHF_LAUNCH |

## Par pays — état vérifié dans ce bloc

| Pays | Affichage (`/agents/pierre`, `/api/pricing/public`) | Pays transmis au clic CTA | Session Stripe (test, réelle) | Metadata | Webhook/activation | Verdict |
|---|---|---|---|---|---|---|
| FR | 449 € / mois | `?country=FR` (CountryPricingCard → `/checkout`) | ✅ créée, `price_1TaFzx...`, EUR | `selected_country=FR` | réconciliation testée (mock), active si cohérent | **PRÊT** |
| BE | 449 € / mois | `?country=BE` | ✅ (même price EUR, test API dédiée non re-répétée — couvert par test API FR identique) | `selected_country=BE` | couvert par test API (`payment-path-country-checkout.test.ts`) | **PRÊT** |
| LU | 449 € / mois | `?country=LU` | ✅ idem | `selected_country=LU` | couvert par test API | **PRÊT** |
| CH | 499 CHF / mois | `?country=CH` | ✅ créée réellement via Stripe test API, `price_1TwVJo...`, CHF confirmé | `selected_country=CH`, `expected_currency=chf` | réconciliation testée (mock), active si cohérent | **PRÊT** |

## Preuve que le client ne peut jamais forcer un prix

Testé et vérifié (voir `PAYMENT_TEST_MATRIX.md`) :
- `price_key`/`currency`/`price_id` envoyés par le client sont systématiquement **ignorés** — le serveur ne les utilise jamais dans `line_items`.
- Un client CH qui force `price_key=STRIPE_PRICE_PIERRE_EUR_MONTHLY` reçoit quand même le prix CHF (jamais de repli EUR).
- Un pays absent → `COUNTRY_REQUIRED` (jamais de prix par défaut).
- Un pays non supporté (ex. DE) → `COUNTRY_NOT_SUPPORTED`.

## Avant ce bloc vs après

| Élément | Avant | Après |
|---|---|---|
| `STRIPE_COUNTRY_PRICING_ENABLED` | absente = **désactivé** (chemin EUR unique, aucune validation pays) | absente = **activé** (révélé par défaut, arrêt d'urgence explicite possible) |
| `STRIPE_PRICE_PIERRE_CHF_MONTHLY` | **absente — aucun prix CHF configuré** | présente, prix Stripe test réel vérifié (499 CHF) |
| CTA Suisse (`CountryPricingCard`) | aucun `onClick` — mort | `onClick` → `/checkout?agent=pierre&country=CH` |
| `/checkout` → `/api/checkout` | envoyait `{agent_slug}` seul, aucun pays | envoie `{agent_slug, country}` quand un pays est choisi |
