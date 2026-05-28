# B44 → B45 Document Style Handoff

**Contexte** : B44 collecte et normalise les préférences de style documentaire de l'entreprise et de Pierre. B45 (Document Style Kit) consomme ces données pour rendre les documents avec la charte graphique du client.

---

## Fonctions d'interface

### `buildPierreDocumentRenderConfig`

```typescript
import { buildPierreDocumentRenderConfig } from "@/lib/pierre/empreinte/pierre-document-prep";

const config = buildPierreDocumentRenderConfig({ pierre, enterprise });
```

**Retourne** `PierreDocumentRenderConfig` :

```typescript
{
  font_family: string               // ex: "Inter, sans-serif"
  primary_color_hex: string         // ex: "#1A56DB"
  secondary_color_hex: string       // ex: "#7E3AF2"
  header_template: string           // template Markdown/HTML
  footer_template: string
  use_company_brand_mark: boolean
  brand_asset_url: string           // URL logo/marque
  legal_footer_text: string
  signature_template: string
  document_language: string         // ex: "fr"
  preferred_format: string          // "markdown"|"pdf"|"docx"|"html"
  always_include_signature: boolean
  always_include_legal_footer: boolean
}
```

### `buildDocumentVariablesFromEmpreinte`

```typescript
import { buildDocumentVariablesFromEmpreinte } from "@/lib/pierre/empreinte/pierre-document-prep";

const vars = buildDocumentVariablesFromEmpreinte({ pierre, enterprise });
```

**Retourne** `Record<string, unknown>` — variables de merge pour templates :

| Variable | Source |
|----------|--------|
| `company_name` | `enterprise.company_identity.legal_name` ou `trade_name` |
| `company_brand_mark` | `enterprise.company_identity.brand_mark` |
| `company_brand_asset_url` | `enterprise.company_identity.brand_asset_url` |
| `company_country` | `enterprise.company_identity.country_code` |
| `hr_contact_email` | `enterprise.company_identity.hr_contact_email` |
| `hr_contact_name` | `enterprise.company_identity.hr_contact_name` |
| `legal_footer` | `enterprise.document_preferences.legal_footer_text` |
| `signature_template` | `enterprise.communication.signature_template` |
| `pierre_display_name` | `pierre.identity.display_name` |
| `document_language` | `pierre.document_rules.default_language` |
| `primary_color` | `pierre.document_style.primary_color_hex` |
| `secondary_color` | `pierre.document_style.secondary_color_hex` |

---

## Règles de fusion

1. `pierre.document_style` prend le dessus sur `enterprise.document_preferences` pour la typographie et les couleurs
2. `enterprise.communication.signature_template` est la source de vérité pour la signature
3. `enterprise.company_identity.brand_mark` est le texte alternatif quand `brand_asset_url` est vide
4. Si `always_include_legal_footer = true` ET `legal_footer_text` est vide → warning dans les recommendations de completion
5. `document_language` : `pierre.document_rules.default_language` ou fallback `enterprise.company_identity.main_language`

---

## Usage dans B45

```typescript
// Dans un générateur de document B45 :
import { buildPierreDocumentRenderConfig, buildDocumentVariablesFromEmpreinte } from "@/lib/pierre/empreinte/pierre-document-prep";
import { readOrCreateEnterpriseEmpreinte } from "@/lib/clonestore/empreinte/enterprise-memory-bridge";
import { readOrCreatePierreEmpreinte } from "@/lib/pierre/empreinte/pierre-memory-bridge";

const enterprise = readOrCreateEnterpriseEmpreinte(memoryJson, userId);
const pierre = readOrCreatePierreEmpreinte(memoryJson, userId);

const renderConfig = buildPierreDocumentRenderConfig({ pierre, enterprise });
const variables = buildDocumentVariablesFromEmpreinte({ pierre, enterprise });

// renderConfig → injecté dans le renderer PDF/DOCX/Markdown
// variables → merge dans les templates de contenu
```

---

## Contraintes héritées de B44

- Jamais "logo_url" ni "use_logo" — utiliser `brand_asset_url` et `use_company_brand_mark`
- `brand_mark` = texte/sigle (string), `brand_asset_url` = URL binaire
- Si `use_company_brand_mark = false` → ne pas inclure le logo dans le rendu
- `legal_footer_text` peut contenir du Markdown — B45 doit le rendre correctement
- `signature_template` est un template avec variables `{{name}}`, `{{title}}`, `{{email}}`, `{{company}}`

---

## Checklist avant activation B45

- [ ] `enterprise.completion.score >= 60` (`can_activate = true`)
- [ ] `company_identity.legal_name` non vide
- [ ] `company_identity.hr_contact_email` valide
- [ ] `document_preferences.preferred_format` défini
- [ ] `pierre.document_rules.allowed_document_types` non vide
- [ ] `pierre.document_style` renseigné (ou defaults acceptés)
- [ ] Verdict `level` ≥ `"production_ready"` si documents sensibles
