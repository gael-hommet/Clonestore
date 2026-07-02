# P8.10 — Country-Pack Architecture

The jurisdiction layer of the HR canon: how Pierre applies country-specific HR law **without ever inventing a legal rule**. P8.10 builds the architecture + four scaffolded packs (FR, BE, LU, CH); P8.12 sources and legally reviews the actual rule values.

Code: [src/lib/pierre/v1/hr-canon/country-packs/](src/lib/pierre/v1/hr-canon/country-packs/) · Proof: `.p810-proofs/<run_id>/country-pack-summary.json`.

---

## 1. The "never invent law" guarantee

The central invariant: **no legal rule value comes from a model's memory.** Every rule ([types.ts](src/lib/pierre/v1/hr-canon/country-packs/types.ts) → `CountryRule`) carries a verification status:

| Status | Meaning | Value allowed? | Reliable? |
|---|---|---|---|
| `SOURCE_REQUIRED` | not yet sourced | must be `null` | no |
| `LEGAL_REVIEW_REQUIRED` | candidate exists, needs review | yes, with citation | no |
| `SOURCED_UNVERIFIED` | sourced, not yet reviewed | yes, with citation | no |
| `VERIFIED` | sourced + legally reviewed | yes, with citation + reviewer | **yes** |

[source-contract.ts](src/lib/pierre/v1/hr-canon/country-packs/source-contract.ts) enforces this: `SOURCE_REQUIRED` **must** have a null value; any non-null value **requires** a citation; `VERIFIED` **requires** a named reviewer. `isRuleReliable()` returns true only for `VERIFIED`. At P8.10 **every** rule in all four packs is `SOURCE_REQUIRED` with a null value (machine-verified: 0 verified, 0 source-contract errors).

## 2. Rule families (what varies by country)

[rule-families.ts](src/lib/pierre/v1/hr-canon/country-packs/rule-families.ts) catalogues **23 rule families** that HR capabilities depend on — e.g. contract types, probation, working time, minimum wage, paid leave, public holidays, sick leave, parental leave, notice periods, dismissal procedure, severance, fixed-term rules, collective agreements, payroll contributions, payslip requirements, employee representation, occupational health, mandatory trainings, document retention, right to work, data protection, disciplinary procedure, non-compete. Each declares the **required source types** (primary legislation, collective agreement, official guidance, case law, provider spec). Capabilities reference these family keys via `countryRuleDependencies` — the verify script cross-checks that every reference is a known family.

## 3. Pack structure & scaffold

Each pack ([registry.ts](src/lib/pierre/v1/hr-canon/country-packs/registry.ts) `scaffoldPack`) declares every required family with standard sub-rules, all `SOURCE_REQUIRED`. Result per country: **69 rules across 23 families**, 0 missing required families, all null-valued. Source **pointers** in the manifests indicate *where* P8.12 must source each family (e.g. FR: Code du travail + branch CBA; BE: joint-committee CBA + ONSS; LU: Code du travail + CCSS; CH: Code des obligations + LTr + cantonal + nLPD) — these are pointers to authoritative references, never asserted rule values.

- [france.ts](src/lib/pierre/v1/hr-canon/country-packs/france.ts) · [belgium.ts](src/lib/pierre/v1/hr-canon/country-packs/belgium.ts) · [luxembourg.ts](src/lib/pierre/v1/hr-canon/country-packs/luxembourg.ts) · [switzerland.ts](src/lib/pierre/v1/hr-canon/country-packs/switzerland.ts)
- Switzerland adds a **cantonal** dimension (`subRegion`) for holidays, minimum wage and some payroll families; and note its **non-EU** data regime (nLPD, not GDPR).

## 4. Jurisdiction resolution (fail-closed)

[jurisdiction-resolver.ts](src/lib/pierre/v1/hr-canon/country-packs/jurisdiction-resolver.ts): resolves the governing jurisdiction from real tenancy fields — **work-site country wins over company registration country**; unknown/unsupported countries resolve to `null` (Pierre must then treat country rules as `SOURCE_REQUIRED` and require configuration — never guess). Supported: FR, BE, LU, CH.

## 5. Precedence

[precedence.ts](src/lib/pierre/v1/hr-canon/country-packs/precedence.ts): structural layer ordering only — statutory > sector agreement > company agreement > company policy > individual contract. The labour-law **favourability** nuance (a lower layer may prevail if more favourable to the employee) is modelled but only applies when a **verified country rule** says so (`favourabilityApplies`) — it is never assumed.

## 6. What P8.12 must do

For each of the 32 country-dependent capabilities in the [gap register](P8_10_GAP_REGISTER.md): source each required rule family from authoritative references, obtain qualified legal review, and set the rule `VERIFIED` with a citation + reviewer. Until then, dependent capabilities cannot be operationally relied on for that country. No shortcut: the source contract makes an unsourced-but-used rule impossible to mark reliable.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
