# P8.12 — Country Rule Source Register

The machine-readable register of **official** legal sources for FR/BE/LU/CH. **Cardinal rule: no legal rule value is invented from a model's memory.** This register names *where* each rule family must be sourced (the official authority + its official portal) — it never states a rule value. Every entry is `POINTER_ONLY` (content not yet retrieved/archived); retrieval + archival + qualified human legal review happen downstream, and only then can a derived rule become `VERIFIED`.

Code: [source-registry.ts](src/lib/pierre/v1/hr-canon/country-packs/source-registry.ts) · Script: [scripts/p812-source-country-rules.mjs](scripts/p812-source-country-rules.mjs) · Proof: `.p812-proofs/p812src-*/official-source-register.json`.

## Register (21 official-authority pointers, 0 content retrieved)

| Jurisdiction | Authority (pointer) | Official portal | Rule families |
|---|---|---|---|
| FR | République française (DILA) — Légifrance | legifrance.gouv.fr | contract, working time, leave, notice, dismissal, fixed-term, probation, disciplinary, parental, sick, severance |
| FR | service-public.fr | service-public.fr | public holidays, right to work, retention |
| FR | URSSAF | urssaf.fr | payroll contributions, minimum wage |
| FR | CNIL | cnil.fr | data protection |
| FR | Ameli / Assurance Maladie | ameli.fr | sick leave, occupational health |
| FR | Convention collective de branche (IDCC) | legifrance.gouv.fr | collective agreements, mandatory trainings |
| BE | Moniteur belge / Justel | ejustice.just.fgov.be | contract, notice, dismissal, working time, fixed-term, severance |
| BE | SPF Emploi | emploi.belgique.be | leave, sick, parental, working time, probation |
| BE | ONSS/RSZ | onss.be | payroll contributions, payslip |
| BE | Commission paritaire (CCT) | emploi.belgique.be | collective agreements, minimum wage, trainings |
| BE | APD/GBA | autoriteprotectiondonnees.be | data protection |
| LU | Légilux | legilux.public.lu | contract, working time, notice, dismissal, fixed-term, probation, severance |
| LU | Guichet.lu | guichet.public.lu | leave, holidays, right to work, parental, sick, retention |
| LU | CCSS | ccss.lu | payroll contributions, payslip |
| LU | ITM | itm.public.lu | occupational health, working time, trainings |
| LU | CNPD | cnpd.public.lu | data protection |
| CH | Fedlex (CO + LTr) | fedlex.admin.ch | contract, working time, notice, probation, fixed-term, dismissal, severance |
| CH | SECO | seco.admin.ch | working time, occupational health, trainings |
| CH | AVS/AHV | ahv-iv.ch | payroll contributions, payslip |
| CH | PFPDT/FDPIC (nLPD, non-EU) | edoeb.admin.ch | data protection |
| CH | Autorité cantonale | ch.ch | minimum wage, public holidays (cantonal) |

## Guarantees (machine-verified)

- **21 sources, 0 validation errors**, all `https://` official portals.
- **Every source is `POINTER_ONLY`**: `contentHash = null`, `retrievedAt = null` — nothing is passed off as retrieved official content. A content hash may only ever be of *archived official bytes*, never of model output ([source-snapshot.ts](src/lib/pierre/v1/hr-canon/country-packs/source-snapshot.ts) refuses to snapshot a `POINTER_ONLY` source).
- **18 required rule families** (dynamic from `P812_GAPS`) each mapped to ≥1 official source.

## What must happen next (not doable by a model)

Retrieve the official text from each portal, archive the raw bytes (real content hash), then a **qualified human legal reviewer** confirms each rule value + citation. Only then does the rule become `VERIFIED` and usable. Until then it stays `SOURCE_REQUIRED`.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
