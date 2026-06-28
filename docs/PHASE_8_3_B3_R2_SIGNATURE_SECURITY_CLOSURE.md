# PHASE 8.3-B3-R2 — Signature Security Closure

Closes the last critical invariants of the Pierre e-signature core: the SES/AES/QES security
matrix, real tenant-safe phone handling, tenant-bound `SECURITY DEFINER` functions, removal of
test providers from the production boundary, governed evidence proofs, and a governed, atomic,
concurrent amendment-activation pipeline with append-only history.

Migration: `supabase/migrations/2026-06-25__pierre_v18_signature_security_closure.sql`
(idempotent, non-destructive, applied in order v1→v18, PGlite-compatible).

## 1. SES / AES / QES matrix (`signature-security.ts`)

`resolveYousignSignerSecurity({ signature_level, requested_authentication_mode, phone_number,
provider_capabilities })` is a PURE, FAIL-CLOSED resolution. It throws `SignerSecurityError`
(before any HTTP call) on any unsupported combination.

| Tier | Provider level | Auth modes | Phone | Capability |
|------|----------------|-----------|-------|------------|
| **SES** (`acknowledgement`,`simple`) | `electronic_signature` | `no_otp` \| `otp_email` \| `otp_sms` | required for `otp_sms` | none |
| **AES** (`advanced_provider_managed`) | `advanced_electronic_signature` | **must** be `otp_sms` | **required** | `CLONESTORE_SIGNATURE_AES_ENABLED` |
| **QES** (`qualified_provider_managed`) | `qualified_electronic_signature` | **none** (field omitted) | — | `CLONESTORE_SIGNATURE_QES_ENABLED` |

Refused (examples): SES+`otp_sms` without a phone; AES+`no_otp`/`otp_email`; AES without a phone;
AES/QES without the capability; QES + any OTP mode. A QES request may not mix SES/AES signers
(`assertRequestSecurityConsistency`).

The standard employment-contract flow uses the **SES tier** (a legally-binding eIDAS Simple
Electronic Signature) — no phone, OTP or capability required. AES/QES are explicit, capability-
gated opt-ins; a policy requesting them without the capability **fails before any HTTP call**.

## 2. Phone (`normalizePhoneNumber` + plumbing)

The phone is read from the tenant's OWN records — `pierre_rt_employees.phone` (employee signer)
and `pierre_rt_companies.signatory_phone` (employer signer). It is **never invented** and never
another tenant's. Normalization to E.164 is performed only when safe:

- `+33…` / `+41…` → validated as-is;
- `00…` → `+…`;
- national `0X…` → `+CC…` only when a known country dialing code is supplied;
- otherwise → refused (`phone_unnormalizable`).

`info.phone_number` is included in the Yousign payload only when present/required.

## 3. Provider capabilities

`CLONESTORE_SIGNATURE_AES_ENABLED` / `CLONESTORE_SIGNATURE_QES_ENABLED` — both default **false**.
Read via `signatureCapabilities()` and passed to `YousignSignatureProvider`. AES/QES are refused
unless explicitly enabled.

## 4. Tenant binding of `SECURITY DEFINER` functions (R2.4)

`pierre_rt_claim_signature_events` no longer trusts `p_company` as authority. It derives the
tenant from `current_setting('app.current_company')`; an unset session is refused and a mismatched
`p_company` is refused. The orchestration (`processPendingSignatureEvents`,
`runDueContractActivations`, the evidence/activation governed calls) binds the session tenant via
`set_config('app.current_company', …, true)` inside the transaction.

`pierre_rt_resolve_signature_request` and `pierre_rt_ingest_signature_webhook` remain
webhook-role-only and derive the tenant from `(provider, provider_request_id)` /
`signature_requests.company_id` — never from a caller-supplied `company_id`.

## 5. Production provider boundary (R2.5)

The session-GUC test gate (`app.allow_test_provider`) is **removed**. The boundary is now a
service-only **registry** `pierre_rt_signature_provider_registry`:

- the deployable migration declares **only live providers** (`yousign`, `docuseal`,
  `dropbox_sign`, `hellosign`);
- `fake_provider` / `internal_sandbox` / `local_sandbox` are **never** in the deployable registry;
  the test harness (superuser) seeds them separately — the production migration is never weakened;
- the app and webhook-ingress roles have **no read or write grant** on the registry; only the
  `SECURITY DEFINER` ingress function (owner) reads it, so the ingress role cannot enable a
  provider.

TypeScript layer: under `NODE_ENV=production` the Fake/sandbox is **never** resolvable — no env
combination (incl. `PIERRE_RUNTIME_ENV=local`) re-enables it (`isProductionNodeEnv()` hard gate).

## 6. Governed evidence proofs (R2.7)

`pierre_rt_signature_evidence_artifacts` gains composite tenant-safe FKs to
`signature_requests` / `signature_evidence` / `files`. `INSERT/UPDATE/DELETE` is **revoked** from
the app role; proofs are written only through `pierre_rt_record_signature_evidence_artifact(...)`
(tenant-bound), which validates the request, the evidence linkage, file ownership + cleanliness,
hash, mime, size, artifact type and uniqueness (idempotent duplicate / incompatible conflict).
The table stays append-only.

## 7. Governed activation (R2.8–R2.11)

`pierre_rt_contract_activation_tasks` gains composite FKs to `employee_contracts`, worker
lease/concurrency columns and four governed functions: `schedule` (relational validation),
`claim` (`FOR UPDATE SKIP LOCKED`, tenant-bound), `complete`, `fail` (bounded retry → dead-letter,
redacted error). Effects are recorded append-only in `pierre_rt_contract_effect_history`
(allowlisted fields only). Application is **atomic**: employee update + history + task transition +
audit/CloneTrace/outbox in one transaction — any failure rolls everything back; the parent is
never touched.

## Tests

`npm run test:phase8-3-b3-r2` — 13 files covering the matrix, phone, QES consistency, worker
tenant binding, the production provider boundary (against a migrations-only DB), evidence FK +
governed write, activation FK + scheduling, worker claim/lease/dead-letter, append-only history,
atomicity failpoints, DB roles, and the closure roll-up.

## Honest limits

- PGlite is single-connection → worker concurrency is proven **logically** (claim exclusivity +
  lease semantics), not via OS-parallel connections.
- The real Yousign endpoint is not executed — the contract is proven via a strict local HTTP mock;
  the live smoke is opt-in and SKIPPED without credentials.
- Production Supabase/RLS/scale unchanged from the prior documented limits.
