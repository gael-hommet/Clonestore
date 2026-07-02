# P8 — External Blockers Register

Single source of truth for **external** (non-CloneStore-code) blockers gating the final Pierre Production unblock. Machine-mirrored in `P8_8_GATES_STATUS.json → externalBlockers`. An entry in state `OPEN` forces the P8.8 unblock decision to `BLOCKED` (see `scripts/p88-readiness-decision.mjs`).

---

## P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP

| Field | Value |
|---|---|
| **ID** | `P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP` |
| **State** | `OPEN — EXTERNAL` |
| **Opened** | P8.7.4 controlled live journey (runs r4d67e95412cc, rea8d01527158, r55b38bf21b09) |
| **Impact** | Full two-signer CDI signature activation (requirements **16–18**) cannot be reliably proven in the current Yousign **Sandbox** account. Blocks P8.7.4 24/24. |
| **CloneStore code** | **READY** — external_id conformed, real recipients resolved, adapter payload byte-identical to a passing isolated test, partial-failure draft auto-recovered + deleted, delivery drain to zero, retry→dead-letter terminal. |
| **Provider** | **BLOCKED** |
| **Resolution owner** | Yousign account owner / Yousign support (external) |
| **Blocks P8.8 engineering** | **NO** |
| **Blocks final Production unblock** | **YES** |

### Proven root cause (not code)
- Yousign Sandbox organization has exactly **1 member** (the account owner).
- `POST /users` (create/invite member) → **403 "This operation is not available in Sandbox."** (roles `member` and `admin`).
- The CDI policy requires **2 distinct signers**; single-signer is forbidden.
- The 2nd signer (owner `+p87sig` alias) is a **non-member**; Sandbox accepts non-member recipients only within an internal **quota**, then `addRecipient` → `400 "In sandbox mode, the recipient email must belong to your organization."`
- Evidence: real-pipeline capture shows the pipeline `addRecipient` payload (employer hash `1104e7736a95`, employee hash `131010de3ef6`, level `simple`, auth `no_otp`, phone present) is **byte-identical** to the isolated micro-test that Yousign accepts. Full journeys fail 3/3; isolated/micro-preflight calls pass — a provider-side stateful/quota condition, not a payload defect.

### Close condition
A **2nd distinct controlled email is a verified member** of the Yousign Sandbox organization (added via the Yousign dashboard — API is 403 in Sandbox), **OR** Yousign support **lifts** the "recipient must belong to organization" restriction. Then re-run P8.7.4: real-pipeline micro-preflight GREEN → single final journey → **24/24** → set this entry `CLOSED`.

### Explicitly NOT permitted to close this
Faking the activation webhook; single-signer workaround; direct SQL to fabricate a signature state; disabling `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE`; declaring "Yousign live verified".
