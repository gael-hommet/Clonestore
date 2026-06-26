# PHASE 8.3-B2 — Document & Contract Core — Closure Matrix

Local-verification closure record for the P8.3-B2 document + contract core (B → B2 → B2C →
B2D → B2E → B2F → B2G). **Not legal advice.** Each cell is GREEN (built + locally proven),
BLOCKED, or NOT PROVEN. The only items deliberately outside B2 are listed at the bottom.

| # | Capability | Status | Evidence |
|---|---|---|---|
| 1 | Schema tenant-safe (RLS forced, app role bound) | GREEN | `tenant-tx`, RLS policies; `test:phase8-1` |
| 2 | FK matrix (composite + cross-tenant guard) | GREEN | v12; `p83-b2f-fk-matrix-integrity`, `p83-b2f-cross-tenant-fk` |
| 3 | Historical preflight (read-only) | GREEN | `data-integrity-preflight`; `p83-b2f-historical-preflight`; `check:p83-b2f-preflight` |
| 4 | File upload / storage (signed-upload contract) | GREEN | `files`, `file-storage`; `p83-b2f-signed-upload-contract`, `p83-b2f-upload-finalization` |
| 5 | Scan / quarantine (clean gate) | GREEN | `file-scan`; `p83-files-documents`, `p83-b2f-upload-finalization` |
| 6 | ZIP / DOCX hardening | GREEN | `zip-inspect`; `p83-zip-hardening`, `p83-b2g-contract-renderers` |
| 7 | Document type registry | GREEN | `document-types`; `p83-document-type-registry` |
| 8 | Template engine | GREEN | `templates`; `p83-template-engine` |
| 9 | Template state machine | GREEN | `template-state` + v9/v10 triggers; `p83-template-db-state-machine` |
| 10 | Template immutability (ever-published) | GREEN | v10; `p83-template-ever-published-immutability` |
| 11 | Template approval fingerprint | GREEN | `p83-template-approval-fingerprint`, `p83-template-audit-trace` |
| 12 | Field policies | GREEN | `field-policies`; `p83-field-policy-enforcement` |
| 13 | Custom field definitions | GREEN | `custom-fields` + v11; `p83-custom-field-definitions` |
| 14 | Strict generation context | GREEN | `generation-context`; `p83-generation-context-strict` |
| 15 | Document policy | GREEN | `document-policy`; `p83-document-policy-enforcement` |
| 16 | Document guard | GREEN | `document-guard`; `p83-document-guard-service-enforcement` |
| 17 | Sensitive permissions | GREEN | v10; `p83-sensitive-permission-matrix` |
| 18 | Webhook runtime role | GREEN | v13 + `signature-webhooks`; `p83-b2f-webhook-runtime-role`, `p83-b2f-webhook-idempotency` |
| 19 | Signed upload | GREEN | `p83-b2f-signed-upload-contract`, `p83-b2f-storage-tenant-isolation` |
| 20 | Contract policy | GREEN | `contract-policies`; `p83-b2g-contract-policy` |
| 21 | Contract readiness | GREEN | `contract-readiness`; `p83-b2g-contract-readiness` |
| 22 | Contract renderers (PDF/DOCX, canonical) | GREEN | `contract-render-model` + `renderers`; `p83-b2g-contract-renderers` |
| 23 | Contract generation (real artifacts) | GREEN | `contracts`; `p83-b2g-contract-generation` |
| 24 | Contract state machine (DB-enforced) | GREEN | v14; `p83-b2g-contract-state-machine` |
| 25 | Contract approvals (bound proof) | GREEN | v14; `p83-b2g-contract-approval-fingerprint` |
| 26 | Contract immutability (final/signed) | GREEN | v14; `p83-b2g-contract-immutability` |
| 27 | Contract audit / outbox (atomic, append-only) | GREEN | v14 + `contract-state`; `p83-b2g-contract-audit-outbox` |
| 28 | Amendments (governed, no chains) | GREEN | `contracts`; `p83-b2g-contract-amendment` |
| 29 | Signature preparation (governed local request) | GREEN | `contracts`; `p83-b2g-contract-generation`, `p83-b2g-b2-closure` |
| 30 | Regressions (B2E/B2F intact) | GREEN | `test:phase8-3-b2e`, `test:phase8-3-b2f`, `test:phase8-1` |
| 31 | Build | GREEN | `npm run build` exit 0 |

No important cell is NOT PROVEN.

## Explicitly OUT of B2 (not regressions, by design)

- Live e-signature provider (Yousign/DocuSign/etc.) — **B3**.
- Real external signature proof / completion — **B3**.
- Supabase production apply (migrations are local-applied to PGlite only).
- Full browser E2E (Playwright execution).
- PGlite is single-connection → concurrency proofs are logical-local, not OS-parallel.

## Storage compensation runbook

Artifacts are persisted to storage before the contract DB transaction. If the DB step fails,
`generateContract` deletes the orphaned objects and marks the file rows deleted. If a process
crashes between persist and compensation, the orphaned `initialized/clean` file rows are not
linked to any contract version and are safe to garbage-collect by object key prefix; the
historical preflight's `duplicate_object_key` / `clean_file_without_hash` checks surface
anomalies.
