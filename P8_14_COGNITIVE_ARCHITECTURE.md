# P8.14 — Cognitive Architecture

One authoritative server-side cognitive runtime at [`src/lib/pierre/v1/cognitive-runtime/`](src/lib/pierre/v1/cognitive-runtime/)
that **orchestrates the verified P8 substrate** — it is NOT a second mission/task/validation/execution
runtime. The model **proposes**; the deterministic runtime **validates and acts**.

## Pipeline

```
NL request / event / document
 → server-side company/actor/permission resolution   (withProductAccess, resolveTenantContext)
 → context retrieval (bounded, tenant-safe)           (capability-retrieval + existing generation-context)
 → REAL LLM interpretation                            (cognitive-analyzer → runCloneAIContract)
 → entity / date / amount resolution                  (entity/temporal/amount-resolution)
 → clarification (smallest useful questions)          (clarification-engine)
 → dynamic plan generation                            (plan-generator → RuntimePlanInput)
 → DETERMINISTIC plan validation (safety proof)       (compileMissionPlan — REUSED unchanged)
 → autonomy / risk / permission / human-only gates    (autonomy-policy → decideValidation + cloneguard)
 → persisted mission + governed execution             (createMission / createMissionRunFromPlan — REUSED)
 → server re-read (no fabricated success)             (evidence)
 → durable continuation across restart                (continuation-controller over pierre_rt_* + scheduler)
 → operational memory (work, not chain-of-thought)    (operational-memory)
```

## Modules (all additive)

| Module | Role | Reuses |
|---|---|---|
| `cognitive-analyzer` | authoritative live-path planner (LLM + regex degraded fallback + **safety floor**) | `runCloneAIContract`, `analyzeInstruction` |
| `request-interpreter` | one `PierreRequestInterpretation` (§6) | analyzer + retrieval + resolution + clarification |
| `plan-generator` | NL → compiled fingerprinted plan; **invented-action defense** | `compileMissionPlan`, `runtime-action-registry` |
| `entity/temporal/amount-resolution` | fail-closed resolution; homonym→ambiguous; no cross-tenant leak | — (pure) |
| `capability-retrieval` | bounded relevance ranking over the 215-cap canon (FR↔EN) | `HR_CAPABILITIES` |
| `autonomy-policy` / `tool-registry` | 3-mode classification; closed tool allowlist | `decideValidation`, `cloneguard`, action registry |
| `execution-controller` / `continuation-controller` | real run engine + durable status mapping | `createMissionRunFromPlan`, `runPierreRuntimeJobs` |
| `operational-memory` / `learning-policy` | durable work state; safe corrections (no CoT, no cross-tenant) | — |
| `proactive-controller` | detect → dedup → priority → governed mission | `deduplicate`, `signalToMissionRequest` |
| `evidence` / `usage-accounting` | server re-read verification; atomic budget gate | cloneos budgets |
| `intelligence-service` / `p9-contract` | request→interpret→preview; stable P9 contract | — |

## The safety spine (never regressed)

- **Compiler is the authority.** An LLM plan is only trusted after `compileMissionPlan` (cycles, unknown
  actions/deps, approval gates, bounds, fingerprint). Invented `action_key`s are dropped first.
- **The LLM can never downgrade a sensitive verdict.** `raiseFloor` + `applySafetyFloor` merge the
  deterministic detector as a floor; harassment/termination/compensation/restructuring always gate.
- **Closed tool allowlist.** The model can only reference the 13 registered runtime actions — no
  arbitrary SQL/URL/shell/provider call is representable.
- **Server-side tenant/permission.** The browser never supplies authoritative tenant/role.
- **Degraded mode is honest.** No model/key → deterministic fallback that no-ops rather than guess.

## Model proposes, runtime governs

`isCognitivePlannerEnabled()` = production AI mode (real key) or explicit opt-in. In production the LLM is
authoritative on the live path; without a key it is the degraded fallback (owner-permitted). CloneChat/P9
call this runtime for HR requests and never plan HR themselves.
