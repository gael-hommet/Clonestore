# P8.14 — Truth Audit (before writing)

**Method:** 12 independent read-only auditors across every Pierre subsystem + a lead-architect
synthesis, cross-checked by owner-lead independent verification of the crux (final-brain wiring, the
three-stack disjointness). Proof: [`.p814-proofs/p814audit-f66f01f1ea/truth-audit.json`](.p814-proofs/p814audit-f66f01f1ea/truth-audit.json).
Row counts: **EXISTS 86 · PARTIAL 23 · MISSING 19** (128 rows / 12 clusters).

> Correction of the record: the P8.13 closure printed **"NO P8.14 REQUIRED."** That is **superseded**
> by the owner override. P8.13 closed the operational *substrate*; P8.14 gives it real intelligence.
> P8 is **not** closed until P8.14 passes. P8.13 evidence is preserved, not erased.

---

## 0. The one structural fact that reframes everything: THREE disjoint Pierre stacks

Pierre is not one system today — it is **three stacks**, and each auditor initially saw a different
one (which is why the raw headlines appear to contradict). All are correct about different code:

| Stack | Location | Plan authority | LLM on this path? | Live customer path? |
|---|---|---|---|---|
| **A. Legacy Supabase** | `api/pierre/use/submit/route.ts`, `pierre_missions/tasks` | `buildPierreHrWorkflowPlan` (deterministic) | `runPierreFinalBrain` runs but is **advisory metadata**; brain tasks inserted only if `aiMode==="primary"` AND quality-gate `safe_to_use` | **DEPRECATED (fallback)** |
| **B. V1 governed runtime** | `src/lib/pierre/v1/**`, `pierre_rt_*` | `analyzeInstruction` (regex, `analysis.ts`) → `createMission` (`mission-service.ts:103`) | **NONE on the create path** | **YES — the live path** |
| **C. V1 P8.5 run engine** | `createMissionRunFromPlan` + `runPierreRuntimeJobs` | Compiled + fingerprinted plan (world-class) | NONE | Only via a **hardcoded** canonical plan (`missions/first/route.ts`) |

**The gap is overwhelmingly integration, not capability.** The reasoning engine, the execution
engine, the providers, the budget gate, and the safety compiler already exist and are real — but on
the live customer path, **free-language understanding is never wired to the plan that executes.**

---

## 1. Crux — real AI or deterministic imitation on the *normal* path?

**Today, on the live customer path, Pierre is deterministic imitation. The LLM does not decide, plan,
or compose anything that reaches execution.** Verified chain: cockpit/CloneChat → `submitPierreMission`
→ (V1 flag on, default) `createMission` → `analyzeInstruction` regex rules → preset executor tasks.
`final-brain.ts` is not imported by `mission-service.ts`. The only place real LLM output becomes
durable tasks is the deprecated stack A, gated behind `aiMode==="primary"` + quality gate.

**Honest nuance:** the *substrate* is genuinely real and excellent — `runCloneAIContract` (real
Anthropic+OpenAI provider loop, schema-validated, budget-pre-checked), `createRealOpenAIResponder`
(server-side key, reserve→commit budget), and the fenced lease/compiler engine. P8.14's job is **not
to invent intelligence** — it is to **route the customer path through the real reasoning engine into
the governed run engine**, retiring the regex brain, with the plan-compiler as the safety proof.

This satisfies the owner's rule precisely: **the model proposes; the deterministic runtime validates
and acts.** The compiler (`compileMissionPlan`) is exactly what makes an LLM-authored plan trustable.

---

## 2. Verified substrate to REUSE (do NOT rebuild — no 2nd runtime)

- **Execution (crown jewels):** `compileMissionPlan` (Kahn cycle-detection, approval gates, resource
  bounds, fingerprint), `createMissionRunFromPlan` + immutable `pierre_rt_mission_runs/step_runs`,
  `runPierreRuntimeJobs` fencing/lease loop, SQL SECURITY-DEFINER claim/complete/fail (stale-token
  42501), durable waits + scheduler + transactional outbox, closed **13-action** `RUNTIME_ACTION_REGISTRY`
  (no eval), per-action `validateInput` + sha256 output hashing, `RUNTIME_LIMITS` fail-closed clamps.
- **Missions/validations:** `mission-service.ts` governed idempotent transitions, `state-machine.ts`,
  `ValidationRepo` fingerprint-pinned approvals, `autonomy.ts` `decideValidation`.
- **World model (read, permission-filtered):** `resolveTenantContext` (RBAC/site-scope/custom roles),
  `buildStrictGenerationContext` (fail-closed whitelist, cross-tenant refuse), `getEmployee360`,
  `buildCockpitSnapshot`, `custom-fields`.
- **AI infra:** `runCloneAIContract` provider loop, `model-router` PROFILE_POLICIES, atomic
  `checkBudget`/`checkSingleCallBudget`, `prompt-registry` contracts (`pierre.brain.final_interpret`,
  `.task_plan`), CloneChat `createRealOpenAIResponder` + prompt-injection + image sanitizer.
- **Docs/providers/comms:** magic-byte MIME + zip-bomb/macro defense + quarantine, deterministic
  PDF/DOCX render, `document-guard` fail-closed, provider evidence never fabricated, governed
  idempotent communications (real Resend + in-app) with injection-safe renderer + mandatory categories.
- **Pure-but-unwired logic to light up:** `hr-proactive` (`deduplicate`, `signalToMissionRequest`,
  `SIGNAL_REGISTRY`), `hr-operations` (`reconcile`, `approvalFor`, `governanceSummary`, opaque
  `subjectRef`), `hr-canon` (210+ capabilities), `hr-mission-packs` (`packToRuntimePlan`).

---

## 3. The 17 required-dimension verdicts

| # | Dimension | Verdict |
|---|---|---|
| 1 | Real LLM intelligence | REAL substrate, **not on customer path** |
| 2 | Free-language understanding | PARTIAL / advisory only |
| 3 | Multimodal input | PARTIAL (storage/security only) |
| 4 | Company context | PARTIAL (unwired to LLM) |
| 5 | Entity resolution | PARTIAL (exact-ID only; no homonym/manager/ambiguity) |
| 6 | Date resolution | PARTIAL/MISSING (no relative dates) |
| 7 | Dynamic capability composition | **MISSING** |
| 8 | Mission generation | **MISSING** (compiler exists; no NL→DAG generator) |
| 9 | Long-running autonomy | **REAL** |
| 10 | Durable memory | PARTIAL (operational yes, cognitive no) |
| 11 | Proactive initiative | PARTIAL (declarative; no detectors) |
| 12 | Adaptation (tone/channel) | MISSING |
| 13 | Learning from corrections | MISSING |
| 14 | Communications | **REAL** (deterministic; no LLM drafting/approval) |
| 15 | Unseen-request generalization | PARTIAL (advisory only) |
| 16 | Real OpenAI execution | **REAL** |
| 17 | Cost governance | PARTIAL (not wired per mission/entitlement) |

**Scoreboard: 3 REAL · 9 PARTIAL · 5 MISSING/advisory.**

---

## 4. Gap list by cognitive-runtime module (E=exists / P=partial / M=missing)

| Module | Status | Needed |
|---|---|---|
| request-interpreter | P (advisory) | promote LLM interpreter to authoritative on live path; replace `analyzeInstruction` as plan source |
| multimodal-input | P | PDF/DOCX extraction + chunking + bounded token limits + LLM-input sanitization |
| context-retrieval | P (unwired) | `buildLLMContext` assembling permission-filtered world/company/task into a prompt object |
| enterprise-world-model | E/P | reuse read layer; expose approval circuits + template governance |
| entity-resolution | P | homonym disambiguator, manager validator, `resolved/ambiguous/forbidden/not_found` enum |
| temporal-resolution | P/M | relative dates ("next week", "in 30 days") on top of `parseDate` + TZ |
| amount-resolution | **M** | fail-closed EUR/decimal-separator parser before comp missions |
| capability-retrieval | M (primitives exist) | LLM-ranked candidate capabilities/packs from interpretation |
| **plan-generator** | **M (compiler exists)** | **keystone**: NL → `RuntimePlanInput` DAG consumable by `compileMissionPlan`, registered actions only |
| plan-validator | **E** | reuse `compileMissionPlan` unchanged as the safety proof |
| clarification-engine | M | missing_info → durable `wait.for_event` → resume |
| autonomy-policy | **E** | reuse `decideValidation`; feed LLM per-step risk |
| risk-policy | E/P | source risk from LLM but keep guard as fail-closed backstop (LLM can never downgrade) |
| tool-registry | **E** | reuse closed `RUNTIME_ACTION_REGISTRY` |
| execution-controller | **E** | reuse `runPierreRuntimeJobs` |
| continuation-controller | **E** | reuse durable waits + scheduler + recovery |
| proactive-controller | P (unwired) | scheduled DB detectors → existing dedup → mission-creation + priority gate |
| operational-memory | P | per-mission-run cognitive-state (resolved entities/confirmed facts/rejected assumptions/plan versions) |
| learning-policy | M | correction intake + feedback reconciliation + preference learning (no cross-company leak) |
| usage-accounting | P | persist tokens per mission/task/step |
| budget-gate | **E** | reuse atomic gate; surface cumulative per-tenant |
| model-policy | E/P | tie eligible models to `resolveProductAccess` |
| openai-client | **E** | reuse real responder + provider loop |

---

## 5. Build order (max reuse, highest-value intelligence first)

1. **P1 — Close the loop (keystone; delivers dims 1,2,7,8,15):** `plan-generator` (via `runCloneAIContract`, emitting only registered actions) → **existing** `compileMissionPlan` → `createMissionRunFromPlan` → `runPierreRuntimeJobs`. Retire `analyzeInstruction` on the live path; keep regex as deterministic fallback (mirror `aiMode==="off"`). Guard/autonomy stay fail-closed backstops.
2. **P2 — Ground the reasoning (dims 4,5,6 + amounts):** `context-retrieval` `buildLLMContext`; unified `entity-resolution`; `temporal-resolution` + fail-closed `amount-resolution`.
3. **P3 — Clarify + breadth:** `clarification-engine` (durable wait→resume); `capability-retrieval` (LLM-ranked packs/capabilities).
4. **P4 — Proactive + cases (dim 11; wire the unwired):** scheduled detectors → `deduplicate` → `signalToMissionRequest` → the P1 spine + priority gate; wire `hr-operations` into mission-service + the **P8.14→P9 contract**.
5. **P5 — Memory/learning/adaptation/cost:** cognitive-state table; usage per mission + model-policy↔entitlements; learning intake; optional LLM comms drafting behind existing approval + injection-safe renderer.

**Invariants preserved throughout (never regress):** closed action registry (no eval); fail-closed
guard/policy the LLM can never downgrade; fencing/lease on every effect; atomic budget gate before
every LLM call; `company_id=$1` isolation; no fabricated provider success; server-side
tenant/permission resolution.

**Architecture decision:** the new `src/lib/pierre/v1/cognitive-runtime/**` is the **one authoritative
orchestration layer** that composes these existing real primitives + the genuinely-missing modules.
It is **not** a second mission/task/validation/execution runtime (forbidden). CloneChat/cockpit/P9
are interfaces that call it; they never plan HR themselves.

**Bottom line: P8.14 ≈ 80% integration, 20% new intelligence.**
