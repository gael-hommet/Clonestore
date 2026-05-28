# B47 — Legal & Commercial Guardrails

## Overview

B47 implements the legal and commercial safety layer for CloneStore/Pierre before the B48 public launch. It defines what Pierre **can** and **cannot** promise, do, or generate — protecting the product legally while preserving the commercial value proposition.

## Architecture

B47 is organized into two layers:

### Layer 1: Legal-Commercial (CloneStore-wide)
`src/lib/legal-commercial/`

| File | Purpose |
|---|---|
| `types.ts` | Core type definitions (LegalRiskLevel, ClaimDecision, OutputContext, etc.) |
| `claims-policy.ts` | 13+ commercial claim decisions (allowed/forbidden/allowed_with_disclaimer) |
| `forbidden-phrases.ts` | 40+ forbidden phrases detector (marketing, legal, payroll, HR, AI overclaims) |
| `disclaimers.ts` | 9 disclaimers registry + context-aware injection |
| `output-guardrails.ts` | Full output evaluation combining all checks |
| `marketing-guardrails.ts` | Pierre and CloneStore marketing copy validation |
| `pricing-policy.ts` | Pricing rules (449€/mo, founder pricing, no free 7-day trial) |
| `demo-policy.ts` | Demo mode: 13 blocked real actions |
| `acceptance-checklist.ts` | 18-item pre-launch checklist with B48-blocking status |
| `legal-verdict.ts` | Global B47 readiness verdict |
| `fixtures.ts` | Test context builders + safe/forbidden claim constants |

### Layer 2: Pierre Legal (HR-specific)
`src/lib/pierre/legal/`

| File | Purpose |
|---|---|
| `pierre-legal-taxonomy.ts` | 13 sensitive HR categories with risk levels and policies |
| `pierre-legal-guardrails.ts` | Action-level legal enforcement for Pierre |
| `pierre-sensitive-hr-policy.ts` | HR capability matrix (can_prepare, can_send, can_decide) |
| `pierre-document-legal-policy.ts` | Document type policies (14 types, official vs non-official) |
| `pierre-payroll-policy.ts` | Payroll task permissions (allowed vs blocked) |
| `pierre-email-legal-policy.ts` | Email action policies (draft allowed, send blocked) |
| `pierre-commercial-claims.ts` | Pierre-specific safe/forbidden commercial claims |
| `pierre-legal-verdict.ts` | Pierre aggregated legal readiness verdict |

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/pierre/legal/guardrails` | GET | Evaluate action/text for legal safety |
| `/api/pierre/legal/validate-output` | POST | Validate content against all guardrails |
| `/api/pierre/legal/readiness` | GET | Full B47 legal readiness verdict |

## Key Principles

1. **Pierre prepares, humans decide.** For all sensitive HR categories (dismissal, sanction, harassment, etc.), Pierre can draft but cannot send, decide, or export alone.
2. **No false promises.** All commercial claims are classified. Forbidden phrases are detected in all surfaces.
3. **Disclaimers everywhere.** Context-aware disclaimers are injected on official documents, payroll outputs, and marketing copy.
4. **Demo is illustrative.** No real actions in demo mode — no AI cost, no email.send, no official document export.
5. **Pricing is transparent.** 449€/month, no hidden free trial, founder pricing documented.

## Absolute Constraints (never violate)

- Pierre is not a lawyer, jurist, accountant, certified payroll software, or legal replacement.
- Pierre never guarantees conformity, zero errors, or perfect legal decisions.
- Official documents never leave without human validation.
- Pre-payroll never claims to replace DSN, payroll software, or payroll expert.
- Marketing never calls Pierre "juridiquement autonome".
- Non-paying demo users never access real paid capabilities.
- Product limits are never hidden from the customer.
