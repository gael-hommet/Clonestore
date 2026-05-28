# B46 — Pierre Technology Runtime Context

## Purpose

The Pierre technology bridge translates B46 technology item states into the specific capabilities and guardrails that control Pierre's workflow behavior at runtime. It is the boundary between "what technologies are configured" and "what Pierre can actually do."

## Key outputs

### PierreTechnologyRuntimeContext

Built by `buildPierreTechnologyRuntimeContext(items)`:

```typescript
type PierreTechnologyRuntimeContext = {
  active_capabilities: string[];   // features Pierre can use now
  blocked_features: string[];      // features Pierre cannot access
  degraded_features: string[];     // features in limited mode
  guardrails: {
    cloneguard_active: boolean;
    clonetrace_active: boolean;
    safe_to_run: boolean;          // true when cloneos + cloneguard + clonetrace active
    requires_human_validation: boolean;
  };
  memory: {
    cloneadn_active: boolean;
    empreinte_loaded: boolean;
  };
  ai_mode: string;
  email_mode: string;
  document_generation_available: boolean;
  voice_available: boolean;
  chat_available: boolean;
};
```

### PierreWorkflowGuardrails

Built by `applyTechnologyConfigToPierreWorkflow(items)`:

```typescript
type PierreWorkflowGuardrails = {
  block_all_missions: boolean;           // CloneOS inactive
  block_sensitive_actions: boolean;      // CloneGuard inactive
  block_document_generation: boolean;    // CloneOS inactive or CloneGuard degraded
  require_human_validation_always: boolean; // CloneGuard inactive
  degraded_audit_trail: boolean;         // CloneTrace inactive or degraded
  blocked_reasons: string[];
};
```

## What blocks Pierre

| Blocked condition | Trigger |
|-------------------|---------|
| All missions blocked | CloneOS score < 60 or disabled |
| Sensitive actions blocked | CloneGuard score < 60 or disabled |
| Document generation blocked | CloneOS inactive or CloneGuard degraded |
| Human validation required | CloneGuard inactive |
| Degraded audit trail | CloneTrace inactive or degraded |

## Technology → Pierre role map

| Technology | Pierre role | Pierre can run without? |
|-----------|-------------|------------------------|
| CloneOS | Core orchestration | **No** — Pierre cannot create/execute missions |
| CloneADN | Memory/context | Yes — degraded (generic responses) |
| CloneGuard | Security gateway | **No** — all sensitive actions blocked |
| CloneTrace | Audit trail | **No** — no execution proof |
| CloneVoice | Voice command | Yes — text-only mode |
| CloneChat | Chat interface | Yes — cockpit-only interactions |

## Readiness scoring (Pierre perspective)

`computePierreTechnologyReadiness(items, context)` computes:

- Base: 70 pts if all 3 critical (CloneOS + CloneGuard + CloneTrace) are active, else 20
- +15 if CloneADN active
- +10 if premium documents ready (doc gen + B45 closed)
- +5 if voice ready
- +5 if chat ready
- -5 per degraded capability (floor: 0)

Pierre is `ready` when `score >= 60` and no missing critical technologies.

## Usage in workflow

```typescript
const items = buildAllB46TechnologyItems(context);

// Check if Pierre can run
const ctx = buildPierreTechnologyRuntimeContext(items);
if (!ctx.guardrails.safe_to_run) {
  // Block mission execution
}

// Apply to workflow decision
const guardrails = applyTechnologyConfigToPierreWorkflow(items);
if (guardrails.block_all_missions) {
  // Return error: CloneOS required
}

// Full readiness assessment
const readiness = computePierreTechnologyReadiness(items, context);
const verdict = buildB46PierreTechnologyVerdict(items, context);
```
