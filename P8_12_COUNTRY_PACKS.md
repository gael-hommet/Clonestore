# P8.12 — Country Packs (FR/BE/LU/CH)

The country-pack + rule engine built on P8.10's architecture. **276 rules across 4 packs, 0 VERIFIED, 0 invented** — every rule stays `SOURCE_REQUIRED` with a null value until a qualified human reviews an officially-sourced value.

Code: [country-packs/](src/lib/pierre/v1/hr-canon/country-packs/) · Verify: [scripts/p812-verify-country-packs.mjs](scripts/p812-verify-country-packs.mjs) · Proof: `.p812-proofs/p812cp-*/country-pack-summary.json`.

## The rule engine (P8.12 additions)

| Module | Role |
|---|---|
| [source-registry.ts](src/lib/pierre/v1/hr-canon/country-packs/source-registry.ts) | official-authority pointers (no rule values) |
| [source-snapshot.ts](src/lib/pierre/v1/hr-canon/country-packs/source-snapshot.ts) | immutable versioned snapshot of *archived official bytes* (sha256); refuses `POINTER_ONLY` |
| [source-freshness.ts](src/lib/pierre/v1/hr-canon/country-packs/source-freshness.ts) | per-family staleness policy (a VERIFIED rule goes STALE and must be re-sourced) |
| [legal-review.ts](src/lib/pierre/v1/hr-canon/country-packs/legal-review.ts) | review packets + the human-attestation contract (an AI/model can never be the reviewer) |
| [rule-evaluator.ts](src/lib/pierre/v1/hr-canon/country-packs/rule-evaluator.ts) | **fail-closed**: a rule is usable only if VERIFIED + fresh + valued |
| [rule-snapshot.ts](src/lib/pierre/v1/hr-canon/country-packs/rule-snapshot.ts) | freeze the exact rule versions a mission uses (reproducible) |
| [rule-conflicts.ts](src/lib/pierre/v1/hr-canon/country-packs/rule-conflicts.ts) | detect cross-layer conflicts (statutory/sector/company/contract) |
| [rule-diff.ts](src/lib/pierre/v1/hr-canon/country-packs/rule-diff.ts) | detect legal drift between rule snapshots |

## Status (machine-verified)

- **276 rules** (4 × 69 sub-rules), all packs valid.
- **0 VERIFIED**, **0 invented** (no non-null value without verification), all values `null`.
- Source register valid (0 errors).
- The verification ladder is intact: `SOURCE_REQUIRED → SOURCED_UNVERIFIED → LEGAL_REVIEW_REQUIRED → VERIFIED`; only `VERIFIED` authorizes a legally-sensitive act.

## Switzerland note

CH carries a cantonal dimension (`subRegion`) for minimum wage + public holidays, and a **non-EU** data regime (nLPD, not GDPR) — both encoded in the register + resolver.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
