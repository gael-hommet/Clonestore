# Analytics Server Event Adapter Spec

Module : `src/lib/analytics/server-events.ts`. API serveur UNIQUE pour les vérités du funnel.
12 tests dédiés (`server-events.test.ts`), tous verts contre PGlite réel.

## `recordCanonicalServerEvent(db, input)`

- **Refuse** tout événement non server-only (`NOT_A_SERVER_EVENT`) — un événement client-émissible
  ne peut jamais être créé par cette voie (séparation stricte des sources, testée).
- **Idempotent** : `stableKey` → `deterministicEventId` (sha256 → forme UUID) → `on conflict do
  nothing`. Un rejeu ne crée jamais un 2ᵉ événement (testé « replay-safe »).
- **Best-effort** : ne jette jamais (insert enveloppé try/catch), retourne `{ok, outcome, reason}`.
- **Zéro PII** : `authenticatedUserId` accepté seulement s'il est un UUID (jamais un email,
  testé) ; propriétés passées par l'allowlist stricte du schéma.
- **Jamais de montant exact** : `amountMinor` → `amountBucket` (tranche bornée), la valeur exacte
  n'entre jamais dans le stockage (testé : `44900` absent du JSON stocké).
- **source** = `stripe` si `PAYMENT_PROVIDER_CONFIRMED`, sinon `server`.
- **partnerAttributionId** : passé tel quel (déjà résolu serveur), jamais recalculé ; marque
  `source_channel = 'partner'` si présent.

## Helpers exportés

- `deterministicEventId(stableKey)` — UUID stable, ne contient jamais la clé brute (testé).
- `amountBucket(minor)` — `zero`/`lt_100`/`100_to_500`/`500_to_1000`/`gte_1000`/`unknown`.
- `resolveAnalyticsEnvironment()` — `production`/`preview`/`development`/`test`.

## Clés d'idempotence déterministes utilisées par le runtime

| Événement | stableKey |
|---|---|
| `checkout_session_created` | `checkout-session-created:<stripe_session_id>` |
| `payment_succeeded` | `payment_succeeded:<stripe_event_id>` |
| `payment_failed` | `payment_failed:<stripe_event_id>` |
| `payment_refunded` | `payment_refunded:<stripe_event_id>` |
| `reservation_created` | `founderEventIdFor(reservation_id, "founder_reservation_created")` |
| `reservation_email_confirmed` | `founderEventIdFor(reservation_id, "founder_email_verified")` |
| `activation_completed` | `founderEventIdFor(reservation_id, "founder_subscription_active")` |

Les identifiants Stripe bruts (session id, event id) ne sont jamais stockés en clair — seule leur
forme UUID hachée (event_id) l'est.
