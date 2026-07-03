# P8.14 — Security

The model never receives unrestricted tools; every effect is allowlisted, schema-validated,
tenant-resolved server-side, permission-checked, risk-classified, and confirmation-gated where required.

## Defenses (with proofs)

| Threat | Defense | Evidence |
|---|---|---|
| Prompt / tool / capability-id injection | model may only reference the closed 13-action registry; unknown `action_key`s dropped before compile | `prompt-injection.json` drops `database.dropAllTables`, `http.exfiltrate`; plan `ok=false` |
| Arbitrary SQL / URL / shell / provider call | not representable — no free instruction reaches an executor; inputs are typed + schema-validated by the compiler | `plan-generator.ts`, `runtime-action-registry` |
| Cross-tenant entity ids / existence leak | `entity-resolution` is pure over caller-provided tenant-scoped candidates; a foreign id is `not_found` | `tenant-isolation.json` `cross_tenant_leaks: 0` |
| LLM downgrades a sensitive verdict | `raiseFloor` + `applySafetyFloor` — the deterministic detector is a floor the model can only raise | `cognitive-modules.test.ts` safety-floor test; `human-only-boundaries.json` |
| Human-only bypass | `decideValidation` hard-floors approval-required + restricted actions in every mode | `human_only_bypasses: 0` |
| Secret / prompt / chain-of-thought extraction | `operational-memory.assertNoHiddenReasoning`; client-safe P9 contract (no prompts/CoT/secrets) | `intelligence-service.test.ts` (`no /api_key|system_prompt|chain_of_thought/`) |
| Tenant / actor / permission spoofing | resolved server-side via `withProductAccess` + `resolveTenantContext`; browser never authoritative | `intelligence-api.ts`, `_runtime.ts` |
| Oversized context / cost abuse | bounded retrieval (`COGNITIVE_LIMITS`); atomic budget gate before every model call | `cost-accounting.json`; `usage-accounting.ts` |
| Malicious document as instructions | documents treated as data (existing MIME/zip/quarantine); never privileged system instructions | reused file-security substrate |

## Key handling

The OpenAI key stays **server-side** (`OPENAI_API_KEY`), never `NEXT_PUBLIC_*`, never logged, printed,
committed, or placed in a proof (`real-openai-smoke.json` records `key_exposed: false`). The AI SDK is not
in the client bundle.

## Invariants never regressed

Closed action registry (no eval) · fail-closed guard/policy the LLM cannot downgrade · fencing/lease on
every effect · `company_id=$1` isolation · no fabricated provider success · server-side tenant/permission.
