# P9.4.2 — CloneChat Final Durability & Multi-User Closure (round 2)

Reopened from the claimed-VERIFIED checkpoint with 7 hardening deficits. This report records
what was built and PROVEN. Proofs live in `.p942-proofs/p942-final/`. (Round-1 closure history
is preserved in git; this supersedes it.)

## Scope & perimeter
- Changed only: `src/lib/clonechat/**`, `src/app/api/assistant/**`, `src/app/assistant/useCloneChat.ts`,
  `supabase/migrations-p941/…`, `package.json` (sharp), `next.config.ts` (sharp external), `scripts/`, proofs.
- **P8 lane untouched**: no file under `src/lib/pierre/v1/**` or `src/app/api/pierre/v1/**` modified.
  CloneChat consumes P8 **read-only** (membership resolution) and executes V1 effects only through V1's
  own public API via server→server loopback.
- Production flags **unchanged**: `CLONECHAT_ENABLED` default OFF; `CLONECHAT_ALLOW_USER_TENANT_FALLBACK`
  unset; `CLONECHAT_IMAGE_DEGRADED_OK` unset. Migration **not** applied to Supabase. Nothing staged/committed/deployed.

## Deficits closed

### §1 — Company tenancy FAIL-CLOSED (D1)
`server/company.ts` resolves the real company from V1 membership (read-only). No membership → `MEMBERSHIP_REQUIRED`;
suspended/removed → `MEMBERSHIP_SUSPENDED`/refused; several without preference → `COMPANY_SELECTION_REQUIRED`;
V1 DB outage → `COMPANY_UNAVAILABLE` (503). The `u:<userId>` fallback exists **only** behind
`CLONECHAT_ALLOW_USER_TENANT_FALLBACK=1` and **never** on a DB error. Chat + execute routes refuse
**before** any side effect. Proof: `company-resolution.test.ts` (15/15).

### §2 — SHA-256 canonical command identity (D2)
`durable/command-ledger.ts`: identity = `SHA-256(company, actor, conversation, proposalId, kind, SHA-256(canonical payload))`.
No day-bucket, no FNV. Durable lifecycle `confirmed → executing → succeeded | failed_recoverable | failed_terminal | cancelled`.
Proposals persisted server-side (`durable/proposal-store.ts`); the client submits only a proposal reference.

### §3 — Server-authoritative execution (D3)
`/api/assistant/execute`: confirm `proposalId` → auth + real company → load proposal (scoped company+actor) →
canonical command + SHA-256 → **atomic claim** (lease) → **governed effect** (V1 loopback for mission/cancel/validation;
durable support store for support-case) → **re-read real target** → **commit result reference**. Duplicate returns
the existing result; concurrent confirm yields one execution; foreign/nonexistent proposal → 404 (no leak).
V1 mission creation is idempotent on `idempotency_key = fingerprint` → crash-recovery is exactly-once.
Proof: `execute-route.test.ts` (8/8) + durable ledger itest (concurrency/lease-recovery/duplicate/foreign/terminal).

The round-1 client-driven idempotency path (`tool-executor.executeGovernedAction`, `durable/idempotency-store.ts`,
`stores.idempotency`) is **superseded** by the command ledger and is **no longer on any production path** (retained
as a self-contained tested module only).

### §4/§9 — Guaranteed image transformation (D4)
`sharp@0.34.4` is a **direct pinned** dependency + `serverExternalPackages`. Production path is **mandatory**:
decode → orientation-normalize → resize ≤1024 → recompress → strip metadata → validate output. If sharp is
unavailable or transform fails → the image is **rejected** (original never sent; no silent metadata-only downgrade).
Chunk-strip fallback only under `CLONECHAT_IMAGE_DEGRADED_OK=1` (local/test). Proof: `image-sanitizer.test.ts` (13/13),
production smoke `image-prod-smoke.json` (`IMAGE_PROD_TRANSFORM_OK`), built-server boot.

### §5 — Atomic continuity (D5)
`clonechat-durable.itest.ts`: 60 concurrent appends across **two independent pools** → exact seq 1..60,
0 duplicate, 0 missing, persisted==accepted, tenant B cannot append to A, order identical after DB restart.

### §6 — Multi-user same-company tenancy (D6)
Two real members A1/A2 of company A + company B. Private per-user conversations; **shared** company budget
(150 = 100+50) with **distinct** per-user counters; company-scoped support with B isolation; actor-scoped commands.
Resolution: two users → same company id; removed membership refused; site scope surfaced.

### §7 — Browser / mobile / accessibility QA (D7)
**UI-quality matrix VERIFIED on the production server** across 1440/1280/390/360: no horizontal overflow,
0 unnamed interactive controls, keyboard focus, reduced-motion, long-content, **0 console errors**, screenshot per viewport.
**Disclosed gap**: the authenticated action-flow browser states were not re-driven in-browser this round (the
ephemeral-Supabase login failed with a network-egress `Failed to fetch` from the headless browser; Supabase URL is
baked into the bundle, so it is an environment limit, not a code/build defect). Those states' behaviour is proven at
the route (8) + itest (21) + unit (15) level and the UI wiring is typechecked. Ephemeral user **DELETED — ZERO RESIDUE**.

## Validation
- `tsc --noEmit`: **0 errors**.
- CloneChat + assistant unit: **147/147**.
- Durable integration itest: **21/21** (0 unhandled errors).
- Full unit suite: **16091 passed, 5 failed** — all pre-existing **P8-lane** (`premium-document-system` keyword
  inference ×4, `fair-claim` harness ×1) in files never touched.
- `next build`: **exit 0** (sharp externalized; `/assistant` client 13.1 kB, SDK out of client bundle).
- Built server: `next start` ready 2.5 s, `/assistant` 200, `/api/assistant/execute` fail-closed 503 (flag off).

## Adversarial review
<!-- filled after independent review reconciliation -->

## Verdict
<!-- filled after adversarial review reconciliation -->
