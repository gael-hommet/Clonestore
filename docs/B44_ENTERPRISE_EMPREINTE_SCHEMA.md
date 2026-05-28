# B44 — EnterpriseEmpreinte Schema

**Version**: `1.0.0`  
**Clé mémoire**: `enterprise_empreinte` dans `pierre_company_memory.memory_json`

---

## Type racine : `EnterpriseEmpreinte`

```typescript
{
  id: string                          // userId (tenant key)
  version: string                     // "1.0.0"
  status: EmpreinteStatus             // dérivé du score completion
  company_identity: CompanyIdentity
  locations: CompanyLocation[]
  roles: OrganizationRole[]
  validation_circuits: ValidationCircuit[]
  communication: CommunicationProfile
  channels: ChannelIdentityConfig[]
  autonomy: AutonomyPolicy
  data_governance: DataGovernance
  document_preferences: DocumentPreferences
  memory_seed: EnterpriseMemorySeed
  completion: EmpreinteCompletion
  created_at: string                  // ISO 8601
  updated_at: string                  // ISO 8601
}
```

---

## CompanyIdentity

| Champ | Type | Défaut | Notes |
|-------|------|--------|-------|
| `legal_name` | string | `""` | Raison sociale |
| `trade_name` | string | `""` | Nom commercial |
| `brand_mark` | string | `""` | Sigle / marque (PAS "logo") |
| `brand_asset_url` | string | `""` | URL asset visuel |
| `sector` | string | `""` | Secteur d'activité |
| `size_range` | EmpTeamSize | `"1-10"` | `"1-10"`, `"11-50"`, `"51-200"`, `"201-500"`, `"500+"` |
| `founded_year` | number\|null | `null` | Année de création |
| `country_code` | string | `"FR"` | ISO 3166-1 alpha-2 |
| `main_language` | string | `"fr"` | ISO 639-1 (2 chars) |
| `website_url` | string | `""` | |
| `hr_contact_email` | string | `""` | Email DRH |
| `hr_contact_name` | string | `""` | Nom DRH |
| `values` | string[] | `[]` | Valeurs de l'entreprise |
| `mission_statement` | string | `""` | Raison d'être |
| `tagline` | string | `""` | Accroche |

---

## CommunicationProfile

| Champ | Type | Défaut |
|-------|------|--------|
| `default_tone` | `"formal"\|"professional"\|"friendly"\|"casual"` | `"professional"` |
| `preferred_length` | `"short"\|"medium"\|"long"` | `"medium"` |
| `language_code` | string | `"fr"` |
| `formal_closing` | string | `"Cordialement,"` |
| `greeting_style` | string | `"Bonjour,"` |
| `avoid_words` | string[] | `[]` |
| `preferred_words` | string[] | `[]` |
| `signature_template` | string | `""` |

---

## AutonomyPolicy

| Champ | Type | Défaut | Notes |
|-------|------|--------|-------|
| `default_level` | `"supervised"\|"assisted"\|"autonomous"` | `"supervised"` | |
| `allowed_auto_domains` | string[] | `[]` | |
| `blocked_auto_domains` | string[] | `[]` | |
| `max_auto_tasks_per_mission` | number | `3` | |
| `require_approval_above_risk` | `"low"\|"medium"\|"high"\|"critical"` | `"medium"` | |
| `sensitive_topics` | string[] | `[]` | |
| `never_auto_execute` | string[] | `["email.send","send_email"]` | Toujours présent |

---

## DataGovernance

| Champ | Type | Défaut |
|-------|------|--------|
| `data_retention_days` | number | `365` |
| `gdpr_dpo_email` | string | `""` |
| `gdpr_dpo_name` | string | `""` |
| `data_processing_region` | `"eu"\|"us"\|"global"` | `"eu"` |
| `export_allowed` | boolean | `true` |
| `purge_requires_confirmation` | boolean | `true` |
| `audit_log_retention_days` | number | `730` |

---

## DocumentPreferences

| Champ | Type | Défaut |
|-------|------|--------|
| `preferred_format` | `"markdown"\|"pdf"\|"docx"\|"html"` | `"markdown"` |
| `always_include_signature` | boolean | `false` |
| `always_include_legal_footer` | boolean | `false` |
| `legal_footer_text` | string | `""` |
| `require_validation_for_risk_levels` | string[] | `["high","critical"]` |
| `preferred_template_ids` | string[] | `[]` |
| `document_language` | string | `"fr"` |

---

## EnterpriseMemorySeed

| Champ | Type | Notes |
|-------|------|-------|
| `key_facts` | string[] | Faits clés injectés dans CloneADN |
| `forbidden_topics` | string[] | Sujets à ne jamais aborder |
| `preferred_workflows` | string[] | Workflows prioritaires |
| `custom_vocabulary` | Record<string,string> | Terminologie maison |

---

## CompanyLocation

```typescript
{
  id: string
  label: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postal_code: string | null
  country_code: string | null
  timezone: string | null
  is_headquarters: boolean
  active: boolean
}
```

---

## OrganizationRole

```typescript
{
  id: string
  title: string
  department: string | null
  level: "junior"|"mid"|"senior"|"lead"|"director"|"executive" | null
  is_hr_role: boolean
  can_approve_hr_actions: boolean
  active: boolean
}
```

---

## ValidationCircuit

```typescript
{
  id: string
  label: string
  scope: string
  required_approvers: number         // défaut: 1
  approver_roles: string[]
  max_delay_hours: number | null
  escalation_after_hours: number | null
  active: boolean
}
```

---

## ChannelIdentityConfig

```typescript
{
  channel: "email"|"slack"|"teams"|"sms"|"webhook"
  enabled: boolean
  from_name: string | null
  from_address: string | null
  reply_to: string | null
  footer_text: string | null
  brand_color_hex: string | null     // format: "#RRGGBB"
}
```

---

## EmpreinteCompletion

```typescript
{
  score: number                      // 0–100
  status: EmpreinteStatus
  missing_fields: string[]
  recommendations: string[]
  filled_sections: string[]
  empty_sections: string[]
  can_activate: boolean              // score >= 60
}
```

`EmpreinteStatus` : `"not_configured"` | `"minimal"` | `"partial"` | `"configured"` | `"complete"`

---

## Patch (EnterpriseEmpreintePatch)

Tous les champs sont optionnels. Le patch est mergé sur la base existante.

```typescript
{
  company_identity?: Partial<CompanyIdentity>
  locations?: CompanyLocation[]
  roles?: OrganizationRole[]
  validation_circuits?: ValidationCircuit[]
  communication?: Partial<CommunicationProfile>
  channels?: ChannelIdentityConfig[]
  autonomy?: Partial<AutonomyPolicy>
  data_governance?: Partial<DataGovernance>
  document_preferences?: Partial<DocumentPreferences>
  memory_seed?: Partial<EnterpriseMemorySeed>
  version?: string
}
```
