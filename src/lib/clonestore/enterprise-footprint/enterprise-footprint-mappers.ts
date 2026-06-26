// src/lib/clonestore/enterprise-footprint/enterprise-footprint-mappers.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Mappers
//
// Transforme GlobalOnboardingDraft ↔ EnterpriseFootprint ↔ GlobalEnterpriseMemory.
//
// Flux :
//   GlobalOnboardingDraft
//     → mapGlobalOnboardingDraftToEnterpriseFootprint
//     → EnterpriseFootprint
//     → mapEnterpriseFootprintToGlobalEnterpriseMemory
//     → GlobalEnterpriseMemory (CloneADN)
//
// Invariants :
//   - mapping prudent — jamais de perte de données
//   - metadata toujours redacté avant persistence
//   - email des humains non inclus par défaut
//   - jamais de write dans ces mappers

import type {
  EnterpriseFootprint,
  EnterpriseFootprintCompanyIdentity,
  EnterpriseFootprintHumanRole,
  EnterpriseFootprintApprovalRule,
  EnterpriseFootprintDocumentReference,
  EnterpriseFootprintTechnologyStatus,
  EnterpriseFootprintCloneADNSummary,
  EnterpriseFootprintReadinessScore,
} from "./enterprise-footprint-types";
import { ENTERPRISE_FOOTPRINT_REDACT_KEYS } from "./enterprise-footprint-types";
import {
  buildEmptyEnterpriseFootprint,
  buildEnterpriseFootprintReadinessScore,
} from "./enterprise-footprint-defaults";

// ── Imports CloneADN TECH-05 ──────────────────────────────────────────────────
import type {
  GlobalEnterpriseMemory,
  EnterpriseIdentityProfile,
  EnterpriseHumanProfile,
  EnterpriseDocumentProfile,
  EnterpriseRuleProfile,
} from "@/lib/clonestore/adn";
import {
  buildEmptyGlobalEnterpriseMemory,
  computeCoverageScore,
  validateGlobalEnterpriseMemory,
} from "@/lib/clonestore/adn";

// ── Imports onboarding ────────────────────────────────────────────────────────
import type { GlobalOnboardingDraft } from "@/lib/clonestore/onboarding";
import {
  mapGlobalOnboardingDraftToEnterpriseMemory,
} from "@/lib/clonestore/onboarding";

// ── Redaction metadata ────────────────────────────────────────────────────────

export function redactEnterpriseFootprintMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    const isSensitive = ENTERPRISE_FOOTPRINT_REDACT_KEYS.some((k) =>
      lower.includes(k.toLowerCase())
    );
    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      result[key] = value.slice(0, 500) + "…";
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Calcul readiness ──────────────────────────────────────────────────────────

export function computeEnterpriseFootprintReadiness(
  footprint: Pick<EnterpriseFootprint, "company" | "humans" | "approval_rules" | "documents" | "technologies">
  & { first_mission_defined?: boolean }
): EnterpriseFootprintReadinessScore {
  const hasCompany = !!(
    footprint.company.company_name &&
    footprint.company.industry &&
    footprint.company.size_range
  );
  const hasApprovers = footprint.humans.some((h) => h.is_approver);
  const hasRules = footprint.approval_rules.length > 0;
  const hasDocuments = footprint.documents.length > 0;
  const hasMission = footprint.first_mission_defined ?? false;

  return buildEnterpriseFootprintReadinessScore({
    has_company_identity: hasCompany,
    has_approvers: hasApprovers,
    has_approval_rules: hasRules,
    has_documents: hasDocuments,
    has_first_mission: hasMission,
  });
}

// ── Calcul missing items ──────────────────────────────────────────────────────

export function computeEnterpriseFootprintMissingItems(
  footprint: EnterpriseFootprint
): string[] {
  const missing: string[] = [];
  if (!footprint.company.company_name) missing.push("Nom de l'entreprise manquant");
  if (!footprint.company.industry) missing.push("Secteur non renseigné");
  if (!footprint.company.size_range) missing.push("Taille entreprise non renseignée");
  if (footprint.humans.length === 0) missing.push("Aucun humain défini");
  if (!footprint.humans.some((h) => h.is_approver)) missing.push("Aucun approbateur défini");
  if (footprint.approval_rules.length === 0) missing.push("Aucune règle de validation");
  if (footprint.documents.length === 0) missing.push("Aucun document référencé");
  return missing;
}

// ── Résumé ────────────────────────────────────────────────────────────────────

export function summarizeEnterpriseFootprint(footprint: EnterpriseFootprint): string {
  const company = footprint.company.company_name || "Entreprise non renseignée";
  const score = footprint.coverage_score;
  const readiness = footprint.readiness_score.score;
  const missing = footprint.missing_items.length;
  return (
    `${company} — Couverture ${score}% — Readiness ${readiness}% — ` +
    `${footprint.humans.length} humain(s) — ` +
    `${footprint.approval_rules.length} règle(s) — ` +
    `${missing} élément(s) manquant(s)`
  );
}

// ── GlobalOnboardingDraft → EnterpriseFootprint ───────────────────────────────

export function mapGlobalOnboardingDraftToEnterpriseFootprint(
  draft: GlobalOnboardingDraft
): EnterpriseFootprint {
  const base = buildEmptyEnterpriseFootprint(draft.company_id);
  const now = new Date().toISOString();

  // Company identity
  const company: EnterpriseFootprintCompanyIdentity = {
    company_name: draft.company.company_name ?? "",
    industry: draft.company.industry ?? "",
    size_range: draft.company.size_range ?? "",
    country: draft.company.country ?? "FR",
    language: draft.company.language ?? "fr",
    timezone: draft.company.timezone ?? "Europe/Paris",
    description: draft.company.description ?? "",
  };

  // Humans (sans email — PII)
  const humans: EnterpriseFootprintHumanRole[] = draft.humans.map((h) => ({
    id: h.id,
    full_name: h.full_name,
    role_title: h.role_title ?? "",
    department: h.department ?? "",
    is_approver: h.is_approver,
    validation_scope: h.validation_scope ?? [],
  }));

  // Approval rules
  const approvalRules: EnterpriseFootprintApprovalRule[] = draft.rules.map((r) => ({
    id: r.id,
    title: r.title,
    domain: r.domain,
    risk_level: r.risk_level,
    requires_validation: r.requires_validation,
    description: r.description ?? "",
  }));

  // Documents
  const documents: EnterpriseFootprintDocumentReference[] = draft.documents.map((d) => ({
    id: d.id,
    title: d.title,
    document_type: d.document_type,
    status: d.status,
    applies_to_domains: d.applies_to_domains ?? [],
    is_official: d.is_official,
  }));

  // Technologies
  const technologies: EnterpriseFootprintTechnologyStatus[] = draft.technologies.map((t) => ({
    key: t.key,
    label: t.display_name,
    status: t.status === "active" ? "active" : t.status === "partial" ? "partial" : "roadmap",
    readiness: t.readiness_score ?? 0,
    is_locked: false,
    is_configurable: true,
  }));

  // Compute readiness
  const readiness = computeEnterpriseFootprintReadiness({
    company,
    humans,
    approval_rules: approvalRules,
    documents,
    technologies,
    first_mission_defined: draft.first_mission !== null,
  });

  // Compute CloneADN summary via memory mapper
  let cloneadnSummary: EnterpriseFootprintCloneADNSummary = {
    tone: null,
    operating_rules_count: approvalRules.length,
    approval_rules_count: approvalRules.filter((r) => r.requires_validation).length,
    humans_count: humans.length,
    documents_count: documents.length,
    technologies_count: technologies.length,
    coverage_score: draft.completion_score,
    warnings: [],
  };

  let coverageScore = draft.completion_score;

  try {
    const memory = mapGlobalOnboardingDraftToEnterpriseMemory(draft);
    const validation = validateGlobalEnterpriseMemory(memory);
    const computedScore = computeCoverageScore(memory);
    coverageScore = computedScore;
    cloneadnSummary = {
      ...cloneadnSummary,
      coverage_score: computedScore,
      warnings: validation.warnings?.map((w) => w.message) ?? [],
    };
  } catch {
    /* Silent fail — mapping best-effort */
  }

  // Missing items
  const partialFootprint = { company, humans, approval_rules: approvalRules, documents, technologies };
  const missingItems = computeEnterpriseFootprintMissingItems({
    ...base,
    ...partialFootprint,
    cloneadn_summary: cloneadnSummary,
    coverage_score: coverageScore,
    readiness_score: readiness,
    missing_items: [],
    warnings: cloneadnSummary.warnings,
  });

  // Status
  let status: EnterpriseFootprint["status"] = "draft";
  if (readiness.score >= 85) status = "ready";
  else if (readiness.score >= 50) status = "incomplete";
  else status = "draft";

  return {
    id: `footprint:${draft.id}`,
    user_id: draft.user_id,
    company_id: draft.company_id,
    status,
    source: draft.source === "server" ? "onboarding_server" : "onboarding_local",
    company,
    humans,
    approval_rules: approvalRules,
    documents,
    technologies,
    cloneadn_summary: cloneadnSummary,
    coverage_score: coverageScore,
    readiness_score: readiness,
    missing_items: missingItems,
    warnings: cloneadnSummary.warnings,
    created_at: draft.created_at ?? now,
    updated_at: draft.updated_at ?? now,
    read_only: draft.read_only ?? false,
    metadata: redactEnterpriseFootprintMetadata(draft.metadata ?? {}),
  };
}

// ── EnterpriseFootprint → GlobalOnboardingDraft (partiel) ────────────────────

export function mapEnterpriseFootprintToGlobalOnboardingDraft(
  footprint: EnterpriseFootprint
): Partial<GlobalOnboardingDraft> {
  return {
    company_id: footprint.company_id,
    company: {
      company_name: footprint.company.company_name,
      industry: footprint.company.industry,
      size_range: footprint.company.size_range,
      country: footprint.company.country,
      language: footprint.company.language,
      timezone: footprint.company.timezone,
      description: footprint.company.description,
    },
    humans: footprint.humans.map((h) => ({
      id: h.id,
      full_name: h.full_name,
      role_title: h.role_title,
      department: h.department,
      is_approver: h.is_approver,
      validation_scope: h.validation_scope,
    })),
    documents: footprint.documents.map((d) => ({
      id: d.id,
      title: d.title,
      document_type: d.document_type,
      is_official: d.is_official,
      applies_to_domains: d.applies_to_domains,
      status: d.status,
    })),
    rules: footprint.approval_rules.map((r) => ({
      id: r.id,
      title: r.title,
      domain: r.domain,
      risk_level: r.risk_level,
      requires_validation: r.requires_validation,
      description: r.description,
    })),
  };
}

// ── EnterpriseFootprint → GlobalEnterpriseMemory ──────────────────────────────

export function mapEnterpriseFootprintToGlobalEnterpriseMemory(
  footprint: EnterpriseFootprint
): GlobalEnterpriseMemory {
  const base = buildEmptyGlobalEnterpriseMemory(footprint.company_id);

  const identity: EnterpriseIdentityProfile = {
    ...base.identity,
    company_name: footprint.company.company_name || "Entreprise (non renseignée)",
    industry: footprint.company.industry || null,
    size_range: footprint.company.size_range || null,
    country: (footprint.company.country || "FR") as EnterpriseIdentityProfile["country"],
    language: (footprint.company.language || "fr") as EnterpriseIdentityProfile["language"],
    timezone: footprint.company.timezone || "Europe/Paris",
    public_description: footprint.company.description || null,
  };

  const humans: EnterpriseHumanProfile[] = footprint.humans.map((h) => ({
    human_id: h.id,
    full_name: h.full_name,
    role_title: h.role_title || null,
    department_id: h.department || null,
    employment_status: "active" as const,
    email: null,    // PII — ne pas inclure
    phone: null,
    permissions: h.is_approver
      ? ["approve_actions", ...h.validation_scope]
      : h.validation_scope,
    sensitive_notes_allowed: false,
    context_notes: null,
    document_refs: [],
    tags: h.validation_scope,
  }));

  const documents: EnterpriseDocumentProfile[] = footprint.documents.map((d) => {
    const validTypes = ["template", "policy", "contract", "guide", "procedure"] as const;
    type DocType = typeof validTypes[number];
    const docType: DocType = validTypes.includes(d.document_type as DocType)
      ? (d.document_type as DocType)
      : "template";
    return {
      document_id: d.id,
      title: d.title,
      document_type: docType,
      source: "enterprise_footprint",
      file_ref: null,
      applies_to_domains: d.applies_to_domains,
      is_official: d.is_official,
      version: "1.0",
      style_notes: null,
      extraction_status: "not_extracted" as const,
      sensitivity: d.is_official ? "confidential" as const : "internal" as const,
    };
  });

  const rules: EnterpriseRuleProfile[] = footprint.approval_rules.map((r) => {
    type Severity = EnterpriseRuleProfile["severity"];
    const severityMap: Record<string, Severity> = {
      critical: "critical",
      high: "block",
      medium: "warning",
      low: "info",
    };
    return {
      rule_id: r.id,
      label: r.title,
      category: r.domain,
      condition: r.description || r.title,
      action: r.requires_validation ? "require_human_validation" : "allow_with_notice",
      severity: severityMap[r.risk_level] ?? "info",
      active: true,
      applies_to_domains: [r.domain],
      applies_to_employee_slugs: ["pierre"],
    };
  });

  return {
    ...base,
    identity,
    humans: {
      ...base.humans,
      humans,
      total_count: humans.length,
      active_count: humans.length,
    },
    documents,
    rules,
  };
}

// ── GlobalEnterpriseMemory → EnterpriseFootprint ──────────────────────────────

export function mapGlobalEnterpriseMemoryToEnterpriseFootprint(
  memory: GlobalEnterpriseMemory,
  options: { companyId?: string } = {}
): EnterpriseFootprint {
  const companyId = options.companyId ?? memory.identity.company_name ?? "unknown";
  const base = buildEmptyEnterpriseFootprint(companyId);
  const now = new Date().toISOString();

  const company: EnterpriseFootprintCompanyIdentity = {
    company_name: memory.identity.company_name ?? "",
    industry: memory.identity.industry ?? "",
    size_range: memory.identity.size_range ?? "",
    country: memory.identity.country ?? "FR",
    language: memory.identity.language ?? "fr",
    timezone: memory.identity.timezone ?? "Europe/Paris",
    description: memory.identity.public_description ?? "",
  };

  const humans: EnterpriseFootprintHumanRole[] = memory.humans.humans.map((h) => ({
    id: h.human_id,
    full_name: h.full_name,
    role_title: h.role_title ?? "",
    department: h.department_id ?? "",
    is_approver: h.permissions?.includes("approve_actions") ?? false,
    validation_scope: h.permissions?.filter((p) => p !== "approve_actions") ?? [],
  }));

  const approvalRules: EnterpriseFootprintApprovalRule[] = memory.rules.map((r) => ({
    id: r.rule_id,
    title: r.label,
    domain: r.category,
    risk_level: (r.severity === "critical" ? "critical"
      : r.severity === "block" ? "high"
      : r.severity === "warning" ? "medium"
      : "low") as EnterpriseFootprintApprovalRule["risk_level"],
    requires_validation: r.action === "require_human_validation",
    description: r.condition ?? "",
  }));

  const documents: EnterpriseFootprintDocumentReference[] = memory.documents.map((d) => ({
    id: d.document_id,
    title: d.title,
    document_type: d.document_type,
    status: "planned",
    applies_to_domains: d.applies_to_domains ?? [],
    is_official: d.is_official,
  }));

  const coverageScore = computeCoverageScore(memory);
  const validation = validateGlobalEnterpriseMemory(memory);

  const readiness = computeEnterpriseFootprintReadiness({
    company,
    humans,
    approval_rules: approvalRules,
    documents,
    technologies: [],
  });

  const cloneadnSummary: EnterpriseFootprintCloneADNSummary = {
    tone: memory.tone?.default_tone ?? null,
    operating_rules_count: memory.rules?.length ?? 0,
    approval_rules_count: approvalRules.filter((r) => r.requires_validation).length,
    humans_count: humans.length,
    documents_count: documents.length,
    technologies_count: 0,
    coverage_score: coverageScore,
    warnings: validation.warnings?.map((w) => w.message) ?? [],
  };

  const missingItems = computeEnterpriseFootprintMissingItems({
    ...base,
    company,
    humans,
    approval_rules: approvalRules,
    documents,
    technologies: [],
    cloneadn_summary: cloneadnSummary,
    coverage_score: coverageScore,
    readiness_score: readiness,
    missing_items: [],
    warnings: cloneadnSummary.warnings,
  });

  return {
    id: `footprint:cloneadn:${companyId}`,
    company_id: companyId,
    status: readiness.score >= 85 ? "ready" : readiness.score >= 50 ? "incomplete" : "draft",
    source: "cloneadn",
    company,
    humans,
    approval_rules: approvalRules,
    documents,
    technologies: [],
    cloneadn_summary: cloneadnSummary,
    coverage_score: coverageScore,
    readiness_score: readiness,
    missing_items: missingItems,
    warnings: cloneadnSummary.warnings,
    created_at: now,
    updated_at: now,
    read_only: false,
    metadata: { persistence_mode: "localstorage_only", phase: "3.8" },
  };
}

// ── Fusion onboarding + CloneADN ──────────────────────────────────────────────
// Combine les données du draft onboarding et de GlobalEnterpriseMemory.
// Préfère les données onboarding (plus récentes) sur les données CloneADN.

export function buildEnterpriseFootprintFromOnboardingAndCloneADN(
  draft: GlobalOnboardingDraft,
  memory: GlobalEnterpriseMemory | null
): EnterpriseFootprint {
  // Base depuis draft onboarding
  const footprint = mapGlobalOnboardingDraftToEnterpriseFootprint(draft);

  // Si pas de mémoire CloneADN, retourner le footprint onboarding
  if (!memory) return footprint;

  // Enrichir avec les données CloneADN si onboarding est incomplet
  const memoryFootprint = mapGlobalEnterpriseMemoryToEnterpriseFootprint(memory, {
    companyId: draft.company_id,
  });

  // Merge : préférer les données onboarding (plus récentes / plus directes)
  return {
    ...footprint,
    // Enrichir warnings avec ceux de CloneADN
    warnings: [
      ...new Set([...footprint.warnings, ...memoryFootprint.warnings]),
    ],
    // Coverage score = max entre les deux sources
    coverage_score: Math.max(footprint.coverage_score, memoryFootprint.coverage_score),
    // CloneADN summary depuis la mémoire (plus précise)
    cloneadn_summary: {
      ...memoryFootprint.cloneadn_summary,
      // Conserver la couverture calculée
      coverage_score: Math.max(
        footprint.cloneadn_summary.coverage_score,
        memoryFootprint.cloneadn_summary.coverage_score
      ),
    },
  };
}
