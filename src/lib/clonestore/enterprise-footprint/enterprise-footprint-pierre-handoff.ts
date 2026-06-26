// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-handoff.ts
// PHASE 3.9 — Empreinte Entreprise Cockpit Integration — Pierre Handoff Design
//
// Prépare la future lecture par Pierre sans modifier le moteur Pierre.
// Ce fichier est un design-only pour PHASE 3.9.
// Pierre sera branché sur ce contexte en PHASE 3.10+.
//
// INVARIANTS ABSOLUS :
//   - Ne pas importer src/lib/pierre/**
//   - Ne pas modifier le moteur Pierre
//   - Ne pas exécuter de mission
//   - Ne pas envoyer d'email
//   - Design-only en PHASE 3.9
//   - Aucun appel réseau, aucun write DB

import type { EnterpriseFootprint } from "./enterprise-footprint-types";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Niveau de risque perçu par Pierre depuis l'empreinte. */
export type PierreEnterpriseFootprintContextRisk =
  | "low"           // empreinte complète, règles définies
  | "medium"        // approbateurs ou règles manquants
  | "high"          // pas de règles d'approbation
  | "unknown";      // empreinte vide ou insuffisante

/** Readiness vu par Pierre. */
export type PierreEnterpriseFootprintContextReadiness =
  | "can_operate"           // peut opérer normalement
  | "can_operate_limited"   // peut opérer avec limitations
  | "requires_setup"        // besoin de configuration
  | "not_ready";            // empreinte insuffisante

/** Contexte compact de l'Empreinte Entreprise destiné à Pierre. */
export type PierreEnterpriseFootprintContext = {
  // Identité entreprise
  company_name: string;
  industry: string;
  language: string;
  timezone: string;

  // Humains et approbateurs
  approvers: Array<{
    id: string;
    full_name: string;
    role_title: string;
    validation_scope: string[];
  }>;

  // Règles d'approbation pertinentes pour les actions HR
  approval_rules: Array<{
    id: string;
    title: string;
    domain: string;
    risk_level: string;
    requires_validation: boolean;
  }>;

  // Documents de référence HR
  document_references: Array<{
    id: string;
    title: string;
    document_type: string;
    is_official: boolean;
  }>;

  // État de l'empreinte
  missing_items: string[];
  warnings: string[];
  readiness_score: number;

  // Décisions opérationnelles pré-calculées
  can_operate_hr_basic: boolean;          // true si approbateurs + règles ok
  requires_human_validation: boolean;    // true si rules avec requires_validation
  risk: PierreEnterpriseFootprintContextRisk;
  readiness: PierreEnterpriseFootprintContextReadiness;

  // Métadonnées
  source: string;
  built_at: string;
  phase: "3.9";
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildPierreEnterpriseFootprintContext(
  footprint: EnterpriseFootprint
): PierreEnterpriseFootprintContext {
  const approvers = footprint.humans
    .filter((h) => h.is_approver)
    .map((h) => ({
      id: h.id,
      full_name: h.full_name,
      role_title: h.role_title,
      validation_scope: h.validation_scope,
    }));

  const hrApprovalRules = footprint.approval_rules
    .filter((r) => r.domain === "hr" || r.requires_validation)
    .map((r) => ({
      id: r.id,
      title: r.title,
      domain: r.domain,
      risk_level: r.risk_level,
      requires_validation: r.requires_validation,
    }));

  const hrDocuments = footprint.documents
    .filter((d) => d.applies_to_domains.includes("hr") || d.is_official)
    .slice(0, 5)  // Limiter le contexte
    .map((d) => ({
      id: d.id,
      title: d.title,
      document_type: d.document_type,
      is_official: d.is_official,
    }));

  const hasApprovers = approvers.length > 0;
  const hasApprovalRules = hrApprovalRules.length > 0;
  const requiresHumanValidation = hrApprovalRules.some((r) => r.requires_validation);
  const canOperateHrBasic = hasApprovers && hasApprovalRules;

  // Calcul du risque perçu
  let risk: PierreEnterpriseFootprintContextRisk;
  if (footprint.company_id === "local_company" && footprint.humans.length === 0) {
    risk = "unknown";
  } else if (!hasApprovalRules) {
    risk = "high";
  } else if (!hasApprovers) {
    risk = "medium";
  } else {
    risk = "low";
  }

  // Readiness opérationnelle
  let readiness: PierreEnterpriseFootprintContextReadiness;
  if (footprint.readiness_score.score >= 85 && canOperateHrBasic) {
    readiness = "can_operate";
  } else if (footprint.readiness_score.score >= 50 || canOperateHrBasic) {
    readiness = "can_operate_limited";
  } else if (footprint.readiness_score.score >= 20) {
    readiness = "requires_setup";
  } else {
    readiness = "not_ready";
  }

  return {
    company_name: footprint.company.company_name || "Entreprise non configurée",
    industry: footprint.company.industry || "non renseigné",
    language: footprint.company.language || "fr",
    timezone: footprint.company.timezone || "Europe/Paris",
    approvers,
    approval_rules: hrApprovalRules,
    document_references: hrDocuments,
    missing_items: footprint.missing_items,
    warnings: footprint.warnings,
    readiness_score: footprint.readiness_score.score,
    can_operate_hr_basic: canOperateHrBasic,
    requires_human_validation: requiresHumanValidation,
    risk,
    readiness,
    source: footprint.source,
    built_at: new Date().toISOString(),
    phase: "3.9",
  };
}

export function summarizePierreEnterpriseFootprintContext(
  context: PierreEnterpriseFootprintContext
): string {
  const lines = [
    `[Pierre Context] Entreprise : ${context.company_name}`,
    `[Pierre Context] Readiness : ${context.readiness_score}% (${context.readiness})`,
    `[Pierre Context] Risque : ${context.risk}`,
    `[Pierre Context] Approbateurs : ${context.approvers.length}`,
    `[Pierre Context] Règles HR : ${context.approval_rules.length}`,
    `[Pierre Context] Validation humaine requise : ${context.requires_human_validation ? "OUI" : "NON"}`,
    `[Pierre Context] Peut opérer HR basique : ${context.can_operate_hr_basic ? "OUI" : "NON (setup requis)"}`,
  ];
  if (context.missing_items.length > 0) {
    lines.push(`[Pierre Context] Manquants : ${context.missing_items[0]}${context.missing_items.length > 1 ? ` (+${context.missing_items.length - 1})` : ""}`);
  }
  return lines.join("\n");
}

export function validatePierreEnterpriseFootprintContext(
  context: PierreEnterpriseFootprintContext
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!context.company_name) {
    issues.push("company_name manquant");
  }
  if (!context.language) {
    issues.push("language manquant");
  }
  if (context.risk === "unknown") {
    issues.push("Empreinte insuffisante pour opérer");
  }
  if (context.readiness === "not_ready") {
    issues.push("Empreinte non prête — configuration requise avant utilisation");
  }
  if (context.requires_human_validation && context.approvers.length === 0) {
    issues.push("Validation humaine requise mais aucun approbateur défini");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
