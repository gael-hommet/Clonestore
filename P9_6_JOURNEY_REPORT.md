# P9.6 — End-to-End Pierre Product Journey — VERIFIED

**Date:** 2026-07-08 · **Scope:** prove the FULL customer journey for Pierre (the authoritative AI HR employee, governed by the P8 / Pierre‑V1 runtime) inside CloneStore, on a **REAL local test company (`companyResolved:true`)**, with no production activation, no second HR brain, no P8 modification.

> Journey proven: onboarding entreprise → empreinte → réglage autonomie → CloneChat → mission Pierre → cockpit → preuves → **validations** → reload/resume.

---

## Verdict

**P9.6 — END-TO-END PIERRE PRODUCT JOURNEY VERIFIED.**

Browser proof `P96_JOURNEY_OK` (2 consecutive stable runs, real UI Confirmer click), 22/22 targeted tests, tsc 0 errors, zero residue. Independent adversarial review: **SOUND** (all 8 load-bearing claims hold; the one caveat — human validation not exercised — was closed by step J).

---

## What was built

### §2 — Journey contract (`src/lib/clonestore/pierre-journey/journey-contract.ts`)
Canonical, machine-verifiable definition of the journey: **16 ordered steps** (access → company → membership → footprint → autonomy → chat_request → proposal → confirm → execute → mission_created → cockpit_mission → cockpit_evidence → validation → result_persist → no_double_execute → audit_trail), each with UI surface + API proof point + security invariant. Plus `SECURITY_INVARIANTS`, `ALLOWED_TEST_SHORTCUTS`, and `FORBIDDEN_SHORTCUTS` (names `u:<userId>`, `companyResolved:false`-only, execute bypass, "assistant/copilote", second HR brain, production). Pure TS — no HR logic.

### §3 — Real local test company (`companyResolved:true`)
The critical enabler. Recipe (harness `scripts/p96-journey-e2e.mjs`):
1. Ephemeral Supabase user + `orders` (Pierre access) → real `signInWithPassword` (captures the exact `sb-…-auth-token` cookie the app uses).
2. **Binding step (the crux):** `POST /api/internal/e2e/session` with `user_id = supabaseUser.id` — so the PGlite company is owned by the Supabase id and `resolveCloneChatCompany(supabaseUserId)` resolves it. (The existing p93/p94 scripts used a random seed id and never bound → this is the gap P9.6 closed.)
3. Real provisioning: `activation → commercial-event → activation-tick → PATCH company (legal) → onboarding steps → complete → product-access = allowed`. Nothing pre-seeded.
4. Browser gets **both** cookies (Supabase non-httpOnly + `pierre_e2e_session` httpOnly, same `user_id`); the loopback forwards both so V1 identity resolves in E2E mode.

Result: `companyId` a real UUID (`companyIdIsUuid:true`), distinct from `userId`, `accessDecision:"allowed"`. **Not** the `u:<userId>` fallback (flag off + membership present → unreachable).

### §4 — Journey UI (no second HR planner)
- `journey-status.ts` — pure readiness helper: derives `blocked | onboarding | operating` + 6 honest items (company/autonomy/mission/validation/evidence/result) from **existing** P8/cockpit signals. No decision logic.
- `JourneyReadinessView.tsx` — new cockpit "Parcours" view (fetches `/api/assistant/autonomy` for company+mode; receives cockpit data as props). Bridges to existing surfaces; no HR logic.
- `shell-nav.ts` / `OperationalCockpitShell.tsx` — added the "journey" view (renders outside the operational-data gate, like autonomy).

### §5 — E2E browser proof (isolated `NEXT_DIST_DIR=.next-p96`, port 3260, `next dev`)
Real authenticated browser (real Supabase JWT validated server-side). Proofs in `.p96-proofs/p96-run1/`, screenshots in `docs/qa-screenshots/p9-6/` (A journey, B autonomy, C proposal, D confirmed, F cockpit-mission, G reload, H validations, J result).

| Step | Proof (canonical run) |
|------|------------------------|
| **A** readiness | `companyResolved:true`, journey level visible, 6 items, company=`done` |
| **B** autonomy | POST `{productModeId:controlled}` → GET reflects `controlled` (**persisted** via P8 column) |
| **C** CloneChat | real OpenAI (`source:openai`, tool `prepare_mission`) → `create_mission` proposal; **autonomy reflected** `{controlled / high_autonomy}` |
| **D** execute | **Real UI "Confirmer" click** (`confirmClicked:true`, no fallback) → `/execute` body = `["proposalId"]` only → `executed`, real mission; **forged replay → `duplicate`** (hostile fields ignored) |
| **E** mission | V1 mission exists, status `awaiting_validation` |
| **F** cockpit | mission title "Plan cognitif: 3 tâche(s)" **visible in DOM**, no "assistant" framing |
| **G** reload | mission still present (count 1) |
| **H** no-double | duplicate confirm → `duplicate`; **exactly one** mission in company |
| **J** validation | 3 pending validations → **all `approved`** via governed V1 endpoint (real human-validation path) |
| **I** security | companyResolved · no user-tenant-fallback · execute-by-reference-only · forged-ignored · no-double · human-validation-exercised · framing-clean · **0 non-benign console errors** |

Cleanup: **ZERO RESIDUE** (auth+profiles+orders verified deleted every run).

### §6 — Targeted tests (22/22)
- `journey-contract.test.ts` (7): contract complete, invariants, forbidden shortcuts, framing.
- `journey-status.test.ts` (5): honest readiness levels.
- `journey-p96.test.ts` (10): contract complete; companyResolved required / u:<userId> forbidden; autonomy product→engine mapping; proposal reflects resolved mode; **createMissionV1 forwards autonomy_mode only for a valid P8 engine mode (forged/unknown omitted)**; real engine governs (restricted → human_only/blocked in every mode); duplicate confirm → same command fingerprint; cockpit readiness honest; **hard floors** (restricted never auto-executes in any mode incl. governed/dirigeant); no "assistant RH"/"copilote" framing.

---

## Honest disclosures (boundaries)

1. **`next dev` is required** (not a production build): the PGlite E2E runtime is gated by `NODE_ENV≠production`. Dev-mode HMR/Fast-Refresh emits a benign cross-origin chunk-parse console artifact ("Invalid or unexpected token", empty stack) — recorded raw in `security-proof.json` for transparency; non-benign console errors = `[]`. A real syntax error would have broken the whole journey (it didn't).
2. **Mission ends at `awaiting_validation`** after all validations are approved. The P8 cognitive-runtime continuation to a terminal completed deliverable (step 14 "résultat abouti") is **not** driven further here — that is a P8 runtime concern, and P8 is off-limits. Step 13 (the human validation decision) **is** exercised end-to-end (pending → approved).
3. **`autonomy_mode` is not exposed on the V1 mission GET** (`autonomyModeOnRecord:"not_exposed"`). The autonomy → proposal → `createMissionV1(autonomy_mode)` wiring is **unit-proven** (`journey-p96` #5 + `execute-route.test`), not observable at the V1 record level. The mission being `awaiting_validation` for a sensitive "contract" action is itself runtime evidence of active governance.
4. **Autonomy write (step B)** is exercised via an authenticated browser fetch to the server-authoritative `/autonomy` route (the panel render is screenshotted); the write path is also unit-proven in P9.5.

---

## Gates

| Gate | Result |
|------|--------|
| tsc | **0 errors** |
| P9.6 tests | **22/22** (contract 7 + status 5 + targeted 10) |
| shell-nav test | updated to real nav (8 views); green |
| Browser journey | **P96_JOURNEY_OK** ×2 stable (real UI Confirmer click) |
| Console (non-benign) | **0** |
| Cleanup | **ZERO RESIDUE** ×N |
| Adversarial review | **SOUND** (8/8 claims hold; caveat closed) |
| P8 / Pierre‑V1 | **untouched** (no files under `src/lib/pierre/v1` or `src/app/api/pierre/v1` modified) |
| Production / migrations / deploy | **none** (flags off, nothing staged/committed) |

## Forbidden shortcuts — none used
No `u:<userId>` tenant · no `companyResolved:false`-only proof · no frontend-only mission · no execute bypass (real `/api/assistant/execute`) · no direct-DB mission insert · Pierre never called an "assistant" · no second HR brain.

**Nothing staged, committed, pushed, or deployed. No production migration applied.**
