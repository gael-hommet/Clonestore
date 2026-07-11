# P16C — Canonical Integration Gap Matrix

**Evidence-derived** from the real repository, not invented. Recovered from `P16_MASTER_SPLIT` (category **C — INTEGRATION**, `src/lib/clonestore/ultimate/p16-master-split.ts`) and the plan doc (`P16C_PIERRE_TECHNOLOGIES_INTEGRATION_PLAN.md`). The canonical P16C integration set = **the 10 Pierre→Technology adapters**. Cross-checked fail-closed by `crossCheckCanonicalIntegrationItems()` (keys ≡ master-split ids; every declared T1/T2 id resolves against the real registry). 

**Doctrine rule applied:** *a type or registry entry alone is not integration; an item is complete only when a real runtime path consumes it and tests prove the behavior.* An item with a **live/external** dependency is marked **BLOCKED (live) / integrated local-safe** — the local-safe path is proven, the live path stays blocked by design.

Test evidence column references the test families in `src/lib/clonestore/integration/p16c/__tests__/p16c-integration.test.ts` (79/79 green) and the `.p16c-proofs/pierre-technologies-integration/` proof files.

| # | Canonical ID | Adapter title | Src→Dest | T1 / T2 consumed (real registry) | Existing wiring pre-P16C | P16C runtime path | Security / governance | External/live dep | Test evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `int.document_adapter` | PierreDocumentTechAdapter | pierre→t1+t2 | T1 `document`,`export` · T2 `cloneadn`,`clonereview`,`clonebrief` | none (P16A declared) | `resolveT1Steps`→bus.prepare · `runCloneOSRequest`(ADN/Review/Brief) | prepared→human-validate; no legal guarantee | none | C11–14, D28–29, F47 | **integrated (local-safe)** |
| 2 | `int.mail_adapter` | PierreMailTechAdapter | pierre→t1 | T1 `mail` | none | `resolveT1Steps`→bus.prepare (draft only) | draft ≠ sent; `send:true`→blocked | **email provider live — BLOCKED** | C15, F48, scenario 10 | **integrated local-safe / live blocked** |
| 3 | `int.calendar_adapter` | PierreCalendarTechAdapter | pierre→t1 | T1 `calendar` | none | bus.prepare (event prepared) | prepared ≠ created live; `createLive:true`→blocked | **calendar provider live — BLOCKED** | C17 | **integrated local-safe / live blocked** |
| 4 | `int.signature_adapter` | PierreSignatureTechAdapter | pierre→t1 | T1 `signature` | none (P15 provider-closure abstraction) | bus.prepare (package prepared) | prepared ≠ signed; `signLive:true`→blocked | **Yousign live (P8.7.4) — BLOCKED** | C16, F49, scenario 11 | **integrated local-safe / live blocked** |
| 5 | `int.voice_adapter` | PierreVoiceTechAdapter | pierre→t1+t2 | T1 `voice` · T2 `clonevoice` | none (`later` in master split) | T2 CloneVoice contract (text authoritative) | text authoritative; no audio; no live-voice claim | **voice provider — BLOCKED (roadmap)** | D35 | **architecture-ready / live blocked** |
| 6 | `int.notification_adapter` | PierreNotificationTechAdapter | pierre→t1+t2 | T1 `notification` · T2 `clonesignals` | cockpit reminders (P8) | bus.prepare (cockpit reminder) · CloneSignals candidates | reminder ≠ push; `push:true`→blocked; signals armed by human | **push live — BLOCKED** | C18, D31, I69 | **integrated local-safe / live blocked** |
| 7 | `int.analytics_adapter` | PierreAnalyticsTechAdapter | pierre→t1 | T1 `analytics` | `analytics.compute` (RLS) | bus.prepare (metrics artifact) | ROI = estimate, never guaranteed | none | C11–14 | **integrated (local-safe)** |
| 8 | `int.evidence_adapter` | PierreEvidenceTechAdapter | pierre→t1+t2 | T1 `evidence` · T2 `clonetrace` | audit-trail (V1) | `runCloneOSRequest`→CloneTrace (consumes real T1 EvidenceTech) | provenance preserved; no completion without evidence; no secrets | none | D27, F50, proof `clonetrace-integration` | **integrated (local-safe)** |
| 9 | `int.workflow_adapter` | PierreWorkflowTechAdapter | pierre→t1+t2 | T1 `workflow` · T2 `cloneos`,`clonecontinuum` | V1 mission engine | `adaptPierreToCloneOS`→`runCloneOSRequest` | generic orchestration; **never decides HR outcome**; V1 stays the brain | none | D26, D30, F43–44 | **integrated (local-safe)** |
| 10 | `int.permission_adapter` | PierrePermissionTechAdapter | pierre→t1+t2 | T1 `permission` · T2 `clonepolicy`,`cloneguard`,`clonetrust` | RLS + requireCompanyUser | `checkTechnologyPermission` + governance pipeline (Guard/Policy/Trust) | fail-closed; completes (never replaces) RLS | none | C13, C20, D23–25, E36–42 | **integrated (local-safe)** |

## Recovery cross-check (fail-closed)

```
crossCheckCanonicalIntegrationItems() → { ok: true, masterSplitCount: 10, recoveredCount: 10,
  missing: [], invented: [], technologyDrift: [] }
```
No item invented, no item omitted, every declared T1/T2 id resolves against the real registry.

## Rollup

- **Completed local-safe (5):** `document`, `analytics`, `evidence`, `workflow`, `permission` — no external dependency, full runtime path + tests.
- **Integrated local-safe / live blocked (5):** `mail`, `calendar`, `signature`, `notification`, `voice` — local-safe path proven; the **live** path stays blocked by design (external provider / Yousign / push / voice unverified). These are *not incomplete integrations* — they are complete integrations whose *live effect* is intentionally floored off.
- **Second HR brain created:** no (capability count derived from the one registry = 215; `selectedCapabilityIds` consumed verbatim).
- **Production / payment / live:** OFF (`PRODUCTION_AUTHORIZED=false`, `resolvePaymentMode≠live`, `isLiveExecutionAllowed=false`, `externallyExecutable=false`).

**An item is "complete" only where a real runtime path consumes it and a behavior test proves it. Every row above cites that path and that test.**
