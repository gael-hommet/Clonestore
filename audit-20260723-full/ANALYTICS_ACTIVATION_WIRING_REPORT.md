# Analytics Activation Wiring Report

## Signaux client (INTENTION) — `src/app/activate/pierre/ActivatePierre.tsx`

| Événement | Point | Trust |
|---|---|---|
| `activation_started` | clic « Activer Pierre » (`activate()`), avant `/api/checkout` | `CLIENT_OBSERVED` |
| `checkout_started` | juste avant l'appel réel à `/api/checkout` | `CLIENT_OBSERVED` |

Ces deux événements sont des **intentions client**, jamais des vérités. Ils ne contiennent aucun
montant, aucun Price ID, aucune URL Stripe. Dédup par `dedupeKey`.

## Vérité serveur

`activation_completed` (PAYMENT_PROVIDER_CONFIRMED) est émis **exclusivement** par le pont
founder-access dans le webhook Stripe (`stripe-webhook-bridge.ts`), jamais par le client — voir
`ANALYTICS_FOUNDER_ACCESS_WIRING_REPORT.md`. Un client ne peut donc pas forger une activation.

## Collision de nom legacy résolue

Le legacy `founder_checkout_started` était utilisé à la fois comme vue de page `/checkout`
(`PresencePing`) et comme signal d'action réelle dans `ActivatePierre`. Le contrat canonique
distingue désormais : `checkout_started` (intention client, avant l'appel) vs
`checkout_session_created` (vérité serveur, après création Stripe réelle). Voir Phase 14 /
`ANALYTICS_RUNTIME_WIRING_CLOSURE_REPORT.md`.
