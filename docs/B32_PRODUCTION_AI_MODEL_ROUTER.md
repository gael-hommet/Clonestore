# B32 — Production AI Model Router

CloneStore AI runtime layer: providers, routing, cost, budget, usage logging.

---

## Architecture

```
src/lib/cloneos/ai/
  types.ts           — all B32 types (AiRuntimeMode, AiModelPreset, AiCostEstimate, ...)
  mode.ts            — AI_RUNTIME_MODE env parsing (mock | disabled | production)
  model-presets.ts   — named preset registry (18 presets)
  cost.ts            — cost estimation by model (per 1000 tokens)
  budgets.ts         — budget enforcement (pure, no DB)
  usage-log.ts       — usage log builder + console tracer
  model-router.ts    — use-case → profile → policy routing
  providers.ts       — OpenAI / Anthropic / Mock adapters
  runtime.ts         — orchestrator: mode check → budget → provider loop → log
  prompt-registry.ts — 23 prompt contracts

src/lib/pierre/ai/
  runtime.ts         — Pierre HR bridge functions (deliverables + existing)
```

---

## Runtime Mode

Controlled by `AI_RUNTIME_MODE` env var:

| Mode | Behaviour |
|------|-----------|
| `mock` (default) | No real API calls. All responses are mock. Safe for dev/test without keys. |
| `disabled` | All AI requests blocked immediately. Returns error. |
| `production` | Real API calls via configured providers. Budget enforcement active. |

---

## Model Doctrine (B32)

| Use | Provider | Model | Profile |
|-----|----------|-------|---------|
| Livrables client (docs, PDF, contrats, rapports) | Anthropic | Claude Opus 4.7 | `premium_generation` |
| Mission planning, orchestration, risque standard | OpenAI | GPT-4.1 | `orchestration` |
| Micro-tâches, classification, extraction, statuts | OpenAI | GPT-4.1-mini | `micro_task` |
| Raisonnement structuré | Anthropic | Claude Sonnet 4.6 | `structured_reasoning` |
| Classification rapide | OpenAI | GPT-4.1-mini | `fast_classification` |

---

## Model Presets (18 total)

### Premium — Claude Opus 4.7 (livrables client)

| Key | Label |
|-----|-------|
| `deliverable_premium` | Livrable premium |
| `document_generation` | Génération document RH |
| `pdf_content_generation` | Contenu PDF |
| `spreadsheet_content_generation` | Contenu tableur/Excel |
| `client_fiche_generation` | Fiche client |
| `final_report_generation` | Rapport RH final dirigeant |
| `contract_draft_generation` | Rédaction contrat |
| `hr_letter_generation` | Courrier RH important |
| `premium_delivery_review` | Revue qualité livrable |
| `risk_analysis_sensitive` | Analyse risque sensible |

### Orchestration — GPT-4.1 fort

| Key | Label |
|-----|-------|
| `mission_planning` | Planification mission |
| `task_orchestration` | Orchestration tâches |
| `risk_analysis_standard` | Analyse risque standard |

### Micro-tâches — GPT-4.1-mini

| Key | Label |
|-----|-------|
| `status_update` | Mise à jour statut |
| `intent_detection` | Détection d'intention |
| `field_extraction` | Extraction de champs |

### Embeddings

| Key | Label |
|-----|-------|
| `embeddings_quality` | text-embedding-3-large |
| `embeddings_cost` | text-embedding-3-small |

---

## Cost Rates (cents per 1000 tokens)

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-7 | 1.500¢ | 7.500¢ |
| claude-sonnet-4-6 | 0.300¢ | 1.500¢ |
| claude-haiku-4-5 | 0.080¢ | 0.400¢ |
| gpt-4.1 | 0.200¢ | 0.800¢ |
| gpt-4.1-mini | 0.040¢ | 0.160¢ |
| gpt-4.1-nano | 0.010¢ | 0.040¢ |

---

## Budget Enforcement

Configured via env vars, checked before every production API call:

| Env var | Default | Description |
|---------|---------|-------------|
| `AI_DEFAULT_DAILY_BUDGET_CENTS` | 500 ($5) | Max spend per day |
| `AI_DEFAULT_MONTHLY_BUDGET_CENTS` | 10000 ($100) | Max spend per month |
| `AI_SINGLE_CALL_MAX_CENTS` | 100 ($1) | Hard cap per single call |

Budget enforcement is **pure** (no DB). Callers supply `used_cents` from DB/cache. DB-level aggregation uses the `ai_usage_logs` table.

---

## Usage Logging

`buildAiUsageLog()` — pure builder, returns `AiUsageLogInput`.  
`traceAiUsageLog()` — console.log in production mode; silent in mock mode.

**No PII in default trace** — prompt content is stripped unless `AI_LOG_PROMPTS=true`.

Callers (API routes) persist to `ai_usage_logs` via `supabaseAdmin`.

---

## New B32 Prompt Contracts (7)

| ID | Use Case | Output | Profile |
|----|----------|--------|---------|
| pierre.document.generate.v1 | Document RH complet | markdown | premium_generation |
| pierre.pdf.generate.v1 | Contenu PDF structuré | markdown | premium_generation |
| pierre.spreadsheet.generate.v1 | Données tableur JSON | json | premium_generation |
| pierre.client_fiche.generate.v1 | Fiche synthèse client/salarié | json | premium_generation |
| pierre.final_report.generate.v1 | Rapport RH direction | markdown | premium_generation |
| pierre.hr_letter.generate.v1 | Courrier RH formel | markdown | premium_generation |
| pierre.risk.sensitive.v1 | Analyse risque sensible | json | premium_generation |

Total contracts: **23** (16 prior + 7 B32)

---

## Pierre Bridge Functions (B32)

```typescript
// src/lib/pierre/ai/runtime.ts

generatePierreDocumentWithAI(params)     → { ok, content, provider, warnings, error }
generatePierrePdfContentWithAI(params)   → { ok, content, provider, warnings, error }
generatePierreClientFicheWithAI(params)  → { ok, fiche, provider, warnings, error }
generatePierreFinalReportWithAI(params)  → { ok, content, provider, warnings, error }
generatePierreHrLetterWithAI(params)     → { ok, content, provider, warnings, error }
analyzePierreRiskSensitiveWithAI(params) → { ok, analysis, humanValidationRequired, provider, warnings, error }
```

`analyzePierreRiskSensitiveWithAI` always defaults `humanValidationRequired=true` on parse failure — never assume safe on sensitive cases.

---

## Security Constraints (B32)

- No API keys hardcoded anywhere. All via env vars.
- No API keys exposed to client — all provider calls are server-side only.
- No real API calls in mock or disabled mode.
- Budget check blocks oversized calls before they hit the API.
- Usage log strips PII by default (`AI_LOG_PROMPTS=false`).
- `analyzePierreRiskSensitiveWithAI` always sets `humanValidationRequired=true` on parse failure.
- HR letters and sensitive risk analysis have `risk_mode: sensitive` — always include human validation mention.

---

## Environment Variables

```bash
# Runtime
AI_RUNTIME_MODE=mock          # mock | disabled | production

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_ANTHROPIC_OPUS_MODEL=claude-opus-4-7
AI_ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6
AI_ANTHROPIC_FAST_MODEL=claude-haiku-4-5-20251001

# OpenAI
OPENAI_API_KEY=sk-...
AI_OPENAI_STRONG_MODEL=gpt-4.1
AI_OPENAI_FAST_MODEL=gpt-4.1-mini

# Budget
AI_DEFAULT_DAILY_BUDGET_CENTS=500
AI_DEFAULT_MONTHLY_BUDGET_CENTS=10000
AI_SINGLE_CALL_MAX_CENTS=100

# Logging
AI_LOG_PROMPTS=false
```

---

## Tests

```bash
npm run test:ai       # ai-runtime.test.ts (166 tests)
npm run test:ai-b32   # ai-b32.test.ts (71 tests)
npm test              # full suite (4465 tests)
```

All tests run in mock mode — no real API keys required.
