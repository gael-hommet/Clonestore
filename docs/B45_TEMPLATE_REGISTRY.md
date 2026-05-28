# B45 — Template Registry

## Overview

B45 defines 10 Pierre-specific HR document templates in a section-based format using `{{token}}` syntax. All are registered in `template-registry.ts` and validated by `validateTemplateRegistry`.

## Template Format (B45 vs B27)

B45 uses `DocumentTemplate` with `DocumentTemplateSection[]`:
- Each section has a `content_template` with `{{variable_name}}` tokens
- `rendering_hint` controls HTML output: `document_title`, `main_body`, `legal_notice`, `signature_block`, `checklist`, `alert_list`, `table`, `company_header`
- Different from B27's `CloneDocumentTemplate` (block-based)

## Template Catalog

| ID | Document Type | Category | Risk | Official | Validation |
|----|--------------|----------|------|----------|------------|
| `pierre_employment_certificate_simple_v1` | `employment_certificate` | certificate | high | ✓ | required_before_export |
| `pierre_missing_documents_request_v1` | `missing_documents_request` | request | medium | — | recommended |
| `pierre_onboarding_plan_v1` | `onboarding_plan` | onboarding | low | — | none |
| `pierre_absence_followup_v1` | `absence_followup` | followup | medium | — | recommended |
| `pierre_prepayroll_summary_v1` | `prepayroll_summary` | payroll | high | — | required_before_send |
| `pierre_candidate_reply_v1` | `candidate_reply` | recruitment | low | — | none |
| `pierre_manager_followup_v1` | `manager_followup` | followup | medium | — | recommended |
| `pierre_employee_file_summary_v1` | `employee_file_summary` | hr_file | medium | — | recommended |
| `pierre_executive_hr_report_v1` | `executive_hr_report` | report | high | — | required_before_send |
| `pierre_internal_hr_note_v1` | `internal_hr_note` | internal | low | — | none |

## Required Variables by Template

### Employment Certificate (official_document=true)
- `company_name`, `employee_name`, `position_title`, `start_date`, `issue_date`, `signatory_name`, `signatory_title`
- Optional: `contract_type`, `department`, `employee_id`, `company_address`

### Prepayroll Summary
- `payroll_period`, `variable_items`, `anomalies`, `missing_justificatifs`, `company_name`
- Optional: `hr_contact_name`, `total_variable_amount`
- Always includes DSN/payroll disclaimer section (`rendering_hint: "legal_notice"`)

### Onboarding Plan
- `employee_name`, `start_date`, `position_title`, `company_name`
- Optional: `department`, `buddy_name`, `manager_name`, `it_access_items`, `week1_goals`

### Candidate Reply
- `candidate_name`, `position_title`, `company_name`, `decision`
- Optional: `interview_date`, `next_steps`, `hr_contact_name`

### Executive HR Report
- `reporting_period`, `company_name`, `key_metrics`, `key_actions`
- Optional: `workforce_count`, `attrition_rate`, `open_positions`, `hr_contact_name`

## PIERRE_TEMPLATE_IDS Constants

```typescript
export const PIERRE_TEMPLATE_IDS = {
  EMPLOYMENT_CERTIFICATE: "pierre_employment_certificate_simple_v1",
  MISSING_DOCUMENTS: "pierre_missing_documents_request_v1",
  ONBOARDING_PLAN: "pierre_onboarding_plan_v1",
  ABSENCE_FOLLOWUP: "pierre_absence_followup_v1",
  PREPAYROLL_SUMMARY: "pierre_prepayroll_summary_v1",
  CANDIDATE_REPLY: "pierre_candidate_reply_v1",
  MANAGER_FOLLOWUP: "pierre_manager_followup_v1",
  EMPLOYEE_FILE_SUMMARY: "pierre_employee_file_summary_v1",
  EXECUTIVE_HR_REPORT: "pierre_executive_hr_report_v1",
  INTERNAL_HR_NOTE: "pierre_internal_hr_note_v1",
} as const;
```

## Template Validation Rules

`validateDocumentTemplate(template)` enforces:
- ID, document_type, label required
- At least 1 section with content_template
- No bracket placeholders `[BRACKET]` in section content
- No forbidden chatgpt phrases (`Voici un modèle`, `[Votre nom]`, etc.)
- `official_document: true` must have non-none validation requirement
- `prepayroll_summary` must have a DSN disclaimer section
- All required_variables must appear as tokens in at least one section

## API Lookups

```typescript
getB45TemplateRegistry()        // all 10 templates
getB45TemplateById(id)          // by ID, returns null if not found
getB45TemplatesByCategory(cat)  // by category
listB45OfficialTemplates()      // only official_document=true
```
