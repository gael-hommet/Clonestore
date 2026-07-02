# P8.12 — Provider Integrations

The governed provider-integration layer. **6 providers, 0 usable, Yousign blocked, no provider ever contacted, no success ever simulated** — every provider degrades to a governed manual handoff so missions never dead-end.

Code: [provider-integrations/](src/lib/pierre/v1/provider-integrations/) · Verify: [scripts/p812-verify-provider-integrations.mjs](scripts/p812-verify-provider-integrations.mjs) · Proofs: `.p812-proofs/p812prov-*/`.

## Providers

| Provider | Status | Manual path | Note |
|---|---|---|---|
| yousign (e-signature) | **blocked** | ✅ | external blocker **P8.7.4** — never usable regardless of credentials |
| payroll (certified engine + declarations) | not_configured | ✅ | Pierre never computes official payroll |
| identity (accounts/access) | not_configured | ✅ | provisioning/revocation manual until IdP configured |
| time_attendance | not_configured | ✅ | attendance imported manually |
| benefits | not_configured | ✅ | enrollment manual |
| training / LMS | not_configured | ✅ | enrollment manual |

## Guarantees (machine-verified)

- **`usable = 0`** — a provider is usable only when LIVE-configured (real env credentials + explicit live mode) AND not blocked. None qualifies here.
- **Yousign is `blocked`** even with credentials + live mode (test proves it).
- **Submission never fabricates success** — for every provider, `submit()` returns `routed_to_manual` with a real manual handoff id and a `null` provider reference. A live-configured provider would require a real adapter and **throws** rather than fake a call.
- **Webhook verification is fail-closed** — no configured secret ⇒ rejected; wrong signature ⇒ rejected (HMAC-SHA256, constant-time).
- **Credentials come only from the environment**, never hardcoded, never logged (presence-only checks).
- **No real provider smoke test performed** (`real-provider-smoke.json`: `performed=false`) — nothing was contacted.

## How execution uses this

A mission's external step calls `submit()`. Not usable → governed manual handoff opened; a human performs the external action and records the result; `reconcileProvider()` applies it idempotently (ambiguous ≠ success). When a real provider is later configured + live, the same call performs the real submission — the orchestration is unchanged.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
