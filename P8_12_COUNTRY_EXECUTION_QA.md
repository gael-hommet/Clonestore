# P8.12 — Country Execution QA

How the country-aware, fail-closed execution is verified.

Code: [hr-country-execution/](src/lib/pierre/v1/hr-country-execution/) · Scripts: [p812-country-execution-scenarios.mjs](scripts/p812-country-execution-scenarios.mjs), [p812-final-gate.mjs](scripts/p812-final-gate.mjs).

## The fail-closed execution gate

[execution-gate.ts](src/lib/pierre/v1/hr-country-execution/execution-gate.ts): given a mission pack + jurisdiction, it resolves the required country rules, freezes an auditable rule snapshot, and evaluates every rule. The automated legally-sensitive path is allowed **only if every required rule is VERIFIED + fresh**. Otherwise the mission routes to the pack's governed fallback (`HUMAN_DECISION` / `GOVERNED_MANUAL` / `EXTERNAL_BLOCKED`) — never executed on an unsourced or stale rule.

## Scenario results (machine-verified)

- **48 execution scenarios** = 12 country-dependent mission packs × {FR, BE, LU, CH}.
- **48 / 48 blocked from automated execution** (fail-closed) — because 0 rules are VERIFIED.
- **48 / 48 routed to a governed fallback** (human/manual/external), never automated.
- **Jurisdiction resolver**: site-country wins over company-country; unknown country → `null` (fail-closed). 4/4 scenarios correct.
- **Capability transitions**: all 32 P8.12 gaps remain `COUNTRY_RULES_REQUIRED` (engine ready; human-verified rules pending) — **no false transition to "verified"**.

## Unit tests (20, across 3 suites)

- **country-packs/__tests__/p812-sourcing-engine.test.ts** — source register is pointer-only; all rules unverified/null; unverified rule not usable; AI can never be reviewer; attestation gate; stale-rule blocked; snapshot integrity; review packet.
- **hr-country-execution/__tests__/execution-gate.test.ts** — country mission blocked; **every P8.12 gap's pack blocked for all 4 countries**; auditable snapshot + evidence; routes to governed fallback.
- **provider-integrations/__tests__/providers.test.ts** — none usable; Yousign blocked; submission never simulates success; every provider has a manual path; fail-closed webhooks; live provider requires a real adapter (throws, never faked).

## Terminal validation

`node --check` on all 5 P8.12 scripts · **76 tests** (P8.12 + P8.11 + P8.10 + P8.9 non-regression) pass · `tsc` clean · `npm run build` clean.

## Honest limitations

The engine is complete + fail-closed, but **0 rules are VERIFIED** (no qualified human reviewer) and **0 providers are live** (none configured; Yousign blocked). Therefore **no country is launch-grade** and **no legally-sensitive act executes automatically**. That is the correct, honest state — not a defect.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
