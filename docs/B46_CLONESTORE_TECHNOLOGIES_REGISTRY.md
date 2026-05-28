# B46 — CloneStore Technologies Registry

## Architecture

The B46 registry is a **pure, stateless** façade that builds `B46TechnologyItem` objects from:
1. Static display definitions (name, icon, accent color, description)
2. Static guardrails (locked flag, allowed runtime modes, customer-configurable flag)
3. Static capability lists (what each technology enables in Pierre)
4. Dynamic readiness computation (from `B46ReadinessContext`)
5. Dynamic runtime mode (from environment variables)

No Supabase. No async. No side effects. No throws.

## Key types

```typescript
type CloneStoreTechnologyId = "cloneos" | "cloneadn" | "cloneguard" | "clonetrace" | "clonevoice" | "clonechat";

type B46TechnologyItem = {
  id: CloneStoreTechnologyId;
  status: B46TechnologyStatus;
  enabled: boolean;
  locked: boolean;
  launch_critical: boolean;
  runtime_mode: B46TechnologyRuntimeMode;
  readiness: B46TechnologyReadiness;
  display: B46TechnologyDisplay;
  guardrails: B46TechnologyGuardrails;
  capabilities: B46TechnologyCapabilityId[];
  dependencies: B46TechnologyDependency[];
};
```

## Building items

```typescript
// Build a single item
const item = buildB46TechnologyItem("cloneos", context);

// Build all 6 items
const items = buildAllB46TechnologyItems(context);

// With status overrides (e.g., for reset)
const items = buildAllB46TechnologyItems(context, {
  cloneguard: "active",
  clonetrace: "active",
});

// Build a full snapshot (includes global readiness + Pierre status)
const snapshot = buildTechnologiesSnapshot({ userId, context });
```

## Readiness context

```typescript
type B46ReadinessContext = {
  b38_closed: boolean;
  b39_closed: boolean;
  b40_closed: boolean;
  b41_closed: boolean;
  b42_closed: boolean;
  b43_closed: boolean;
  b44_closed: boolean;
  b45_closed: boolean;
  empreinte_ready: boolean;
  document_style_ready: boolean;
  security_ready: boolean;
  observability_ready: boolean;
  email_runtime_mode: string;
  ai_runtime_mode: string;
};
```

Use `getDefaultB46ReadinessContext(overrides?)` to build with all blocs defaulting to `true`.

## Test fixtures

```typescript
import {
  buildDefaultB46ReadinessContext,  // all blocs closed=true
  buildMinimalB46ReadinessContext,  // most blocs closed=false
  buildFullB46TechnologyItems,      // all 6 items with default context
  buildTechnologyItemWithStatus,    // single item with forced status
  buildDegradedTechnologyItems,     // all items degraded (locked stay active)
} from "@/lib/clonestore/technologies/technology-b46-fixtures";
```

## Guardrails per technology

| Technology | locked | allowed_runtime_modes | customer_configurable |
|-----------|--------|----------------------|----------------------|
| CloneOS | false | mock, dry_run, sandbox, production | false |
| CloneADN | false | mock, sandbox, production | **true** |
| CloneGuard | **true** | **[production]** | false |
| CloneTrace | **true** | production | false |
| CloneVoice | false | disabled, mock, sandbox, production | **true** |
| CloneChat | false | dry_run, mock, sandbox, production | **true** |
