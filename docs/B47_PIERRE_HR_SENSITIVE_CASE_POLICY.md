# B47 — Pierre HR Sensitive Case Policy

## Overview

This document defines Pierre's behavior for all 13 sensitive HR categories. For each category, Pierre has specific permissions (can/cannot) that must be enforced by the legal guardrails system.

## The Golden Rule

> **Pierre prepares and assists. Humans decide, send, and sign.**

## Category Matrix

| Category | Risk | Can Prepare | Can Draft | Can Send | Can Decide | Can Export | Legal Review |
|---|---|---|---|---|---|---|---|
| dismissal | critical | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| sanction | critical | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| harassment | critical | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| discrimination | critical | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| legal | critical | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| health | high | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| salary | high | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| payroll | high | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| contract | high | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| conflict | high | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ recommended |
| employee_data | high | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ recommended |
| absence_sensitive | medium | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| other | medium | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

## What Pierre Always Does for Sensitive Cases

1. **Prepares a careful summary or draft** — never sends autonomously
2. **Lists missing information** — what's needed before proceeding
3. **Proposes escalation** — to HR manager, legal counsel, or payroll expert
4. **Adds required disclaimers** — HUMAN_RESPONSIBILITY, LEGAL_LIMIT, etc.

## Blocked Actions (never allowed regardless of category)

- `auto_send_dismissal` — auto-sending dismissal notices
- `sign_dismissal` — autonomous signature
- `auto_send_sanction` — auto-sending disciplinary sanctions
- `auto_decide_outcome` — autonomous HR outcomes
- `auto_classify_harassment` — autonomous harassment classification
- `generate_official_payslip` — official payroll generation
- `submit_dsn` — DSN submission
- `auto_export_personal_data` — unvalidated personal data export
- `certify_legal_compliance` — legal compliance certification

## Document Validation Matrix

| Document Type | Official | Human Validation Required | Export Without Validation |
|---|---|---|---|
| contract | ✅ | ✅ | ❌ |
| contract_amendment | ✅ | ✅ | ❌ |
| dismissal_letter | ✅ | ✅ | ❌ |
| sanction | ✅ | ✅ | ❌ |
| attestation | ✅ | ✅ | ❌ |
| employee_certificate | ✅ | ✅ | ❌ |
| payroll_document | ✅ | ✅ | ❌ |
| sensitive_hr_letter | ❌ | ✅ | ❌ |
| health_absence_document | ❌ | ✅ | ❌ |
| prepayroll_summary | ❌ | ✅ | ❌ |
| onboarding_document | ❌ | ❌ | ✅ |
| hr_internal_note | ❌ | ❌ | ✅ |
| general_hr_document | ❌ | ❌ | ✅ |

## Implementation

Use these functions to enforce the policy:

```typescript
// Check if an action is allowed
import { enforcePierreLegalGuardrails } from "@/lib/pierre/legal/pierre-legal-guardrails";
const { allowed, reason } = enforcePierreLegalGuardrails("auto_send", "licenciement text");

// Get HR capabilities for a category
import { getPierreSensitiveHrCapability } from "@/lib/pierre/legal/pierre-sensitive-hr-policy";
const cap = getPierreSensitiveHrCapability("dismissal");
// cap.can_send === false, cap.can_prepare === true

// Check document export policy
import { requireValidationForDocumentType } from "@/lib/pierre/legal/pierre-document-legal-policy";
const needsValidation = requireValidationForDocumentType("contract"); // true
```
