// src/lib/clonestore/onboarding/global-onboarding-mappers.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Mappers
//
// Transforme GlobalOnboardingDraft ↔ GlobalEnterpriseMemory (TECH-05 CloneADN).
// Ces mappers permettent de préparer la mémoire CloneADN depuis le draft onboarding.
//
// Invariants :
//   - mapping prudent — jamais de perte de données existantes
//   - metadata toujours redacté avant persistence
//   - pas d'exécution, pas d'écriture DB

import type {
  GlobalOnboardingDraft,
  GlobalOnboardingCompanyDraft,
} from "./global-onboarding-types";
import { GLOBAL_ONBOARDING_REDACT_KEYS } from "./global-onboarding-types";

// ── Import CloneADN TECH-05 ───────────────────────────────────────────────────
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
  buildGlobalEnterpriseMemorySnapshot,
} from "@/lib/clonestore/adn";

// ── Redaction metadata ────────────────────────────────────────────────────────

export function redactGlobalOnboardingMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    const isSensitive = GLOBAL_ONBOARDING_REDACT_KEYS.some((k) =>
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

// ── Résumé human-lisible ──────────────────────────────────────────────────────

export function summarizeGlobalOnboardingDraft(draft: GlobalOnboardingDraft): string {
  const company = draft.company.company_name || "Entreprise non renseignée";
  const humans = draft.humans.length;
  const docs = draft.documents.length;
  const rules = draft.rules.length;
  const score = draft.completion_score;
  return `${company} — ${score}% complété — ${humans} humain(s) — ${docs} document(s) — ${rules} règle(s) — brouillon local`;
}

// ── Score de complétion ───────────────────────────────────────────────────────

export function computeGlobalOnboardingCompletionScore(
  draft: GlobalOnboardingDraft
): number {
  const weights: Record<string, number> = {
    company_identity: 25,
    team_humans: 20,
    documents: 15,
    rules_validations: 15,
    technologies: 10,
    first_pierre_mission: 15,
  };

  let total = 0;
  let achieved = 0;

  for (const [step, weight] of Object.entries(weights)) {
    total += weight;
    const status = draft.step_statuses[step as keyof typeof draft.step_statuses];
    if (status === "done" || status === "skipped") {
      achieved += weight;
    } else if (status === "in_progress") {
      // Bonus partiel pour les étapes en cours
      if (step === "company_identity" && draft.company.company_name) {
        achieved += weight * 0.5;
      }
    }
  }

  return Math.round((achieved / total) * 100);
}

// ── Mapper Draft → GlobalEnterpriseMemory ─────────────────────────────────────
// Mapping prudent PHASE 3.5 : certains champs sont optionnels dans CloneADN.
// Utiliser les types TECH-05 pour un mapping safe.

function mapCompanyDraftToIdentity(
  company: GlobalOnboardingCompanyDraft,
  companyId: string
): Partial<EnterpriseIdentityProfile> {
  return {
    company_name: company.company_name || "Entreprise (non renseignée)",
    industry: company.industry || null,
    size_range: company.size_range || null,
    country: (company.country || "FR") as EnterpriseIdentityProfile["country"],
    language: (company.language || "fr") as EnterpriseIdentityProfile["language"],
    timezone: company.timezone || "Europe/Paris",
    public_description: company.description || null,
  };
}

export function mapGlobalOnboardingDraftToEnterpriseMemory(
  draft: GlobalOnboardingDraft
): GlobalEnterpriseMemory {
  const base = buildEmptyGlobalEnterpriseMemory(draft.company_id);

  // Mapping identity
  const identity: EnterpriseIdentityProfile = {
    ...base.identity,
    ...mapCompanyDraftToIdentity(draft.company, draft.company_id),
  };

  // Mapping humans
  const humans: EnterpriseHumanProfile[] = draft.humans.map((h) => ({
    human_id: h.id,
    full_name: h.full_name,
    role_title: h.role_title || null,
    department_id: h.department || null,
    employment_status: "active" as const,
    email: null, // PII — ne pas persister email automatiquement
    phone: null,
    permissions: h.is_approver ? ["approve_actions", ...h.validation_scope] : h.validation_scope,
    sensitive_notes_allowed: false,
    context_notes: null,
    document_refs: [],
    tags: h.validation_scope,
  }));

  // Mapping documents
  const documents: EnterpriseDocumentProfile[] = draft.documents.map((d) => {
    const validTypes = ["template", "policy", "contract", "guide", "procedure"] as const;
    type DocType = typeof validTypes[number];
    const docType: DocType = validTypes.includes(d.document_type as DocType)
      ? (d.document_type as DocType)
      : "template";

    return {
      document_id: d.id,
      title: d.title,
      document_type: docType,
      source: "onboarding_draft",
      file_ref: null,
      applies_to_domains: d.applies_to_domains,
      is_official: d.is_official,
      version: "1.0",
      style_notes: null,
      extraction_status: "not_extracted" as const,
      sensitivity: d.is_official ? "confidential" as const : "internal" as const,
    };
  });

  // Mapping rules
  const rules: EnterpriseRuleProfile[] = draft.rules.map((r) => {
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

// ── Mapper GlobalEnterpriseMemory → Draft (partiel) ───────────────────────────
// Pour restaurer un draft depuis une mémoire existante (read-only).

export function mapEnterpriseMemoryToGlobalOnboardingDraft(
  memory: GlobalEnterpriseMemory,
  options: { companyId?: string } = {}
): Partial<GlobalOnboardingDraft> {
  const companyId = options.companyId ?? memory.identity.company_name ?? "unknown";
  return {
    company_id: companyId,
    company: {
      company_name: memory.identity.company_name ?? "",
      industry: memory.identity.industry ?? "",
      size_range: memory.identity.size_range ?? "",
      country: memory.identity.country ?? "FR",
      language: memory.identity.language ?? "fr",
      timezone: memory.identity.timezone ?? "Europe/Paris",
      description: memory.identity.public_description ?? "",
    },
    humans: memory.humans.humans.map((h) => ({
      id: h.human_id,
      full_name: h.full_name,
      role_title: h.role_title ?? "",
      department: h.department_id ?? "",
      is_approver: h.permissions?.includes("approve_actions") ?? false,
      validation_scope: h.permissions?.filter((p) => p !== "approve_actions") ?? [],
    })),
  };
}

// ── Aperçu CloneADN depuis draft ──────────────────────────────────────────────
// Construit un aperçu local non persisté.

export function buildCloneADNPreviewFromOnboardingDraft(
  draft: GlobalOnboardingDraft
): Record<string, unknown> {
  try {
    const memory = mapGlobalOnboardingDraftToEnterpriseMemory(draft);
    const validation = validateGlobalEnterpriseMemory(memory);
    const score = computeCoverageScore(memory);
    const snapshot = buildGlobalEnterpriseMemorySnapshot(memory);
    return {
      coverage_score: score,
      is_valid: validation.ok,
      issues_count: (validation.errors?.length ?? 0) + (validation.warnings?.length ?? 0),
      overall_coverage: snapshot.overall_coverage ?? 0,
      preview_note:
        "Aperçu local CloneADN — non persisté. Brouillon onboarding global PHASE 3.5.",
    };
  } catch {
    return {
      coverage_score: 0,
      is_valid: false,
      preview_note: "Aperçu non disponible — données insuffisantes.",
    };
  }
}
