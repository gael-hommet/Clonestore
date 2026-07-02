# P8.8 — Observability & Alerting Runbook

Documents only signals that **really exist** (`src/lib/observability/*`, `src/lib/pierre/observability/*`, `src/lib/go-live/*`, persisted `pierre_rt_*` tables). No fabricated monitoring.

Real primitives: `observability/health.ts`, `errors.ts`, `event-log.ts`, `dead-letter.ts`, `retry-policy.ts`, `correlation.ts`, `redaction.ts`, `runbook.ts` (+ `PIERRE_OBSERVABILITY_ENABLED`). Persisted evidence tables: `pierre_rt_communication_deliveries`, `_provider_events`, `pierre_rt_dead_letters`, `pierre_rt_signature_events/_requests`, `pierre_rt_commercial_events`, `pierre_rt_runtime_jobs`.

| Signal | Source (read-only query / route) | Threshold | Severity | Owner | Operator action | Runbook |
|---|---|---|---|---|---|---|
| Stripe webhook failure | `pierre_rt_commercial_events` unresolved / Stripe dashboard `pending_webhooks` | any unresolved > 5 min | high | eng | verify endpoint secret + route 4xx; replay from Stripe | this + B43 |
| Resend delivery failure | `pierre_rt_communication_deliveries` status in (`failed`,`bounced`,`complained`) | >0 real-tenant | high | ops | inspect `last_error_safe`; check domain/DNS | PHASE_8_4_DELIVERY_INCIDENT_RUNBOOK |
| Yousign webhook failure | `pierre_rt_signature_events` missing after activation | activated w/o event >10 min | high | eng | verify webhook secret parity + route 401-on-bad-sig | this |
| Retries climbing | `pierre_rt_communication_deliveries.attempt_count` | attempt≥max trending | medium | ops | check provider health; expect dead_letter | this |
| Dead letters | `pierre_rt_dead_letters` / deliveries `dead_letter` | any real-tenant | medium | ops | triage cause; do NOT blind-replay | this |
| Stuck queue | deliveries `queued/scheduled/retry_scheduled` aging | age > 15 min | high | ops | confirm worker running; drain governed | EMERGENCY_STOP |
| Expired leases | deliveries `processing` with `lease_expires_at < now` | >0 aging | medium | ops | re-claim naturally; investigate worker | this |
| Job errors | `pierre_rt_runtime_jobs` status `failed/retry_scheduled` | >0 real-tenant | medium | eng | inspect job; governed retry | B43 |
| Orphan signature request | Yousign open (`draft/ongoing`) with no live journey | >0 | high | eng | cancel/delete via governed cleanup | EMERGENCY_STOP |
| Tenant isolation violation | cross-tenant read/claim (P8.7.4 req 22 pattern) | any | critical | security | freeze, audit, escalate | this |
| Entitlement inconsistency | `pierre_rt_product_entitlements` vs commercial events | mismatch | high | eng | reconcile via governed apply | this |
| Cron failure | scheduler route error / no tick | missed window | medium | ops | inspect; one-shot re-tick | B43 |
| Provider latency / 4xx / 5xx | adapter error codes (`provider_4xx/5xx/timeout`) | spike | medium | eng | provider status page; backoff | this |
| Secret/config missing | `scripts/p87-preflight.mjs` (required_env_present) | any RED | high | eng | populate env; never log value | this |
| Deployment error | Vercel deployment state != READY | any | high | eng | rollback (ROLLBACK runbook) | ROLLBACK |

## Health check (read-only)
- `node scripts/p87-preflight.mjs` (17 checks incl. residue + deploy-block) — the canonical periodic health probe.
- `node scripts/p88-readiness-decision.mjs` — aggregate gate status (BLOCKED until 24/24).
- Redaction: `observability/redaction.ts` ensures no secret is logged; all queries above use hashed/count outputs — never print emails/tokens/DSNs.

## Verification done in P8.8
Signals above map to existing tables/modules; preflight + decision engine run clean; no synthetic residue; no alerting fabricated.
