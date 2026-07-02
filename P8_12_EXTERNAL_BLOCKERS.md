# P8.12 — External Blockers

The blockers outside Pierre's code that must be lifted (by qualified humans / real integrations) before any country becomes launch-grade. Proof: `.p812-proofs/p812-*/external-blockers.json`.

| Blocker | Status | Effect | Lifted by |
|---|---|---|---|
| **Qualified human legal reviewer** | REQUIRED (absent) | No country rule can become `VERIFIED`; every legally-sensitive act stays blocked | A named, qualified legal professional attesting each officially-sourced rule (per [P8_12_LEGAL_REVIEW_PACKETS.md](P8_12_LEGAL_REVIEW_PACKETS.md)) |
| **Official rule retrieval + archival** | PENDING | Rules stay `SOURCE_REQUIRED` (pointers only) | A retrieval pipeline archiving raw official bytes from the registered portals |
| **P8.7.4 — Yousign** | OPEN | e-signature not usable; governed manual signature path only | External resolution of the sandbox org-membership blocker |
| **Certified payroll engine + social declarations** | NOT_INTEGRATED | Pierre prepares/validates only; official computation + DSN/ONSS/CCSS declarations external | Real payroll provider integration + credentials |
| **Identity / time / benefits / training providers** | NOT_INTEGRATED | Governed manual handoff paths only | Real provider integrations + credentials |
| **Deploy block** | ACTIVE (`NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1`) | Pierre not publicly enabled | A separate final launch gate (owner-approved), not part of P8.12 |

None of these can be lifted by a model. P8.12 delivered everything up to each blocker: the engine, the sourcing register, the review packets, the provider adapters + manual paths, and the fail-closed gate.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
