# E1 — Observability & Incident Runbook

**Nature:** provider‑neutral observability contracts are ready locally; **no monitoring vendor is added** (none is canonically chosen). Vendor wiring is an owner action. Source: `src/lib/observability/**` (health, runbook, dead‑letter, event‑log, redaction, correlation, retry‑policy, errors). Machine copy: [observability-readiness.json](.e1-proofs/external-enablement/observability-readiness.json).

## Ready locally (provider‑neutral)
- **Structured server errors** + **user‑safe errors** (no internal paths/secrets to the client).
- **Request IDs / correlation** (`correlation.ts`).
- **Tenant‑safe logs** + **redaction** (`redaction.ts` strips prompt/content/PII).
- **Dead‑letter** tracking (`dead-letter.ts`), **retry policy** (`retry-policy.ts`), **event log** (`event-log.ts`).
- **Health checks** (`health.ts`) — env presence (never values), runtime mode, feature‑flag state, latency→status.
- **Emergency kill switches** — `CLONECHAT_ENABLED=false`, `AI_EMERGENCY_SHUTDOWN=true`.

## Alert categories, thresholds, owner, response

| Category | Signal | Threshold | Owner | Response |
|---|---|---|---|---|
| Auth failures | 401/403 spikes on API | > baseline ×3 / 5 min | eng | check Supabase auth; possible attack |
| Cross‑tenant attempt | RLS denial / forbidden entity | any | eng+owner | investigate immediately; isolate |
| Webhook failures | signature/verification errors | > 0 sustained | eng | check `STRIPE_WEBHOOK_SECRET`, endpoint |
| DB failures | connection/query errors | > baseline | eng | check Supabase status; failover |
| OpenAI budget | cost‑shield blocks / cap hit | cap reached | owner | review caps; `AI_EMERGENCY_SHUTDOWN` if runaway |
| Job/dead‑letter | dead‑letter growth | > 0 sustained | eng | drain + fix root cause |
| Attachment parse | parse failures | > baseline | eng | check file limits/types |
| Provider latency | p95 latency | > SLA | eng | degrade to fallback |

## Response procedure
1. **Triage** with the request ID + tenant‑safe logs (never expose PII).
2. **Contain** with the relevant kill switch.
3. **Rollback** (see the deployment runbook) if a deploy caused it.
4. **Evidence collection** — redacted logs only; **no secret/PII** in the incident record.
5. **Post‑mortem** — root cause + preventive action.

## Data / privacy restrictions
- Never log prompts/completions/HR content (`AI_COST_LOG_PROMPTS=false`, `EMAIL_LOG_BODY=false`, redaction on).
- Incident evidence is redacted by default; RGPD applies to any personal data.

## Provider‑specific config still required (owner)
- Choose a monitoring vendor + alert channel; wire the app's structured errors/events to it.
- Rehearse the rollback; then attest `CLONESTORE_MONITORING_ROLLBACK_VERIFIED`.
- **Not claimed by E1:** `monitoringProviderConfigured=false` — the contract is ready; the vendor is not configured (code can never prove it).
