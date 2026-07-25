# Analytics Runtime Wiring — Commit Plan

Structure adaptée au réel. Allowlist exacte par commit, secret-scan avant chacun, blobs vérifiés.

## Commit 1 — `feat(analytics): add canonical server-event adapter and partner attribution resolver`

- `src/lib/analytics/server-events.ts`
- `src/lib/analytics/adapters/partner-attribution-resolver.ts`
- `src/lib/analytics/adapters/stripe-webhook-analytics.ts`
- `src/lib/analytics/adapters/founder-access-adapter.ts` (trust par événement)
- `src/lib/analytics/schema.ts` (+`demo_step_completed`)
- `src/lib/analytics/__tests__/server-events.test.ts`

## Commit 2 — `feat(analytics): wire founder-access, checkout and Stripe webhook server truths`

- `src/app/api/founder-access/reservations/route.ts`
- `src/app/api/founder-access/verify/route.ts`
- `src/lib/founder-access/stripe-webhook-bridge.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/webhooks/stripe/route.ts`

## Commit 3 — `feat(analytics): wire demo, Pierre, guided-tour and commercial intent events`

- `src/components/demo/DemoExperience.tsx`
- `src/app/demo/pierre/_variant/DemoEventTracker.tsx`
- `src/components/guided-tour/GuidedTourProvider.tsx`
- `src/app/reserver/pierre/ReservationForm.tsx`
- `src/app/activate/pierre/ActivatePierre.tsx`

## Commit 4 — `test(analytics): synthetic end-to-end funnel proof and failure scenarios`

- `src/lib/analytics/__tests__/synthetic-funnel-e2e.test.ts`

## Commit 5 — `docs(analytics): close canonical runtime wiring`

- Tous les `audit-20260723-full/ANALYTICS_*` nouveaux/mis à jour + matrices + verdict + preuves
  (`CLONESTORE_AUDIT_EVIDENCE/analytics-runtime-wiring/`) + docs globaux mis à jour. Allowlist
  finale figée avant création.

## Jamais committé

`.env.local`, `.next-*`, `node_modules`, données réelles, exports, CRLF-only, fichiers étrangers.
