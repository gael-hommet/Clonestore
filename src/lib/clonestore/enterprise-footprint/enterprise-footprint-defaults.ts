// src/lib/clonestore/enterprise-footprint/enterprise-footprint-defaults.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Defaults

import type {
  EnterpriseFootprint,
  EnterpriseFootprintCompanyIdentity,
  EnterpriseFootprintCloneADNSummary,
  EnterpriseFootprintReadinessScore,
} from "./enterprise-footprint-types";

// ── Clé localStorage ──────────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY =
  "clonestore.enterpriseFootprint.snapshot.v1" as const;

// ── Company identity vide ─────────────────────────────────────────────────────

export function buildDefaultEnterpriseFootprintCompanyIdentity(): EnterpriseFootprintCompanyIdentity {
  return {
    company_name: "",
    industry: "",
    size_range: "",
    country: "FR",
    language: "fr",
    timezone: "Europe/Paris",
    description: "",
  };
}

// ── CloneADN summary vide ─────────────────────────────────────────────────────

function buildDefaultCloneADNSummary(): EnterpriseFootprintCloneADNSummary {
  return {
    tone: null,
    operating_rules_count: 0,
    approval_rules_count: 0,
    humans_count: 0,
    documents_count: 0,
    technologies_count: 0,
    coverage_score: 0,
    warnings: [],
  };
}

// ── Readiness score vide ──────────────────────────────────────────────────────

export function buildEnterpriseFootprintReadinessScore(
  options: {
    has_company_identity?: boolean;
    has_approvers?: boolean;
    has_approval_rules?: boolean;
    has_documents?: boolean;
    has_first_mission?: boolean;
  } = {}
): EnterpriseFootprintReadinessScore {
  const {
    has_company_identity = false,
    has_approvers = false,
    has_approval_rules = false,
    has_documents = false,
    has_first_mission = false,
  } = options;

  // Pondération : identité 30%, approbateurs 20%, règles 20%, docs 15%, mission 15%
  let score = 0;
  if (has_company_identity) score += 30;
  if (has_approvers) score += 20;
  if (has_approval_rules) score += 20;
  if (has_documents) score += 15;
  if (has_first_mission) score += 15;

  let level: EnterpriseFootprintReadinessScore["level"];
  if (score >= 90) level = "complete";
  else if (score >= 60) level = "high";
  else if (score >= 30) level = "medium";
  else level = "low";

  const details: string[] = [];
  if (!has_company_identity) details.push("Identité entreprise manquante");
  if (!has_approvers) details.push("Aucun approbateur défini");
  if (!has_approval_rules) details.push("Aucune règle d'approbation");
  if (!has_documents) details.push("Aucun document référencé");
  if (!has_first_mission) details.push("Première mission Pierre non définie");

  return {
    score,
    level,
    has_company_identity,
    has_approvers,
    has_approval_rules,
    has_documents,
    has_first_mission,
    details,
  };
}

// ── Empreinte vide ────────────────────────────────────────────────────────────

export function buildEmptyEnterpriseFootprint(
  companyId = "local_company"
): EnterpriseFootprint {
  const now = new Date().toISOString();
  return {
    id: `footprint:${Date.now()}`,
    company_id: companyId,
    status: "draft",
    source: "onboarding_local",
    company: buildDefaultEnterpriseFootprintCompanyIdentity(),
    humans: [],
    approval_rules: [],
    documents: [],
    technologies: [],
    cloneadn_summary: buildDefaultCloneADNSummary(),
    coverage_score: 0,
    readiness_score: buildEnterpriseFootprintReadinessScore(),
    missing_items: [
      "Identité entreprise manquante",
      "Aucun approbateur défini",
      "Aucune règle d'approbation",
    ],
    warnings: [],
    created_at: now,
    updated_at: now,
    read_only: false,
    metadata: {
      persistence_mode: "localstorage_only",
      phase: "3.8",
    },
  };
}

// ── Empreinte démo ────────────────────────────────────────────────────────────
// Données fictives clairement identifiées — jamais une vraie entreprise.

export function buildDemoEnterpriseFootprint(): EnterpriseFootprint {
  const now = new Date("2026-06-01T10:00:00Z").toISOString();
  return {
    id: "demo:footprint",
    company_id: "demo_company",
    status: "ready",
    source: "demo",
    company: {
      company_name: "Demo Entreprise SA",
      industry: "tech",
      size_range: "11-50",
      country: "FR",
      language: "fr",
      timezone: "Europe/Paris",
      description: "Entreprise de démonstration — données fictives. Non réelle.",
    },
    humans: [
      {
        id: "demo_human_1",
        full_name: "Marie Martin",
        role_title: "DRH",
        department: "Ressources Humaines",
        is_approver: true,
        validation_scope: ["hr", "legal"],
      },
    ],
    approval_rules: [
      {
        id: "demo_rule_1",
        title: "Validation humaine pour tout email externe",
        domain: "hr",
        risk_level: "high",
        requires_validation: true,
        description: "Pierre demande validation avant envoi externe.",
      },
    ],
    documents: [
      {
        id: "demo_doc_1",
        title: "Modèle contrat CDI",
        document_type: "contract",
        status: "planned",
        applies_to_domains: ["hr", "legal"],
        is_official: true,
      },
    ],
    technologies: [],
    cloneadn_summary: {
      tone: "formal",
      operating_rules_count: 1,
      approval_rules_count: 1,
      humans_count: 1,
      documents_count: 1,
      technologies_count: 0,
      coverage_score: 55,
      warnings: ["Technologies non configurées"],
    },
    coverage_score: 55,
    readiness_score: buildEnterpriseFootprintReadinessScore({
      has_company_identity: true,
      has_approvers: true,
      has_approval_rules: true,
      has_documents: true,
      has_first_mission: false,
    }),
    missing_items: ["Première mission Pierre non définie"],
    warnings: ["Technologies non configurées"],
    created_at: now,
    updated_at: now,
    read_only: false,
    metadata: {
      persistence_mode: "localstorage_only",
      is_demo: true,
      phase: "3.8",
    },
  };
}
