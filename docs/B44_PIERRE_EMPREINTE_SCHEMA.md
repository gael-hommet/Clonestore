# B44 — PierreEmpreinte Schema

**Version**: `1.0.0`  
**Clé mémoire**: `pierre_empreinte` dans `pierre_company_memory.memory_json`

---

## Type racine : `PierreEmpreinte`

```typescript
{
  id: string                          // pierre_empreinte_{userId}
  enterprise_empreinte_id: string     // userId (lien vers enterprise)
  version: string                     // "1.0.0"
  status: PierreEmpreinteStatus
  identity: PierreIdentityConfig
  hr_scope: HrScopeConfig
  workflow_rules: PierreWorkflowRules
  recruitment: RecruitmentPreferences
  onboarding: OnboardingPreferences
  absences: AbsencePreferences
  prepayroll: PrepayrollPreferences
  employee_file: EmployeeFilePreferences
  document_rules: PierreDocumentRules
  email_rules: PierreEmailRules
  sensitive_cases: SensitiveCaseRules
  autonomy: PierreAutonomyRules
  document_style: PierreDocumentStylePrep
  completion: PierreEmpreinteCompletion
  created_at: string
  updated_at: string
}
```

---

## PierreIdentityConfig

| Champ | Type | Défaut |
|-------|------|--------|
| `display_name` | string | `"Pierre"` |
| `persona_description` | string | `""` |
| `language_code` | string | `"fr"` |
| `use_company_brand_mark` | boolean | `false` |
| `visual_identity_asset_url` | string | `""` |

> Note : `use_company_brand_mark` et `visual_identity_asset_url` — jamais "logo_url" ni "use_logo".

---

## HrScopeConfig

| Champ | Type | Défaut | Notes |
|-------|------|--------|-------|
| `active_domains` | string[] | `["contracts","onboarding","absences","prepayroll","employee_file"]` | Domaines RH activés |
| `excluded_domains` | string[] | `[]` | |
| `max_employees_managed` | number\|null | `null` | |
| `collective_agreement_ref` | string | `""` | Référence CCT |
| `applicable_country_codes` | string[] | `["FR"]` | |

---

## PierreWorkflowRules

| Champ | Type | Défaut |
|-------|------|--------|
| `require_human_for_dismissal` | boolean | `true` |
| `require_human_for_salary_change` | boolean | `true` |
| `require_human_for_contract_signing` | boolean | `true` |
| `auto_generate_welcome_email` | boolean | `false` |
| `auto_send_payslip_notification` | boolean | `false` |
| `max_concurrent_onboarding` | number | `5` |
| `escalation_delay_hours` | number | `24` |
| `document_review_required_above_risk` | string | `"medium"` |

---

## PierreDocumentRules

| Champ | Type | Défaut |
|-------|------|--------|
| `require_legal_footer` | boolean | `false` |
| `require_signature_block` | boolean | `false` |
| `allowed_document_types` | string[] | `["contract","letter","notice","report","payslip","onboarding_pack"]` |
| `blocked_document_types` | string[] | `[]` |
| `default_language` | string | `"fr"` |
| `require_hr_review_above_risk` | string | `"medium"` |
| `template_prefix` | string | `""` |

---

## PierreEmailRules

| Champ | Type | Défaut | Notes |
|-------|------|--------|-------|
| `send_mode` | PierreEmailSendMode | `"draft_only"` | `"draft_only"`, `"preview_before_send"`, `"live_auto"` |
| `require_confirmation_for_types` | string[] | `["dismissal","salary_change","contract_termination"]` | |
| `from_name_override` | string | `""` | |
| `cc_hr_on_all` | boolean | `false` | |
| `bcc_audit_address` | string | `""` | |
| `max_recipients_per_send` | number | `10` | |

---

## SensitiveCaseRules

| Champ | Type | Défaut |
|-------|------|--------|
| `always_escalate_topics` | string[] | `["discrimination","harassment","whistleblower","mental_health","termination_dispute"]` |
| `require_legal_review` | string[] | `["dismissal_cause_reelle","inaptitude","licenciement_economique"]` |
| `data_masking_for_roles` | string[] | `[]` |
| `incident_retention_days` | number | `1825` |

---

## PierreAutonomyRules

| Champ | Type | Défaut | Notes |
|-------|------|--------|-------|
| `ai_mode` | PierreAiMode | `"assist"` | `"assist"`, `"suggest"`, `"draft"`, `"autonomous"` |
| `trust_level` | PierreTrustLevel | `"supervised"` | `"supervised"`, `"trusted"`, `"autonomous"` |
| `blocked_task_types` | string[] | `["email.send","send_email"]` | Toujours présent |
| `allowed_without_approval` | string[] | `[]` | |
| `max_daily_autonomous_actions` | number | `10` | |

---

## PierreDocumentStylePrep (handoff B45)

| Champ | Type | Notes |
|-------|------|-------|
| `font_family` | string | Police principale |
| `primary_color_hex` | string | Couleur primaire (format `#RRGGBB`) |
| `secondary_color_hex` | string | Couleur secondaire |
| `header_template` | string | Template entête |
| `footer_template` | string | Template pied de page |
| `use_company_brand_mark` | boolean | Inclure la marque entreprise |
| `brand_asset_url` | string | URL asset visuel |
| `legal_footer_text` | string | Footer légal |
| `signature_template` | string | Template signature |

---

## PierreEmpreinteCompletion

```typescript
{
  score: number                      // 0–100
  status: PierreEmpreinteStatus
  missing_fields: string[]
  recommendations: string[]
  filled_sections: string[]
  empty_sections: string[]
  can_activate: boolean              // score >= 60
  blocking_issues: string[]
}
```

`PierreEmpreinteStatus` : `"not_configured"` | `"minimal"` | `"partial"` | `"configured"` | `"complete"`

---

## Verdict global : `PierreEmpreinteVerdict`

```typescript
{
  overall_score: number              // enterprise×0.4 + pierre×0.6
  ready_to_activate: boolean
  level: PierreEmpreinteVerdictLevel // "not_ready"|"minimal_viable"|"production_ready"|"fully_configured"|"locked"
  areas: PierreEmpreinteVerdictArea[]
  blocking_issues: string[]
  recommendations: string[]
  generated_at: string
}
```

---

## Snapshot : `PierreEmpreinteSnapshot`

```typescript
{
  enterprise: EnterpriseEmpreinte
  pierre: PierreEmpreinte
  overall_completion: number
  ready_to_activate: boolean
  generated_at: string
}
```

---

## Patch (PierreEmpreintePatch)

Tous les champs optionnels, mergés sur la base existante :

```typescript
{
  identity?: Partial<PierreIdentityConfig>
  hr_scope?: Partial<HrScopeConfig>
  workflow_rules?: Partial<PierreWorkflowRules>
  recruitment?: Partial<RecruitmentPreferences>
  onboarding?: Partial<OnboardingPreferences>
  absences?: Partial<AbsencePreferences>
  prepayroll?: Partial<PrepayrollPreferences>
  employee_file?: Partial<EmployeeFilePreferences>
  document_rules?: Partial<PierreDocumentRules>
  email_rules?: Partial<PierreEmailRules>
  sensitive_cases?: Partial<SensitiveCaseRules>
  autonomy?: Partial<PierreAutonomyRules>
  document_style?: Partial<PierreDocumentStylePrep>
  version?: string
}
```
