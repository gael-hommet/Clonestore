# B35 — Pierre Memory & Context Layer

**Status:** Complete  
**Date:** 2026-05-24  
**Tests:** 66 passed (pierre-context-b35: 47 + cloneadn-context-b35: 19)  
**tsc:** clean  
**build:** clean

---

## What is B35?

B35 gives Pierre a **context pack** before every action. Before responding, generating, sending, classifying, or deciding, Pierre answers: *"Qu'est-ce que je sais déjà de cette entreprise, ce salarié, cette mission, ce document, ce canal, cette règle, cette validation, cet historique et cette préférence?"*

B35 aggregates signals from all layers — company memory, CloneADN, Employee 360, missions, tasks, B34 files, B33 channels, audit logs, and validation rules — into a ranked, deterministic **PierreContextPack**.

**No AI required.** No async. No DB. Fully deterministic heuristics.

---

## Architecture

```
src/lib/pierre/context/                ← B35 context layer
  types.ts                             — All shared types
  scoring.ts                           — Freshness, relevance, priority scoring
  context-signals.ts                   — Base signal builder (buildContextSignal)
  company-context.ts                   — Company + CloneADN signals
  employee-context.ts                  — Employee 360 signals
  mission-context.ts                   — Mission status signals
  task-context.ts                      — Task overview + approval gates
  file-context.ts                      — File risk signals (B34 compatible)
  channel-context.ts                   — Channel identity signals (B33 compatible)
  history-context.ts                   — Audit log + mission history signals
  rules-context.ts                     — CloneADN rules + constraints
  validation-context.ts                — Cross-scope validation gates
  risk-context.ts                      — Aggregated risk overlay
  context-pack.ts                      — assemblePierreContextPack()
  context-runtime.ts                   — buildPierreContextPack() orchestrator
  context-summary.ts                   — summarizeContextPack() deterministic

src/lib/pierre/__tests__/
  pierre-context-b35.test.ts           — 27 tests
  cloneadn-context-b35.test.ts         — 8 tests

docs/sql/B35_CONTEXT_MEMORY.sql        — Proposed DB schema (reference only)
```

---

## Core usage

```typescript
import { buildPierreContextPack } from "@/lib/pierre/context/context-runtime";

const result = buildPierreContextPack({
  company_id: "co_acme",
  built_for: "pierre_brain",
  // Optional context
  employee_id: "emp_001",
  employee_profile: { id: "emp_001", full_name: "Alice Dupont", ... },
  mission_id: "miss_123",
  mission: { id: "miss_123", status: "in_progress", mission_summary: "..." },
  tasks: [...],
  files: [...],
  channel_identity: { id: "ch_1", kind: "email", verification_status: "verified", ... },
  clone_adn_profile: adnRawJson,
  company_memory: memoryJson,
  recent_logs: [...],
  current_task_type: "email.send",
  current_domain: "hr",
});

// result.pack              → PierreContextPack (all signals, summaries, gates)
// result.should_require_validation → boolean
// result.recommended_next_action   → string | null
// result.signal_count      → number
// result.missing_info      → string[]
// result.warnings          → string[]
// result.build_duration_ms → number
```

---

## Signal types (12)

| Type | Meaning |
|---|---|
| `identity` | Who/what this is (company name, employee, channel address) |
| `status` | Current state (mission open, task done, channel active) |
| `risk_flag` | Risk detected (offboarding, blocked task, sensitive file) |
| `preference` | Behavioral preference (tone, language, approval policy) |
| `rule` | CloneADN rule applies in this context |
| `validation_gate` | Human approval required before proceeding |
| `history_event` | Recent activity (logs, missions) |
| `missing_info` | Required data absent |
| `recommendation` | Next action suggested |
| `constraint` | Hard limit (unverified channel, never_auto_execute) |
| `capability` | What Pierre can do (email contact available) |
| `relationship` | Link between entities |

---

## Scopes (12)

`company` · `employee` · `mission` · `task` · `file` · `channel` · `history` · `rules` · `validation` · `risk` · `preference` · `adn`

---

## Scoring

Every signal has:
- **`relevance_score`** (0–1): scope base + risk boost + domain/task-type match + confidence modifier
- **`freshness_score`** (0–1): exponential decay per scope (task: 24h half-life, rules: 30d half-life)
- **composite sort key**: `priority × 0.5 + relevance × 0.35 + freshness × 0.15`

```
Signal sort key = priority_weight × 0.5 + relevance_score × 0.35 + freshness_score × 0.15
```

Freshness decay half-lives by scope:
| Scope | Decay |
|---|---|
| task, validation, risk | 24h |
| mission, file | 48h |
| employee, channel | 72h |
| company, history, preference | 7–14d |
| rules, adn | 30d |

---

## PierreContextPack fields

| Field | Description |
|---|---|
| `signals` | All signals, ranked by sort key |
| `top_rules` | Top 5 rule signals |
| `top_preferences` | Top 5 preference/ADN signals |
| `top_warnings` | Top 5 risk/sensitive signals |
| `missing_info` | List of missing data labels |
| `risk_summary` | Human-readable risk level summary |
| `validation_summary` | Human-readable validation gates summary |
| `employee_summary` | Employee identity + risk one-liner |
| `mission_summary` | Mission status one-liner |
| `file_summary` | File context one-liner |
| `channel_summary` | Channel context one-liner |
| `recommended_next_action` | Top-priority action suggestion |
| `should_require_validation` | `true` if any gate or sensitive signal present |

---

## Security constraints (absolute)

- No async, no DB calls, no AI calls in context layer
- No real API keys required at any point
- `buildPierreContextPack` is pure and synchronous — safe to call in any environment
- Never stores extracted file text (respects B34 FILE_LOG_EXTRACTED_TEXT=false)
- All signals are company_id scoped — no cross-company leakage
- Validation gates cannot be bypassed by the context layer — callers must respect `should_require_validation`

---

## B33 + B34 integration

Files (B34) and channels (B33) are first-class context sources:

```typescript
// B34 files flow into file-context.ts
files: [{ id, safe_filename, risk_level, category, status }]

// B33 channels flow into channel-context.ts
channel_identity: { id, kind, address, status, verification_status }
```

Sensitive files (`risk_level: "sensitive" | "blocked"`) automatically produce `validation_gate` signals.  
Unverified channels automatically produce `constraint` signals.

---

## Validation

```bash
npx tsc --noEmit             # clean
npm run test:context-b35     # 66 passed
npm test                     # 4685 passed
npm run build                # clean
```
