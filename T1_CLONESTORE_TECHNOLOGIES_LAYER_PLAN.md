# T1 — CloneStore Technologies Layer Plan

**This plan does NOT build.** It defines the reusable CloneStore technologies layer (Session B). **Doctrine:** technologies are **reusable CloneStore capabilities**, not Pierre features. Pierre (and future AI employees) consume them **through contracts** (the P16C adapters). No technology is hardcoded for Pierre only unless explicitly justified. Everything ships behind safe flags, non-production; anything not live degrades safely.

## The 15 technologies

| # | Technology | Purpose | Current state in repo | Build status | Safe local impl | External/live | Risk | Phase |
|---|---|---|---|---|---|---|---|---|
| 1 | **DocumentTech** | Prepare / render / export documents | document-types + renderer (Pierre) | needs abstraction | template + render (local) | — | med | T1 |
| 2 | **MailTech** | Draft (and, live, send) emails | communications.ts + providers | partial | draft only | live send = domain/provider (external) | med | T1 |
| 3 | **CalendarTech** | Prepare events / interviews | — | missing | prepared event object | live = calendar provider | med | T1 |
| 4 | **SignatureTech** | Signature provider abstraction (fallback/live) | p15-provider-closure | architecture_ready | prepared-doc fallback | Yousign live (P8.7.4 blocked) | med | T1 |
| 5 | **VoiceTech / CloneVoice** | Voice input → mission | clonevoice-contract (registry) | architecture_ready | text remains authoritative | speech provider | high | later |
| 6 | **NotificationTech** | Reminders / notifications | cockpit reminders | partial | cockpit reminders | push provider | med | T1 |
| 7 | **ConnectorTech** | SIRH/payroll/Slack connectors | channels.ts | architecture_ready | — | external providers | high | later |
| 8 | **MemoryTech** | Durable company memory | durable pg (P8.14) + CloneADN | **verified** | already durable | — | low | T1 |
| 9 | **EvidenceTech / TraceTech** | Audit trail / proof | timeline + pierre_rt_ audit | partial | already persisted | — | low | T1 |
| 10 | **WorkflowTech** | Reusable workflow engine | mission engine + case FSM (Pierre) | partial | governed engine | — | high | T1 |
| 11 | **AnalyticsTech / ROI** | Metrics + value/ROI reports | analytics.compute (P8.14) | partial | RLS SQL → artifacts | — | med | T1 |
| 12 | **FileTech** | File / image ingestion | multimodal screenshot + EXIF (P9.4) | partial | image + text ingest | — | med | T1 |
| 13 | **ExportTech** | Export documents/data | document exports | partial | file export | — | low | T1 |
| 14 | **PermissionTech / scope** | Roles / permissions / scope | RLS + requireCompanyUser | **verified** | already enforced | — | med | T1 |
| 15 | **IntegrationBus / TechnologyBus** | Registry+bus so ANY employee consumes technologies | employee-context-registry (seed) | architecture_ready | contract registry | — | high | T1 |

## What Pierre needs vs future employees
- Each technology exposes a **contract** (input/output + validation + audit). Pierre uses it via a P16C adapter; a future employee (e.g. a finance or sales AI employee) uses the **same** contract via its own adapter — no per-employee hardcoding.
- The **TechnologyBus** (built on the existing employee-context-registry) is the key enabler: a registry of technologies + capability discovery, so employees declare which technologies they consume.

## API contract shape (per technology)
```
interface Tech<In, Out> {
  readonly id: string;
  prepare(input: In, ctx: TechContext): Promise<TechResult<Out>>;   // pure/preparation
  readonly requiresValidation: boolean;                              // sensitive/effectful → human gate
  readonly liveDependency: "none" | "provider" | "external";
  readonly safeFallback: string;                                    // behavior when not live
}
```

## Tests + risk
- Each technology: unit tests on the contract + safe fallback; no live call in tests; live paths gated behind flags.
- Highest risk: **WorkflowTech** (must not become a second HR brain — it is a generic engine; Pierre's HR reasoning stays in V1), **TechnologyBus** (cross-employee surface), **ConnectorTech/VoiceTech** (external).

## Guardrails
- Reusable across CloneStore — never Pierre-only without an explicit, recorded justification (enforced by the master split's `hardcodedPierreOnlyTechnologies` check).
- Non-live technologies degrade safely (fallbacks above).
- Production OFF; no payment; no deploy.

**Next prompt to run this workstream:** `START T1 — CLONESTORE TECHNOLOGIES LAYER`.
