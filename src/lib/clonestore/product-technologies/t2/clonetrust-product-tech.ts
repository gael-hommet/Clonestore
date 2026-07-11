// src/lib/clonestore/product-technologies/t2/clonetrust-product-tech.ts
// T2 — CloneTrust : autonomie graduelle contrôlée. Décide l'autonomie EFFECTIVE selon :
// type de tâche, risque, politique d'entreprise, historique, niveau de confiance, contexte,
// rôle du demandeur. NE contourne JAMAIS CloneGuard ; n'approuve jamais seul une décision
// critique (critique → human_only, toujours).

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import { capAutonomy, normalizeAutonomyLevel } from "./clonepolicy-product-tech";
import type { AutonomyLevel, RiskLevel } from "./product-technology-types";

// NOTE DOCTRINE : `riskLevel` DOIT provenir d'une décision CloneGuard (câblage orchestrateur) ;
// `history` est asserté par l'appelant à cette couche (le vrai registre arrive en P16C).
// Fail-closed : risque inconnu/malformé → sensible ; cap politique malformé → human_only.
const KNOWN_RISKS: readonly RiskLevel[] = ["normal", "sensitive", "critical"];

export interface CloneTrustInput {
  readonly taskType?: string;
  readonly riskLevel?: RiskLevel;
  readonly history?: { readonly approvals?: number; readonly rejections?: number };
  readonly requesterRole?: string;
  readonly policyCap?: AutonomyLevel;
}

export interface CloneTrustDecision {
  readonly artifactKind: "clonetrust_decision";
  readonly autonomyScore: number; // 0–100
  readonly autonomyLevel: AutonomyLevel;
  readonly reason: string;
  readonly effectivePermissions: readonly string[];
  readonly criticalAlwaysHumanOnly: true;
  readonly overridesCloneGuard: false;
  readonly executed: false;
}

const PERMISSIONS_BY_LEVEL: Readonly<Record<AutonomyLevel, readonly string[]>> = {
  human_only: ["observer"],
  prepare_only: ["préparer des artefacts (aucun envoi)"],
  suggest: ["préparer des artefacts", "proposer des actions"],
  execute_with_validation: ["préparer des artefacts", "proposer des actions", "exécuter APRÈS validation humaine explicite"],
  autonomous_safe: ["préparer des artefacts", "proposer des actions", "exécuter APRÈS validation humaine explicite", "enchaîner des préparations sûres sans re-demander (aucun effet externe)"],
};

export const cloneTrustProductTech: ProductTechnologyContract<CloneTrustInput, CloneTrustDecision> =
  defineProductTechnologyContract({
    id: "clonetrust",
    name: "CloneTrust",
    definition: "L'autonomie graduelle contrôlée : jusqu'où l'employé IA peut agir seul dans CE contexte précis.",
    role: "Calculer l'autonomie effective à partir du type de tâche, du risque, de la politique, de l'historique, de la confiance et du rôle du demandeur.",
    answersQuestion: "Jusqu'où l'employé IA peut-il agir seul dans ce contexte précis ?",
    contains: ["score d'autonomie", "niveau d'autonomie (prepare_only→autonomous_safe)", "raison", "permissions effectives"],
    doesNotContain: ["contournement de CloneGuard", "approbation seule de décisions critiques"],
    dependencies: ["clonepolicy", "cloneguard"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonetrust,
    liveBlockedReason: null,
    requiresValidation: false, // une décision d'autonomie n'est pas un effet
    commercialClaimAllowed: "L'autonomie se gagne progressivement, par contexte et par historique — les décisions sensibles restent toujours humaines.",
    commercialClaimForbidden: ["employé IA totalement autonome", "DRH autonome", "décisions critiques sans humain"],
    prepareArtifact: (input) => {
      // Risque absent OU hors vocabulaire (donnée forgée) → sensible (fail-closed).
      const risk: RiskLevel = KNOWN_RISKS.includes(input?.riskLevel as RiskLevel) ? (input!.riskLevel as RiskLevel) : "sensitive";
      const approvals = Math.max(0, input?.history?.approvals ?? 0);
      const rejections = Math.max(0, input?.history?.rejections ?? 0);
      const total = approvals + rejections;
      const historyScore = total === 0 ? 20 : Math.round((approvals / total) * 100); // sans historique → confiance basse
      const score = risk === "critical" ? 0 : risk === "sensitive" ? Math.min(historyScore, 40) : historyScore;

      let level: AutonomyLevel;
      let reason: string;
      if (risk === "critical") {
        level = "human_only";
        reason = "Risque CRITIQUE → human_only, toujours (jamais d'approbation machine seule).";
      } else if (risk === "sensitive") {
        level = "prepare_only";
        reason = "Risque SENSIBLE → préparation seulement ; tout usage passe par l'humain.";
      } else if (score >= 80 && total >= 10) {
        level = "autonomous_safe";
        reason = `Historique solide (${approvals}/${total} validations) sur des tâches normales → enchaînements de préparations sûres permis (aucun effet externe).`;
      } else if (score >= 60) {
        level = "execute_with_validation";
        reason = "Confiance établie → exécution possible UNIQUEMENT après validation humaine.";
      } else if (score >= 40) {
        level = "suggest";
        reason = "Confiance en construction → suggestions.";
      } else {
        level = "prepare_only";
        reason = "Confiance insuffisante ou historique vide → préparation seulement (défaut sûr).";
      }

      // La politique d'entreprise PLAFONNE toujours (le plus restrictif gagne) ;
      // un cap malformé (donnée) est normalisé fail-closed → human_only.
      const effective = input?.policyCap !== undefined ? capAutonomy(level, normalizeAutonomyLevel(input.policyCap)) : level;
      if (effective !== level) reason += ` Plafonné par la politique d'entreprise à « ${effective} ».`;

      return {
        kind: "ok",
        artifact: {
          artifactKind: "clonetrust_decision",
          autonomyScore: score,
          autonomyLevel: effective,
          reason,
          effectivePermissions: PERMISSIONS_BY_LEVEL[effective],
          criticalAlwaysHumanOnly: true,
          overridesCloneGuard: false,
          executed: false,
        },
      };
    },
  });
