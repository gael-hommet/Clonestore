# P8.13 — Provider Readiness (Dimension B)

**0 / 6 providers are launch-grade.** A manual governed path is explicitly **NOT** counted as an integration. Proof: `.p813-proofs/p813-*/final-report.json` + P8.12 provider proofs.

| Provider | Status | Live-grade | Manual path | Note |
|---|---|---|---|---|
| yousign | **blocked** | ✗ | ✅ | external blocker P8.7.4 |
| payroll | not_configured | ✗ | ✅ | certified engine + declarations external |
| identity | not_configured | ✗ | ✅ | account/access provisioning manual |
| time_attendance | not_configured | ✗ | ✅ | attendance import manual |
| benefits | not_configured | ✗ | ✅ | enrollment manual |
| training | not_configured | ✗ | ✅ | enrollment manual |

- **live-grade = 0** (a provider is live only when real credentials + explicit live mode + not blocked).
- **manual paths = 6** — every provider degrades to a governed manual handoff so missions never dead-end.
- **No provider was contacted; no submission fabricates success** (proven in P8.12 + re-checked in P8.13 scenarios).

Launching a provider requires a real integration + credentials (payroll/identity/time/benefits/training) or lifting the Yousign blocker (P8.7.4) — none doable by a model. The orchestration + manual path stay unchanged when a provider goes live.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
