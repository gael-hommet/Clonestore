# P8.11 — Remaining P8.12 Gaps

The 32 country-dependent capabilities the canon routes to **P8.12** (verified FR/BE/LU/CH legal content). P8.11 built their **orchestration**; P8.12 supplies the **legal rule values** (never invented — every country rule stays `SOURCE_REQUIRED` until sourced + legally reviewed, per [P8_10_COUNTRY_PACK_ARCHITECTURE.md](P8_10_COUNTRY_PACK_ARCHITECTURE.md)).

Source: `.p811-proofs/<run_id>/remaining-p812-gaps.json` (dynamic from the canon's `P812_GAPS`).

## 32 country-dependent capabilities by domain

| Domain | Count | Notes |
|---|---|---|
| absence | 5 | balance/entitlement, sick, parental, return-to-work, time — statutory values |
| offboarding | 5 | resignation, mutual termination, end-of-contract, final pay, file retention |
| payroll | 4 | export/transmission, official calculation, DSN/social declaration, payslip generation |
| contract | 3 | renewal, hours-change limits, end-of-probation |
| data_gdpr | 3 | legal basis/minimization, consent proof, retention |
| offer | 2 | offer document (binding), right-to-work |
| disciplinary | 2 | summons, statutory deadlines |
| health | 2 | mandatory medical visits, mandatory safety training |
| proactive | 2 | end-of-probation, retention-deletion |
| org | 1 | restructuring (employee representation thresholds) |
| recruitment | 1 | candidate data compliance |
| onboarding | 1 | probation tracking |
| training | 1 | mandatory training compliance |

## What P8.12 must do per gap

1. Resolve the applicable jurisdiction (already built: [jurisdiction-resolver.ts](src/lib/pierre/v1/hr-canon/country-packs/jurisdiction-resolver.ts)).
2. Source each required rule family (FR/BE/LU/CH) from authoritative references + obtain qualified legal review; set the rule `VERIFIED` with a citation + reviewer (the source contract forbids reliance otherwise).
3. Bind the verified values into the country packs; the P8.11 orchestration then runs end-to-end for that country.

The 4 **HUMAN_ONLY** capabilities (dismissal decision, disciplinary qualification & decision, whistleblower handling) remain human in P8.12 too — Pierre assists, never decides.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
