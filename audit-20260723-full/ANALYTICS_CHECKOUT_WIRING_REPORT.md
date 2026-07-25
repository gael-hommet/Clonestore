# Analytics Checkout Wiring Report

## `checkout_session_created` — `src/app/api/checkout/route.ts`

Émis **après la création réelle de la session Stripe** (`stripe.checkout.sessions.create`) et
**après le guard `!session.url`**, juste avant `return json(200, {url})`. Additif, best-effort,
`try/catch` dédié : ne bloque jamais le checkout.

- Trust : `SERVER_CONFIRMED`.
- Clé d'idempotence : `checkout-session-created:<session.id>`. Une session Stripe unique → un seul
  événement. Un retry route réutilisant la même session (clé idempotence Stripe) ne produit pas de
  2ᵉ conversion.
- Données : `resolvedCountry` (résolu SERVEUR par `resolvePierreCheckoutPricing`), `expectedCurrency`
  (serveur), `expectedAmount` → **tranche bornée** (jamais le montant exact), `userId` (UUID Bearer).
- **Jamais exposé** : URL Stripe, Price ID, customer id, client secret, email — aucun n'entre dans
  l'événement (le schéma n'a pas de champ pour eux ; seuls pays/devise/tranche + user UUID).

## Résolution serveur du prix confirmée

`resolvePierreCheckoutPricing` ignore explicitement le pays/prix/devise du corps client
(`lookupVerifiedCompanyCountry` + geo header → `evaluateCheckoutCountryGuard` →
`resolveStripePriceIdForCountry`). Le client ne peut jamais imposer le prix, la devise ou le pays.
