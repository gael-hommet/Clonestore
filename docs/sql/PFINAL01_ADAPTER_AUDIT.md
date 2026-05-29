# P-FINAL 01 — Adapter Audit Trail

## Purpose

Audit trail of all CloneStore production adapters. Established during P-FINAL 01 Phase 0 audit (2026-05-28).

## Real Adapters (production-ready)

| ID | File | Category | Criticality | Blocks if Mocked |
|----|------|----------|-------------|-----------------|
| `supabase_client` | `src/lib/supabase.ts` | database | critical | yes |
| `supabase_auth` | `src/lib/pierre/auth.ts` | auth | critical | yes |
| `order_activation` | `src/lib/billing/order-activation.ts` | billing | critical | yes |
| `stripe_activation` | `src/lib/billing/stripe-activation.ts` | billing | critical | yes |
| `pierre_core` | `src/lib/pierre/pierre-core.ts` | ai | critical | yes |
| `rgpd_export` | `src/lib/pierre/security/pierre-rgpd-export.ts` | database | important | no (injectable) |
| `rgpd_purge` | `src/lib/pierre/security/pierre-rgpd-purge.ts` | database | important | no (injectable) |
| `ai_cost_tracker` | `src/lib/pierre/observability/ai-cost-tracker.ts` | observability | important | no |

## Critical Rules

- **Never** use mock adapters in production
- All server-side routes must use `service_role` key, not `anon` key
- `company_id` must **never** come from client input — always from `auth.uid()` server-side
- RGPD adapters accept injectable adapters for testing only

## Mock Detection

The `adapter-mock-guard.ts` module checks:
1. Active mock adapter IDs against the registry
2. Mock env var indicators (`MOCK_SUPABASE`, `MOCK_STRIPE`, etc.)

## Adapter Invariants

- Real Supabase client (`supabase_client`) must always be initialized with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Service role calls use `SUPABASE_SERVICE_ROLE_KEY` — never exposed to client
- Stripe adapter requires `STRIPE_SECRET_KEY` (live key for production)

## Files Audited

- `src/lib/supabase.ts` — real Supabase client ✓
- `src/lib/billing/order-activation.ts` — real Stripe → Supabase activation ✓
- `src/lib/billing/stripe-activation.ts` — pure mapper ✓
- `src/lib/pierre/auth.ts` — server auth with company_id ✓
- `src/lib/pierre/security/pierre-rgpd-export.ts` — injectable RGPD export ✓
- `src/lib/pierre/security/pierre-rgpd-purge.ts` — injectable RGPD purge ✓
- `src/lib/pierre/observability/ai-cost-tracker.ts` — cost tracking ✓

_Last audited: P-FINAL 01 Phase 0 — 2026-05-28_
