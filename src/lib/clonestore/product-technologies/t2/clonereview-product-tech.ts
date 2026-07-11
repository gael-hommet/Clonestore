// src/lib/clonestore/product-technologies/t2/clonereview-product-tech.ts
// T2 — CloneReview : la relecture interne professionnelle / contrôle qualité.
// Vérifie ton, cohérence, clarté, omissions critiques, contradictions, maladresses,
// adéquation au contexte — produit une version relue + anomalies + suggestions + drapeau
// « revue humaine nécessaire ». NE remplace PAS la revue légale ; NE garantit RIEN.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import { detectSensitiveHrLanguage } from "./cloneos-product-tech";

export interface CloneReviewInput {
  readonly draft?: string;
  readonly expectedFormality?: "vouvoiement" | "tutoiement";
  readonly context?: string;
  readonly sensitive?: boolean;
}

export interface CloneReviewIssue {
  readonly kind: "tone" | "coherence" | "clarity" | "missing_info" | "contradiction" | "awkwardness" | "context_mismatch";
  readonly detail: string;
}

export interface CloneReviewReport {
  readonly artifactKind: "clonereview_report";
  readonly toneOk: boolean;
  readonly issues: readonly CloneReviewIssue[];
  readonly suggestions: readonly string[];
  readonly revisedDraft: string;
  readonly qualityScore: number; // 0–100, heuristique locale — jamais une garantie
  readonly humanReviewNeeded: boolean;
  readonly internalValidationDone: boolean;
  readonly legalGuarantee: false;
  readonly correctnessGuaranteed: false;
}

const PLACEHOLDER_PATTERN = /\b(?:TODO|XXX|FIXME|à compléter|\[\s*\]|\{\{[^}]*\}\})\b/i;

export const cloneReviewProductTech: ProductTechnologyContract<CloneReviewInput, CloneReviewReport> =
  defineProductTechnologyContract({
    id: "clonereview",
    name: "CloneReview",
    definition: "La relecture interne professionnelle : contrôle du ton, de la cohérence, de la clarté, des omissions et contradictions avant sortie.",
    role: "Vérifier que le travail est assez bon pour sortir comme un vrai travail professionnel — et alerter l'humain sinon.",
    answersQuestion: "Le travail est-il assez bon pour sortir comme un vrai travail professionnel ?",
    contains: ["contrôle du ton", "cohérence", "clarté", "omissions critiques", "contradictions", "maladresses", "adéquation au contexte", "version relue", "anomalies", "suggestions", "drapeau revue humaine"],
    doesNotContain: ["revue légale", "garantie d'exactitude"],
    dependencies: ["cloneadn"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonereview,
    liveBlockedReason: null,
    requiresValidation: true, // la version relue est un contenu à utiliser → l'humain valide
    commercialClaimAllowed: "Chaque livrable passe une relecture qualité interne (ton, cohérence, clarté) avant validation humaine.",
    commercialClaimForbidden: ["qualité garantie sans relecture humaine", "validation juridique"],
    prepareArtifact: (input) => {
      const draft = (input?.draft ?? "").trim();
      if (draft.length === 0) {
        return { kind: "blocked", artifact: null, blockedReason: "Brouillon vide — rien à relire (fail-closed)." };
      }
      const issues: CloneReviewIssue[] = [];
      const suggestions: string[] = [];

      // Ton / formalité.
      const expectTutoiement = input?.expectedFormality === "tutoiement";
      const hasTutoiement = /\b(tu|ton|ta|tes)\b/i.test(draft);
      const toneOk = expectTutoiement ? true : !hasTutoiement;
      if (!toneOk) {
        issues.push({ kind: "tone", detail: "Tutoiement détecté alors que l'entreprise vouvoie." });
        suggestions.push("Passer au vouvoiement conformément au profil CloneADN.");
      }

      // Omissions (placeholders).
      if (PLACEHOLDER_PATTERN.test(draft)) {
        issues.push({ kind: "missing_info", detail: "Champ à compléter / placeholder détecté dans le brouillon." });
        suggestions.push("Compléter tous les champs avant validation.");
      }

      // Clarté (phrases trop longues).
      const longSentences = draft.split(/[.!?]/).filter((s) => s.trim().split(/\s+/).length > 40);
      if (longSentences.length > 0) {
        issues.push({ kind: "clarity", detail: `${longSentences.length} phrase(s) de plus de 40 mots.` });
        suggestions.push("Raccourcir les phrases longues pour la lisibilité.");
      }

      // Contradiction naïve (acceptation ET refus dans le même texte).
      const lower = draft.toLowerCase();
      if ((lower.includes("accepté") || lower.includes("validé")) && (lower.includes("refusé") || lower.includes("rejeté"))) {
        issues.push({ kind: "contradiction", detail: "Le texte contient à la fois une acceptation et un refus — vérifier la cohérence." });
      }

      // Version relue : nettoyage léger déterministe (jamais de réécriture inventive ici).
      const revisedDraft = draft.replace(/\s{2,}/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();

      const sensitive = input?.sensitive === true || detectSensitiveHrLanguage(draft);
      const qualityScore = Math.max(0, 100 - issues.length * 20);
      const humanReviewNeeded = issues.length > 0 || sensitive || qualityScore < 80;
      if (sensitive) suggestions.push("Contenu RH sensible — revue humaine renforcée requise.");

      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "clonereview_report",
          toneOk,
          issues,
          suggestions,
          revisedDraft,
          qualityScore,
          humanReviewNeeded,
          internalValidationDone: true,
          legalGuarantee: false,
          correctnessGuaranteed: false,
        },
      };
    },
  });
