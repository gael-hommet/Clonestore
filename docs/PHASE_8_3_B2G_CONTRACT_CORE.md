# PHASE 8.3-B2G — Pierre Contract Core

Operational documentation of the Pierre contract engine. **Not legal advice** — it encodes
operational governance, not statutory rules.

## Architecture

The contract engine reuses, never re-implements, the B2–B2F bricks:

| Concern | Module |
|---|---|
| Contract policy registry | `contract-policies.ts` |
| Readiness (pure, fail-closed) | `contract-readiness.ts` |
| Canonical render model + PDF/DOCX | `contract-render-model.ts` + `renderers.ts` |
| State machine + atomic events | `contract-state.ts` |
| Engine (generate / workflow / approvals / amendments) | `contracts.ts` |
| Strict generation context | `generation-context.ts` (B2E) |
| Field / custom-field / document policy / guard | `field-policies.ts`, `custom-fields.ts`, `document-policy.ts`, `document-guard.ts` (B2E) |
| File upload / scan / storage | `files.ts`, `file-storage.ts`, `file-scan.ts` (B2–B2F) |
| DB guards | migration `2026-06-21__pierre_v14_contract_workflow_guards.sql` |
| API + routes | `api.ts` (`api*Contract*`) + `app/api/pierre/v1/contracts/**` |

## Policies (B2G.1)

`CONTRACT_POLICIES` covers every `contract_type` in the schema CHECK. Each entry pins the
document type, required + conditional fields, allowed renderers, approvals, create/approve
roles, sensitivity, signature level, visibility, fixed-term/date rules, amendment rules,
required provenance, and `auto_execution_allowed: false`. An unknown type, an incompatible
template, or a renderer outside both the contract and document-type policy is refused. A
weaker policy supplied by a caller is never honoured — the policy comes from the registry.

## Readiness (B2G.2)

`evaluateContractReadiness` is pure and deterministic. The service resolves tenant-verified
evidence (employee, template, strict context, artifact, approvals, hashes) and passes it in.
Output: `ready`, `stage`, `blockers`, `warnings`, `missing_fields`, `invalid_fields`,
`sensitive_fields`, `provenance_failures`, approvals counts, `template_fingerprint_ok`,
`document_hash_ok`, `artifact_clean`, `signature_ready`. Field-level checks run at the
**generate** stage; finalization/signature stages verify the artifact, approvals and drift.
A warning never blocks; a blocker always does; undefined evidence is never success.

## Render model + hashes (B2G.3)

`buildContractRenderModel` builds ONE canonical model; `renderContractPdf` / `renderContractDocx`
render it to both formats. The PDF is a real multi-page PDF-1.4 (wrapping, tables, signature
zones, page breaks, footer + numbering, BROUILLON watermark on drafts); the DOCX is a real
OOXML zip with a `<w:tbl>` table, XML-escaped, no macro, no external link. **Three distinct
hashes**: `canonical_hash` (business content, format-independent, stable across draft/final),
`pdf_hash` (PDF bytes), `docx_hash` (DOCX bytes).

## Generation (B2G.4) + storage compensation

`generateContract`: load+validate → resolve policy/template/strict-context → readiness →
render → persist artifacts as CLEAN files (storage upload + scan) → **atomic DB tx** (document
+ document version + contract-version link + events). Storage is not transactional with
Postgres, so artifacts are persisted before the DB tx and a failure in the tx triggers
**compensation**: the orphaned objects are deleted and the file rows marked deleted, so a
failed generation never leaves a usable artifact behind.

## State machine (B2G.5)

`workflow_status`: `draft → under_review → {changes_requested → draft | approved → {final →
ready_for_signature → submitted → in_progress → signed}}` with `declined/expired/cancelled/
failed/superseded/archived` branches. Enforced in `contract-state.ts` (pure) AND by the v14
DB trigger (`pierre_rt_contract_workflow_guard`) for direct SQL and the app role. Each
transition emits an append-only audit (SECURITY DEFINER, tenant-bound) + real CloneTrace
(`document_access_log`) + deterministic outbox — all in the transition's transaction.

## Approvals + fingerprints (B2G.6)

An approval is an append-only row in `pierre_rt_contract_approvals` bound to the template
fingerprint + canonical content hash. Finalization recomputes valid approvals and checks
template/document drift; on drift it refuses and emits `contract.approval_invalidated`. A new
version does not carry a prior version's approval.

## Immutability (B2G.7)

A `final`/`signed` contract version's content (template/document version, hashes, fingerprint,
dates, version) is frozen by the v14 `pierre_rt_contract_version_guard` trigger; a `signed`
contract's identity (employee, type, document, parent) is frozen by `pierre_rt_contract_workflow_guard`.
Post-signature corrections go through an amendment.

## Amendments (B2G.8)

`createContractAmendment` creates a NEW governed contract linked by `parent_contract_id`, same
tenant + same employee, with its own version/document/approvals/signature path. Refused:
cross-tenant parent (invisible), amendment chains, cancelled parent, post-signature when the
type forbids it, duplicate idempotency key. The original is never mutated; active employee data
is not changed until a future signature/activation (B3).

## Signature preparation (B2G.9)

`prepareContractSignature` requires `signature_ready` (artifact clean, approvals valid, no
drift) and creates a governed LOCAL `pierre_rt_signature_requests` row (`provider=local_sandbox`,
status `ready`, approval `approved`, approved content hash, idempotency key). **No live
provider** is contacted; the live signature path is B3.

## External limits (honest)

Live e-signature provider, real external signature proof, Supabase production apply, full
browser E2E, and B3+ are **out of scope** and not claimed here. PGlite is single-connection, so
concurrency proofs are logical-local.
