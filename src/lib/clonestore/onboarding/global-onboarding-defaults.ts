// src/lib/clonestore/onboarding/global-onboarding-defaults.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Defaults
//
// Constantes, clés localStorage et builders pour les données par défaut.

import type {
  GlobalOnboardingDraft,
  GlobalOnboardingCompanyDraft,
  GlobalOnboardingFirstMissionDraft,
} from "./global-onboarding-types";
import { GLOBAL_ONBOARDING_CURRENT_STEP_IDS } from "./global-onboarding-types";

// ── Clé localStorage ──────────────────────────────────────────────────────────
// Source de vérité unique — compatible avec la page /profile/onboarding.

export const GLOBAL_ONBOARDING_LOCALSTORAGE_KEY =
  "clonestore.globalOnboarding.draft.v1" as const;

// ── Limites ────────────────────────────────────────────────────────────────────

export const GLOBAL_ONBOARDING_MAX_HUMANS = 20;
export const GLOBAL_ONBOARDING_MAX_DOCUMENTS = 30;
export const GLOBAL_ONBOARDING_MAX_RULES = 30;

// ── Company draft vide ─────────────────────────────────────────────────────────

export function buildDefaultGlobalOnboardingCompanyDraft(): GlobalOnboardingCompanyDraft {
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

// ── Première mission Pierre ────────────────────────────────────────────────────

export function buildDefaultFirstPierreMissionDraft(): GlobalOnboardingFirstMissionDraft {
  return {
    mission_type: "hr_email_onboarding",
    prompt: "Prépare un email d'accueil pour un nouveau salarié.",
    employee_slug: "pierre",
    plan_only: true,
  };
}

// ── Draft vide ────────────────────────────────────────────────────────────────

export function buildEmptyGlobalOnboardingDraft(
  companyId = "local_company"
): GlobalOnboardingDraft {
  const now = new Date().toISOString();
  return {
    id: `local:${Date.now()}`,
    company_id: companyId,
    status: "local_draft",
    current_step: "company_identity",
    completion_score: 0,
    step_statuses: Object.fromEntries(
      GLOBAL_ONBOARDING_CURRENT_STEP_IDS.map((id, i) => [
        id,
        i === 0 ? "in_progress" : "pending",
      ])
    ) as Record<typeof GLOBAL_ONBOARDING_CURRENT_STEP_IDS[number], "pending" | "in_progress" | "done" | "skipped">,
    company: buildDefaultGlobalOnboardingCompanyDraft(),
    humans: [],
    documents: [],
    rules: [],
    technologies: [],
    first_mission: null,
    cloneadn_preview: {},
    created_at: now,
    updated_at: now,
    source: "localstorage",
    read_only: false,
    metadata: {
      persistence_mode: "localstorage_only",
      phase: "3.5",
    },
  };
}

// ── Draft démo ────────────────────────────────────────────────────────────────
// Données fictives clairement identifiées comme démonstration.
// Jamais une vraie entreprise.

export function buildDemoGlobalOnboardingDraft(): GlobalOnboardingDraft {
  const now = new Date("2026-06-01T10:00:00Z").toISOString();
  const draft = buildEmptyGlobalOnboardingDraft("demo_company");

  return {
    ...draft,
    id: "demo:onboarding_draft",
    company_id: "demo_company",
    status: "local_draft",
    current_step: "technologies",
    completion_score: 60,
    step_statuses: {
      company_identity: "done",
      team_humans: "done",
      documents: "done",
      rules_validations: "done",
      technologies: "in_progress",
      first_pierre_mission: "pending",
    },
    company: {
      company_name: "Demo Entreprise SA",
      industry: "tech",
      size_range: "11-50",
      country: "FR",
      language: "fr",
      timezone: "Europe/Paris",
      description:
        "Entreprise de démonstration — données fictives. Non réelle.",
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
    documents: [
      {
        id: "demo_doc_1",
        title: "Modèle contrat de travail CDI",
        document_type: "contract",
        is_official: true,
        applies_to_domains: ["hr", "legal"],
        status: "planned",
      },
    ],
    rules: [
      {
        id: "demo_rule_1",
        title: "Validation humaine pour tout email externe",
        domain: "hr",
        risk_level: "high",
        requires_validation: true,
        description:
          "Pierre doit toujours demander validation avant envoi externe.",
      },
    ],
    first_mission: buildDefaultFirstPierreMissionDraft(),
    created_at: now,
    updated_at: now,
    source: "demo",
    read_only: false,
    metadata: {
      persistence_mode: "localstorage_only",
      is_demo: true,
      phase: "3.5",
    },
  };
}
