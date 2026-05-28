// B45 — Pierre document style verdict
// Assesses overall document style readiness for a user/enterprise.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentStyleKit } from "../../clonestore/document-style-kit/types";
import { computeStyleKitCompletion } from "../../clonestore/document-style-kit/style-kit-validation";
import { computeReferenceSourceCoverage } from "../../clonestore/document-style-kit/reference-sources";
import { getB45TemplateRegistry } from "../../clonestore/document-style-kit/template-registry";
import { validateTemplateRegistry } from "../../clonestore/document-style-kit/template-validation";

export interface DocumentStyleVerdictArea {
  name: string;
  score: number;
  passed: boolean;
  detail: string;
}

export interface DocumentStyleVerdict {
  overall_score: number;
  level: "not_ready" | "basic" | "standard" | "premium" | "certified";
  areas: DocumentStyleVerdictArea[];
  blocking_issues: string[];
  recommendations: string[];
  template_registry_valid: boolean;
  style_kit_can_activate: boolean;
  reference_sources_premium: boolean;
  safe_to_generate_official: boolean;
}

// ── Build verdict ─────────────────────────────────────────────────────────────

export function buildDocumentStyleVerdict(
  styleKit: DocumentStyleKit,
): DocumentStyleVerdict {
  const completion = computeStyleKitCompletion(styleKit);
  const coverage = computeReferenceSourceCoverage(styleKit.reference_sources);
  const templates = getB45TemplateRegistry();
  const registryResult = validateTemplateRegistry(templates);

  const areas: DocumentStyleVerdictArea[] = [
    {
      name: "style_kit",
      score: completion.score,
      passed: completion.can_activate,
      detail: completion.can_activate
        ? `Style kit activable (score: ${completion.score}/100).`
        : `Style kit incomplet (score: ${completion.score}/100). Sections vides: ${completion.empty_sections.join(", ")}.`,
    },
    {
      name: "legal_config",
      score: styleKit.legal.never_claim_legal_finality ? 100 : 0,
      passed: styleKit.legal.never_claim_legal_finality,
      detail: styleKit.legal.never_claim_legal_finality
        ? "Configuration légale conforme."
        : "never_claim_legal_finality doit être true.",
    },
    {
      name: "reference_sources",
      score: coverage.total >= 3 ? 100 : Math.round((coverage.total / 3) * 100),
      passed: coverage.total >= 1,
      detail: coverage.total === 0
        ? "Aucune source de référence importée."
        : `${coverage.total} source(s) de référence disponible(s).`,
    },
    {
      name: "template_registry",
      score: registryResult.valid ? 100 : 0,
      passed: registryResult.valid,
      detail: registryResult.valid
        ? `${registryResult.template_count} templates B45 valides.`
        : `${registryResult.total_errors} erreur(s) dans le registre.`,
    },
    {
      name: "visual_identity",
      score: (styleKit.visual_identity.brand_mark_text || styleKit.visual_identity.brand_asset_url) ? 80 : 20,
      passed: !!(styleKit.visual_identity.brand_mark_text || styleKit.visual_identity.brand_asset_url),
      detail: (styleKit.visual_identity.brand_mark_text || styleKit.visual_identity.brand_asset_url)
        ? "Identité visuelle configurée."
        : "Aucune identité visuelle configurée.",
    },
  ];

  const overall_score = Math.round(
    areas.reduce((sum, a) => sum + a.score, 0) / areas.length,
  );

  const blocking_issues: string[] = [];
  if (!styleKit.legal.never_claim_legal_finality) {
    blocking_issues.push("never_claim_legal_finality doit être true.");
  }
  if (!registryResult.valid) {
    blocking_issues.push(`Registre templates invalide: ${registryResult.total_errors} erreur(s).`);
  }

  const recommendations: string[] = [...completion.warnings];
  if (coverage.total === 0) {
    recommendations.push("Importer au moins un document de référence (bulletin, attestation).");
  }
  if (!styleKit.signature.enabled) {
    recommendations.push("Activer le bloc de signature pour documents officiels.");
  }

  let level: DocumentStyleVerdict["level"];
  if (blocking_issues.length > 0) level = "not_ready";
  else if (overall_score < 40) level = "basic";
  else if (overall_score < 60) level = "standard";
  else if (overall_score < 80) level = "premium";
  else level = "certified";

  return {
    overall_score,
    level,
    areas,
    blocking_issues,
    recommendations,
    template_registry_valid: registryResult.valid,
    style_kit_can_activate: completion.can_activate,
    reference_sources_premium: coverage.premium_complete,
    safe_to_generate_official:
      blocking_issues.length === 0 &&
      styleKit.legal.require_human_validation_for_official,
  };
}
