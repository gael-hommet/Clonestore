# P8.13 — Full Functional Matrix (Dimension A)

Every one of the **215 canon capabilities** classified into a certification state. Generated from the canon + mission packs; proof: `.p813-proofs/p813matrix-*/capability-certification.json`.

## Distribution (215 / 215 functionally certified, 0 NOT_CERTIFIED)

| State | Count | What it means |
|---|---|---|
| CERTIFIED_AUTOMATED | 70 | verified autonomous execution |
| CERTIFIED_AFTER_APPROVAL | 48 | executes after a required human validation |
| CERTIFIED_HUMAN_DECISION | 40 | legally-reserved human decision (Pierre assists/records) |
| CERTIFIED_FAIL_CLOSED | 36 | explicit legal blocking pending VERIFIED rules (certified behaviour) |
| CERTIFIED_MANUAL_GOVERNED_PATH | 21 | governed manual handoff (provider not integrated) |
| NOT_CERTIFIED | 0 | — |

## Automation blockers (why automatic execution isn't available — dimension B)

| Blocker | Count |
|---|---|
| none (fully automatable / after-approval) | 118 |
| human_reserved (legally a human decision) | 40 |
| legal_review (needs a VERIFIED country rule) | 36 |
| external_provider (needs a real provider) | 21 |

## Reading the matrix

- **118 capabilities** need no external unblock — they run automatically or after an in-app approval today.
- **40** are, and always will be, human decisions (Pierre governs + records, never decides) — 4 canon HUMAN_ONLY + verified/human capabilities.
- **36** are country-legal: Pierre correctly **fails closed** and routes to the governed fallback until a qualified human verifies the rule (P8.12).
- **21** need a real provider: Pierre runs the **governed manual handoff** until the integration is live (P8.12) — a manual path is explicitly **not** counted as an integration.

Every capability carries evidence (a prior-P8 test/proof, a mission pack that compiles on the real runtime, or the country/provider governed mechanism). The full per-capability table is in the proof JSON + the P8.11 [runtime coverage matrix](P8_11_RUNTIME_COVERAGE_MATRIX.md).

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
