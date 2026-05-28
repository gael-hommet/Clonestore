# B45 — Document Quality Gates

## Purpose

Quality gates prevent Pierre from generating documents with the following anti-patterns:
- Generic "ChatGPT-style" placeholder text
- Ugly unresolved bracket variables `[Votre nom]`
- Unresolved `{{token}}` placeholders  
- HTML/JS injection
- Legal finality claims
- Official documents without human validation requirement
- Prepayroll summaries without DSN/payroll disclaimer

## Hard Fails vs Warnings

**Hard fails** (`hard_fails[]`) make `client_visible_safe = false` and block client output regardless of score.

**Warnings** (`warnings[]`) reduce score but allow output.

## Hard Fail Catalog

| Rule | Trigger | Hard fail message |
|------|---------|-------------------|
| `assertNoGenericChatGptPhrasing` | Text contains "Voici un modèle", "[Votre nom]", "[Nom de l'entreprise]", "à adapter selon votre situation", "je vous conseille juridiquement" | Phrase générique détectée |
| `assertNoUglyPlaceholders` | Text/HTML contains `[BRACKET]` patterns | Placeholder non résolu |
| `assertClientVisibleQuality` | `unresolved_tokens` is non-empty | Tokens non résolus dans le rendu |
| `assertOfficialDocumentGuardrails` | `official_document=true` but `validation_requirement=none` | Document officiel sans validation humaine |
| `assertPayrollDocumentGuardrails` | `document_type=prepayroll_summary` but HTML has no DSN/payroll disclaimer | Résumé de paie sans mention DSN |
| Security check | HTML contains `<script` or event handlers `on\w+=` | Injection HTML/JS détectée |

## Score Computation

`scoreRenderedDocumentQuality` returns a score 0–100:

```
Base: 100
- 30 points for each hard fail
- 10 points for each warning
- 20 points if missing_variables is non-empty
- 20 points if document text < 50 chars
- 15 points if document lacks structure (no h1/h2)
- 15 points if company_name absent from text
Min: 0, Max: 100
```

`passed = score >= 60 && hard_fails.length === 0`  
`client_visible_safe = hard_fails.length === 0`

## Pierre Document Verdict (5 Areas)

`buildPierreDocumentVerdict(result, ctx)` returns `PierreDocumentVerdict` with 5 scored areas:

| Area | What it checks |
|------|---------------|
| `anti_chatgpt` | No generic chatgpt phrasing in rendered text |
| `structure` | Has h1 title, h2 sections, text ≥ 100 chars |
| `safety` | No script tags or event handlers |
| `enterprise_identity` | Company name present in rendered text |
| `completeness` | No missing variables or unresolved tokens |

**Levels:** `poor` (<50) / `acceptable` (50–69) / `good` (70–89) / `premium` (≥90)

## Document Style Verdict (Kit Readiness)

`buildDocumentStyleVerdict(styleKit)` returns `DocumentStyleVerdict` with 5 areas:

| Area | What it checks |
|------|---------------|
| `style_kit` | computeStyleKitCompletion score and can_activate |
| `legal_config` | `never_claim_legal_finality = true` |
| `reference_sources` | At least 1 reference source imported |
| `template_registry` | validateTemplateRegistry passes |
| `visual_identity` | brand_mark_text or brand_asset_url configured |

**Levels:** `not_ready` (blocking issues) / `basic` (<40) / `standard` (40–59) / `premium` (60–79) / `certified` (≥80)

**`safe_to_generate_official`** = no blocking issues AND `legal.require_human_validation_for_official = true`

## Build Pipeline Flow

```typescript
buildPierreDocument({ templateId, variables, enterprise, pierre, userId })
  1. buildPierreDocumentContext()       → DocumentRenderContext | null (null = unknown template)
  2. findMissingVariables()             → blocks official docs with missing required vars
  3. renderPierreDocument(ctx)          → DocumentRenderResult
  4. scoreRenderedDocumentQuality()     → DocumentQualityResult
  5. validatePierreDocumentBeforeExport → { can_export, blocking_reasons }
  6. → PierreDocumentBuildResult {
       ok, render_result, quality, status, verdict_message, ready_for_export, errors
     }
```

**Status values:**
- `blocked` — missing template, missing required vars for official doc, or render failed
- `pending_validation` — rendered OK but `validation_requirement` requires human review
- `ready` — rendered OK, no validation required

## Export Blocking Logic

`validatePierreDocumentBeforeExport(result)` blocks export when:
1. `result.ok === false`
2. `result.missing_variables.length > 0`
3. `result.unresolved_tokens.length > 0`
4. `result.quality_score < 50`
5. `result.validation_requirement` is `required_before_export` or `blocked_without_human`

## Product Rule

> Pierre ne doit jamais sortir un document du style:
> - "Voici un modèle…"
> - "Cordialement, [Votre nom]"
> - "À adapter selon votre situation"
> - Markdown brut dans un PDF
> - Variables moches non résolues
> - Document générique sans identité entreprise
