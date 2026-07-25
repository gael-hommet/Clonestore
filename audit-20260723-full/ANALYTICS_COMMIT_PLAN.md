# Analytics Commit Plan

Adapté de la structure recommandée par le master prompt à la réalité de ce bloc (aucun commit
vide, allowlist exacte pour chacun).

## Commit 1 — `feat(analytics): add canonical event identities and persistence`

- `supabase/migrations/2026-07-25__clonestore_analytics_events_v1.sql`
- `src/lib/pierre/v1/test-runtime-db.ts` (extension additive opt-in `PIERRE_E2E_ANALYTICS_SCHEMA`)
- `src/lib/analytics/schema.ts`
- `src/lib/analytics/identity.ts`
- `src/lib/analytics/runtime.ts`
- `src/lib/analytics/store.ts`
- `src/lib/analytics/traffic.ts`
- `src/lib/analytics/attribution.ts`
- `src/lib/analytics/__tests__/schema.test.ts`
- `src/lib/analytics/__tests__/identity.test.ts`
- `src/lib/analytics/__tests__/traffic.test.ts`
- `src/lib/analytics/__tests__/attribution.test.ts`
- `src/lib/analytics/__tests__/store.test.ts`

## Commit 2 — `feat(analytics): unify funnel instrumentation and attribution`

- `src/app/api/analytics/events/route.ts`
- `src/lib/analytics/client/track.ts`
- `src/components/analytics/AnalyticsPageViewTracker.tsx`
- `src/app/layout.tsx` (ajout additif du tracker, aucune autre modification)
- `src/lib/analytics/adapters/founder-access-adapter.ts`
- `src/lib/analytics/adapters/__tests__/founder-access-adapter.test.ts`

## Commit 3 — `feat(analytics): add owner funnel and measurement health dashboard`

- `src/lib/analytics/dashboard-guard.ts`
- `src/app/internal/[slug]/command-center/analytics/page.tsx`
- `src/lib/analytics/__tests__/dashboard-guard.test.ts`

## Commit 4 — `docs(analytics): close funnel measurement contract and launch criteria`

Les 20 fichiers `audit-20260723-full/ANALYTICS_*.md` + `CANONICAL_FUNNEL_DEFINITION.md` +
`CANONICAL_FUNNEL_QUERY_SPEC.md` + `LAUNCH_MEASUREMENT_DECISION_CRITERIA.md` +
`ANALYTICS_FUNNEL_LAUNCH_MEASUREMENT_CLOSURE_REPORT.md` +
`ANALYTICS_FUNNEL_LAUNCH_MEASUREMENT_VERDICT.md` + le dossier
`audit-20260723-full/CLONESTORE_AUDIT_EVIDENCE/analytics-funnel-closure/` + les 7 fichiers globaux
mis à jour (`CLONESTORE_ISSUE_REGISTER.md` etc., allowlist exacte listée dans le rapport de
clôture) — allowlist finale figée après Phase 35, avant création du commit.

## Ce qui n'entre dans AUCUN commit

`.env.local`, tout `.next-*`, `node_modules`, tout fichier CRLF-only préexistant sans vraie
différence (les 152 identifiés dans le bloc Partner Program restent hors périmètre — sujet
différent), tout log/donnée analytique réelle, tout export.
