# P9.5 — Pierre Autonomy UX & CloneStore Product Integration

Exposes **Pierre as a configurable autonomous AI HR employee** inside the product — from draft to
governed autonomy — over the **existing, verified P8 runtime**. No second HR brain: every autonomy
decision reuses P8's `decideValidation`. Proofs in `.p95-proofs/p95-run1/`.

## Product doctrine
Pierre is presented as **your AI HR employee / your operational HR team** — faster, more intelligent and
much cheaper than a full senior HR team — **configurable by autonomy level** and **governed** by permissions,
policies, audit, legal boundaries and human-only decisions. Copy never says "assistant RH" or "copilote".

## The 5 product modes → real P8 engine modes
| Product mode | P8 `AutonomyMode` | Meaning |
|---|---|---|
| **Brouillon** (draft) | `draft` | Pierre prépare, vous décidez. |
| **Validation** | `normal` | Pierre propose l'important, vous validez ; l'opérationnel à faible risque est fait seul. |
| **Exécution contrôlée** (controlled) | `high_autonomy` | Pierre exécute le travail autorisé, demande pour le risqué. |
| **Autonomie gouvernée** (governed) | `enterprise_autonomous` | Pierre opère la RH en continu, dans vos règles. |
| **Dirigeant + Pierre** (dirigeant) | `enterprise_autonomous` (supervision = dirigeant) | Le dirigeant supervise Pierre directement. |

The 5 product modes cover **all 4 real P8 engine modes**. `governed` + `dirigeant` share the engine mode
`enterprise_autonomous`; the difference is the **supervision framing** (HR team vs. dirigeant), not the engine
behavior — this is honest (the P8 engine has 4 modes; the dirigeant framing is organizational).

## Real, not cosmetic — behavior derived from P8
`src/lib/clonestore/pierre-autonomy/model.ts` imports P8's `decideValidation` (read-only) and, for each mode,
**derives** the matrix "what Pierre does alone / prepares / proposes for validation / human-only / blocked" by
calling `decideValidation` on 14 representative P8 `ActionKind`s. Nothing is hardcoded.
- **Modes change behavior**: e.g. a status update is `prepare` in draft, `alone` in validation/controlled, `notify`
  in governed; effective autonomy grows monotonically draft < validation ≤ controlled ≤ governed.
- **Hard floors hold in EVERY mode** (governed/dirigeant included): approval-required/restricted actions
  (contract, amendment, compensation, sanction, **termination**, dismissal, **sensitive_medical**, harassment) are
  **never auto-executed** — always validation or human-only. Proof: `model.test.ts` (8/8).

Capability-level gates (`HUMAN_ONLY`, `LEGAL_CONTENT_REQUIRED`, `EXTERNAL_DEPENDENCY`) and `evaluateCapabilityGate`
remain P8's authority; the product layer never overrides them.

## Company setting — persisted in the existing P8 column
The autonomy level is stored in **`pierre_rt_companies.default_autonomy_mode`** (the existing P8 column — single
source of truth, **no new table, no migration**). Read/written via the existing V1 `GET`/`PATCH /company`.

## Server-authoritative — no client-forged escalation
`POST /api/assistant/autonomy` (`requireCompanyUser`, flag-free so it works in the cockpit):
- The client sends **only** `{ productModeId }`. The **server** maps product → P8 engine mode and PATCHes the P8
  column with only `{ default_autonomy_mode, version }`.
- A forged `engineMode`/`default_autonomy_mode`/`version` in the request body is **ignored** (server uses
  `productModeId` + its own read version). Proof: `autonomy-route.test.ts` (6/6).
- **P8 enforces the write permission** — `PATCH /company` is governed; a 403 → `FORBIDDEN` (no escalation).

## CloneChat passes autonomy_mode into P8 mission creation (the closed gap)
Previously every CloneChat-created mission ran on P8's `"normal"` default. Now, at proposal time the server
**resolves the company's `default_autonomy_mode`** and freezes it in the persisted proposal; the execute route
passes it as `autonomy_mode` to V1 `createMission`, which governs the mission via `decideValidation`.
- A forged `autonomyMode` in the `/execute` body is **ignored** (server reads the persisted proposal); an invalid
  mode is omitted (guard). Proof: `execute-route.test.ts` P9.5 additions (3) + 11 prior.
- The CloneChat proposal UI reflects the resolved mode ("Pierre opérera cette mission en mode « … »").

## Cockpit UI
`src/components/pierre/autonomy/PierreAutonomyPanel.tsx` in the P9.3 cockpit (new **Autonomie** view). Shows the
5 modes (accessible radiogroup), the current mode, and the **derived matrix** (Pierre le fait seul / prépare /
propose→humain valide / réservé à une décision humaine). Autonomy settings render independently of the operational
data load. **Browser-proven** (isolated build, real Supabase session) on desktop 1280 + mobile 390: the Autonomie
tab, the 5 modes (accessible radiogroup), the derived matrix with the **hard floor visible** (termination →
réservé humain), correct AI-HR-employee framing, 0 unnamed controls, 0 console errors, no overflow — `ui-proof.json`.

**Honest scope of the browser proof (disclosed):** the ephemeral browser user has no resolved company
(`companyResolved:false`), so the panel rendered the 5 modes **disabled** with a "rattachez-vous à une entreprise"
notice — the browser proof exercised the **render + read** (route returns the 5 modes + the decideValidation-derived
matrix), not the in-browser **select/write/persist**. The write path (product→engine mapping, PATCH of the P8 column,
no-forged-escalation, permission-403, persistence) is proven at the **server route level** (`autonomy-route.test.ts` 7/7).
The "Dirigeant + Pierre" choice is echoed immediately after saving; because the P8 column stores only the engine mode,
on reload `enterprise_autonomous` is re-presented canonically as "Autonomie gouvernée" (the two share the engine mode).

## Validation
- `model.test.ts` 8/8 · `autonomy-route.test.ts` 6/6 · `execute-route.test.ts` 14/14 · targeted **25/25**.
- Wider CloneChat/assistant/autonomy suite **164/164** · P9.4.2 durable itest **24/24** · tsc **0** · isolated build **0** (all artifacts).
- Browser proof **P95_AUTONOMY_UI_OK** (desktop + mobile), zero residue.

## Perimeter
- **P8 lane untouched** — no `src/lib/pierre/v1/**` or `src/app/api/pierre/v1/**` write; P8 consumed read-only
  (import `decideValidation`/`AUTONOMY_MODES`; loopback GET/PATCH `/company` + `POST /missions` with `autonomy_mode`).
- **No second HR brain** — all HR decisioning stays in P8.
- Production flags **unchanged**; **no migration** (reuses the P8 column); nothing staged/committed/pushed/deployed.
- Browser proof isolated to `.next-p942`; the P8 `:3000` server + shared `.next` were never touched.

## Adversarial review (independent)
Claims **1–7 HOLD**: autonomy modes are real (matrix derived from `decideValidation`, not hardcoded); **no second HR
brain** (no reimplemented policy — classification stays in P8); **no client-forged escalation** (route reads only
`productModeId`; execute reads `autonomyMode` from the persisted proposal; forged body values ignored — tested);
**hard floors preserved** in every mode (approval-required/restricted never auto-executed); **permission enforced by
P8** (`PATCH /company`); **copy** frames Pierre as AI HR employee, not assistant/copilote; **P8 untouched** (read-only
import + loopback to the existing V1 API).

Two confirmed issues — both addressed:
- **(a) "Dirigeant + Pierre" collapsed to "Autonomie gouvernée" on apply** (they share the `enterprise_autonomous`
  engine mode). **Fixed**: the route now echoes the requested product mode after saving; the reload-time re-presentation
  as "governed" is inherent (the P8 column stores only the engine mode) and is now **disclosed**. Test added (`autonomy-route.test.ts`).
- **(b) Browser proof `companyResolved:false` was not disclosed.** **Fixed** in the UI section above: the browser proof
  covers render+read; the select/write/persist path is server-unit-proven (`autonomy-route.test.ts` 7/7).

## Verdict

**P9.5 — PIERRE AUTONOMY UX & PRODUCT INTEGRATION VERIFIED.**

- P8 **CLOSED / UNTOUCHED** (read-only consumption of `decideValidation` + the V1 `/company` & `/missions` API)
- P9.4.2 non-regression **GREEN** (durable itest 24/24; wider suite 164/164; tsc 0)
- **5 autonomy modes REAL** (matrix derived from `decideValidation`; hard floors proven) — `model.test.ts` 8/8
- autonomy mapped to the **4 real P8 engine modes**
- company setting **persisted** in the existing P8 `default_autonomy_mode` column (no new table/migration)
- CloneChat **passes `autonomy_mode`** to P8 mission creation — `execute-route.test.ts` 14/14
- **no client-forged autonomy escalation** (route + execute) — server-authoritative, tested
- **human-only / restricted / legal / provider gates preserved** (P8 hard floors, never bypassed)
- **UI browser proof GREEN** desktop 1280 + mobile 390 (render + derived matrix + hard floor + framing); write path server-unit-proven (disclosed)
- **product copy correct** (AI HR employee / operational HR team; never assistant/copilote)
- **no production enablement**, no migration, **nothing staged/committed/pushed/deployed**, **ZERO RESIDUE**

Isolated to `.next-p942`; the P8 `:3000` server + shared `.next` were never touched.
