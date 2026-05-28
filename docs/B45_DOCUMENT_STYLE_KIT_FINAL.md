# B45 — Document Style Kit — Final Setup

## Purpose

B45 introduces a per-company **Document Style Kit** system that elevates Pierre's document generation from "functional" to "premium branded." Each kit encapsulates visual identity, typography, colors, page layout, header/footer, signature blocks, table styles, legal config, tone profile, and reference document sources — all derived from the B44 Enterprise Empreinte.

## Architecture

```
src/lib/clonestore/document-style-kit/   ← Core library (pure, no Supabase)
  types.ts                               ← All B45 type definitions
  defaults.ts                            ← createDefaultDocumentStyleKit()
  sanitize.ts                            ← escapeHtml, stripUnsafeHtml, stripTenantSpoofingFields
  tokens.ts                              ← extractTemplateTokens, resolveTemplateTokens, mergeVariables
  style-kit-validation.ts               ← computeStyleKitCompletion, validateDocumentStyleKit
  style-kit-normalizer.ts               ← normalizeDocumentStyleKit, mergeDocumentStyleKitPatch
  reference-sources.ts                  ← classifyReferenceSource, computeReferenceSourceCoverage
  template-registry.ts                  ← 10 B45 templates (section-based, {{token}} format)
  template-validation.ts                ← validateDocumentTemplate, validateTemplateRegistry
  html-renderer.ts                      ← renderDocumentTemplateToHtml (premium CSS + HTML)
  pdf-ready-renderer.ts                 ← renderPdfReadyHtml (@page CSS, no binary PDF)
  quality-gates.ts                      ← scoreRenderedDocumentQuality (hard fails + scoring)
  artifact-metadata.ts                  ← buildDocumentArtifactMetadata, mapArtifactToCockpitDeliverable
  fixtures.ts                           ← Test helpers

src/lib/pierre/document-style/          ← Pierre integration layer
  pierre-document-types.ts             ← PierreDocumentBuildResult, PierreDocumentVerdict
  pierre-document-context.ts           ← buildPierreDocumentContext (B44 → DocumentRenderContext)
  pierre-document-renderer.ts          ← buildPierreDocument (full pipeline)
  pierre-document-quality.ts           ← buildPierreDocumentVerdict (5-area assessment)
  pierre-document-artifacts.ts         ← buildPierreDocumentArtifact, buildRedactedDocumentPreview
  pierre-document-verdict.ts           ← buildDocumentStyleVerdict (kit readiness)

src/app/api/pierre/documents/           ← API routes
  validate/route.ts                    ← POST — no auth, validates template + variables
  preview/route.ts                     ← POST — auth optional, returns HTML preview
  render/route.ts                      ← POST — auth required, full render pipeline
```

## DocumentStyleKit

```typescript
interface DocumentStyleKit {
  id: string;
  user_id: string;
  version: number;
  status: "draft" | "active" | "archived";
  visual_identity: VisualIdentityConfig;   // brand_mark_text (NOT logo), brand_asset_url
  typography: TypographyConfig;
  color_system: ColorSystemConfig;
  page_layout: PageLayoutConfig;
  header: HeaderConfig;
  footer: FooterConfig;
  signature: SignatureConfig;
  tables: TableStyleConfig;
  legal: LegalDocumentConfig;             // never_claim_legal_finality ALWAYS true
  tone: ToneStyleConfig;
  reference_sources: ReferenceDocumentSource[];
  completion: StyleKitCompletion | null;
}
```

**Critical constraints:**
- `never_claim_legal_finality` is always `true` — enforced in normalizer and defaults.
- Visual identity uses `brand_mark_text` and `brand_asset_url` (never "logo").
- `stripTenantSpoofingFields` removes `user_id`, `company_id`, `organization_id`, `tenant_id`, `id` from all client inputs.

## B44 Integration

`createDefaultDocumentStyleKit({ user_id, enterprise?, pierre? })` applies B44 overrides:
- `enterprise.visual_identity.brand_mark` → `visual_identity.brand_mark_text`
- `enterprise.visual_identity.brand_asset_url` → `visual_identity.brand_asset_url`
- `pierre.document_style_prep.primary_color_hex` → `color_system.primary_color_hex`
- `pierre.document_style_prep.font_family` → `typography.primary_font_family`
- `pierre.document_style_prep.signature_template` → `signature.signature_template`
- `pierre.document_style_prep.legal_footer_text` → `legal.legal_footer_text`
- `pierre.document_style_prep.always_include_signature` → `signature.enabled = true`

## Variable Merge Priority

Variables are merged with **caller overriding mission overriding empreinte**:

```
empreinteVars (B44) → missionContext.extra_variables → caller-supplied variables
```

`mergeVariables(...objects)` applies a consistent merge strategy.

## Absolute Constraints (preserved verbatim from spec)

- Ne pas appeler OpenAI live.
- Ne pas appeler Anthropic.
- Ne pas envoyer de vrai email.
- Ne pas appeler Resend live.
- Ne pas appliquer SQL Supabase réel.
- Ne pas rendre Supabase obligatoire dans les tests.
- Ne pas installer de dépendance lourde PDF.
- Ne pas casser B38/B39/B40/B41/B42/B43/B44.
- Ne pas stocker de documents RH bruts dans logs/observability.
- Ne pas logger de prompts/completions.
- Ne pas accepter company_id/user_id/organization_id depuis le client comme source de vérité serveur.
- Ne pas faire un renderer HTML fragile avec injection non sécurisée.
- Ne pas utiliser le mot "Logo" dans noms de fichiers/composants/types.
