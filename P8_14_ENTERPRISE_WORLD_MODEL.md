# P8.14 — Enterprise World Model

Pierre's understanding of a company is a **governed retrieval layer**, not one giant prompt. Every object
handed to the model is tenant-scoped, permission-filtered, relevant, bounded, fresh, and traceable.

## Reused (real, permission-filtered) substrate

- `resolveTenantContext` (server-side RBAC, site-scope, custom roles) — the browser never supplies tenant/role.
- `buildStrictGenerationContext` (fail-closed whitelist retrieval; cross-tenant refuse; sensitivity from definition).
- `getEmployee360`, `buildCockpitSnapshot`, `custom-fields`, `field-policies` — real read model.

## Added by P8.14

- [`capability-retrieval.ts`](src/lib/pierre/v1/cognitive-runtime/capability-retrieval.ts) — bounded,
  relevance-ranked retrieval over the **real 215-capability canon** (`HR_CAPABILITIES`), with a FR↔EN
  synonym bridge so French requests match the English canon. Cap: `COGNITIVE_LIMITS.maxCandidateCapabilities`
  (default 16) — never the whole canon to the model.
- [`entity-resolution.ts`](src/lib/pierre/v1/cognitive-runtime/entity-resolution.ts) — resolves employees/
  managers/etc **only within caller-provided, tenant-scoped candidates**; a foreign id is `not_found`, never
  resolved (proof: `tenant-isolation.json`, `cross_tenant_leaks: 0`).

## Bounded-context guarantees

- No whole-company dump to OpenAI; retrieval is capped and relevance-ranked.
- Entity resolution is pure over tenant-scoped candidates → structurally cannot leak across tenants.
- Company-specific intelligence (policies, templates, approval circuits, preferences) is retrieved from the
  existing config/read layer; **a company preference never overrides security, tenancy, human-only
  boundaries, verified legal constraints, or required approvals** (enforced by `decideValidation` + guard).

**Honest scope:** the retrieval layer is wired and bounded; deeper company-preference modelling (approval
circuits, historical decisions) reuses existing config surfaces and is extended incrementally.
