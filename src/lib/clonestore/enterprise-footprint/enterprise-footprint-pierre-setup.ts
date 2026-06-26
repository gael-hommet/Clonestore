// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup.ts
// PHASE 3.10 — Pierre Setup Reads Enterprise Footprint — Bridge Setup
//
// Centralise la lecture read-only de l'Empreinte Entreprise pour /agents/pierre/setup.
// Réutilise le cockpit bridge (PHASE 3.9) et le handoff Pierre (PHASE 3.9).
//
// INVARIANTS ABSOLUS :
//   - localStorage uniquement (pas de Supabase, pas d'API call)
//   - read-only : aucune écriture DB
//   - pas d'import src/lib/pierre/**
//   - pas de runtime execution
//   - client-safe : typeof window checks
//   - jamais de throw brut

import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import {
  loadEnterpriseFootprintForCockpit,
} from "./enterprise-footprint-cockpit";
import {
  buildPierreEnterpriseFootprintContext,
  validatePierreEnterpriseFootprintContext,
} from "./enterprise-footprint-pierre-handoff";
import type { PierreEnterpriseFootprintContext } from "./enterprise-footprint-pierre-handoff";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierreSetupFootprintStatus =
  | "ready"             // empreinte prête, Pierre peut opérer
  | "partial"           // empreinte partielle, limitations
  | "setup_required"    // configuration requise avant Pierre
  | "not_ready"         // empreinte insuffisante
  | "empty";            // aucune empreinte disponible

export type PierreSetupFootprintSource =
  | "enterprise_footprint_snapshot"
  | "onboarding_draft_fallback"
  | "empty";

export type PierreSetupFootprintSummary = {
  company_name: string;
  industry: string;
  language: string;
  timezone: string;
  readiness_score: number;
  readiness_label: string;
  risk: string;
  risk_label: string;
  can_operate_hr_basic: boolean;
  requires_human_validation: boolean;
  approvers_count: number;
  approval_rules_count: number;
  document_references_count: number;
  missing_items_count: number;
  warnings_count: number;
  source_label: string;
  updated_at: string;
  read_only: true;
};

export type PierreSetupFootprintCard = {
  id: string;
  label: string;
  value: string | number | boolean;
  sub_label?: string;
  tone: "success" | "warning" | "neutral" | "violet";
};

export type PierreSetupFootprintRecommendation = {
  id: string;
  text: string;
  severity: "blocking" | "warning" | "info";
  href?: string;
};

export type PierreSetupFootprintAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type PierreSetupFootprintReadResult = {
  footprint: EnterpriseFootprint | null;
  context: PierreEnterpriseFootprintContext | null;
  summary: PierreSetupFootprintSummary | null;
  cards: PierreSetupFootprintCard[];
  recommendations: PierreSetupFootprintRecommendation[];
  actions: PierreSetupFootprintAction[];
  has_footprint: boolean;
  is_valid_context: boolean;
  validation_issues: string[];
  source: PierreSetupFootprintSource;
};

// ── Labels ────────────────────────────────────────────────────────────────────

export function getPierreSetupFootprintStatusLabel(
  status: PierreSetupFootprintStatus
): string {
  const labels: Record<PierreSetupFootprintStatus, string> = {
    ready: "Prêt à opérer",
    partial: "Opération limitée",
    setup_required: "Configuration requise",
    not_ready: "Non prêt",
    empty: "Aucune empreinte",
  };
  return labels[status] ?? "Inconnu";
}

export function getPierreSetupFootprintRiskLabel(risk: string): string {
  const labels: Record<string, string> = {
    low: "Faible",
    medium: "Moyen",
    high: "Élevé",
    unknown: "Indéterminé",
  };
  return labels[risk] ?? risk;
}

export function getPierreSetupFootprintReadinessLabel(readiness: string): string {
  const labels: Record<string, string> = {
    can_operate: "Peut opérer normalement",
    can_operate_limited: "Opération limitée",
    requires_setup: "Configuration requise",
    not_ready: "Non prêt",
  };
  return labels[readiness] ?? readiness;
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function buildEmptyPierreSetupFootprintState(): PierreSetupFootprintReadResult {
  return {
    footprint: null,
    context: null,
    summary: null,
    cards: [],
    recommendations: [
      {
        id: "create_footprint",
        text: "Compléter l'onboarding global pour que Pierre dispose du contexte entreprise.",
        severity: "blocking",
        href: "/profile/onboarding",
      },
    ],
    actions: [
      {
        id: "onboarding",
        label: "Compléter l'Empreinte Entreprise",
        href: "/profile/onboarding",
        primary: true,
      },
    ],
    has_footprint: false,
    is_valid_context: false,
    validation_issues: ["Aucune empreinte entreprise disponible"],
    source: "empty",
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildPierreSetupFootprintSummary(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreSetupFootprintSummary {
  const readinessLabel = getPierreSetupFootprintReadinessLabel(context.readiness);
  const riskLabel = getPierreSetupFootprintRiskLabel(context.risk);

  const sourceLabels: Record<string, string> = {
    onboarding_local: "Snapshot local",
    onboarding_server: "Serveur onboarding",
    cloneadn: "CloneADN",
    demo: "Démo",
  };

  return {
    company_name: context.company_name,
    industry: context.industry,
    language: context.language,
    timezone: context.timezone,
    readiness_score: context.readiness_score,
    readiness_label: readinessLabel,
    risk: context.risk,
    risk_label: riskLabel,
    can_operate_hr_basic: context.can_operate_hr_basic,
    requires_human_validation: context.requires_human_validation,
    approvers_count: context.approvers.length,
    approval_rules_count: context.approval_rules.length,
    document_references_count: context.document_references.length,
    missing_items_count: context.missing_items.length,
    warnings_count: context.warnings.length,
    source_label: sourceLabels[footprint.source] ?? "Local",
    updated_at: footprint.updated_at,
    read_only: true,
  };
}

// ── Cards builder ─────────────────────────────────────────────────────────────

export function buildPierreSetupFootprintCards(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreSetupFootprintCard[] {
  return [
    {
      id: "readiness",
      label: "Readiness Pierre",
      value: `${context.readiness_score}%`,
      sub_label: getPierreSetupFootprintReadinessLabel(context.readiness),
      tone: context.readiness === "can_operate" ? "success"
        : context.readiness === "can_operate_limited" ? "warning"
        : "neutral",
    },
    {
      id: "risk",
      label: "Risque RH",
      value: getPierreSetupFootprintRiskLabel(context.risk),
      sub_label: context.risk === "low" ? "Règles et approbateurs présents" : "Configuration à compléter",
      tone: context.risk === "low" ? "success"
        : context.risk === "medium" ? "warning"
        : "neutral",
    },
    {
      id: "validations",
      label: "Validations humaines",
      value: `${context.approvers.length} approbateur(s)`,
      sub_label: context.requires_human_validation
        ? "Validation requise pour actions sensibles"
        : "Aucune règle de validation définie",
      tone: context.approvers.length > 0 ? "success" : "warning",
    },
    {
      id: "context_hr",
      label: "Contexte RH",
      value: `${context.approval_rules.length} règle(s)`,
      sub_label: `${context.document_references.length} document(s) référencé(s)`,
      tone: context.approval_rules.length > 0 ? "success" : "neutral",
    },
  ];
}

// ── Recommendations builder ───────────────────────────────────────────────────

export function buildPierreSetupFootprintRecommendations(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreSetupFootprintRecommendation[] {
  const recs: PierreSetupFootprintRecommendation[] = [];

  if (context.approvers.length === 0) {
    recs.push({
      id: "add_approver",
      text: "Ajouter un approbateur RH dans l'onboarding.",
      severity: "blocking",
      href: "/profile/onboarding",
    });
  }

  if (context.approval_rules.length === 0) {
    recs.push({
      id: "add_rules",
      text: "Définir au moins une règle de validation.",
      severity: "blocking",
      href: "/profile/onboarding",
    });
  }

  if (context.document_references.length === 0) {
    recs.push({
      id: "add_documents",
      text: "Référencer les documents RH utiles.",
      severity: "warning",
      href: "/profile/onboarding",
    });
  }

  if (context.readiness === "not_ready") {
    recs.push({
      id: "complete_footprint",
      text: "Compléter l'Empreinte avant de lancer Pierre.",
      severity: "blocking",
      href: "/profile/onboarding",
    });
  }

  if (context.can_operate_hr_basic) {
    recs.push({
      id: "ready_plan_only",
      text: "Pierre peut préparer des missions RH plan-only avec garde-fous.",
      severity: "info",
    });
  }

  // Toujours rappeler le mode read-only
  recs.push({
    id: "read_only_reminder",
    text: "Lecture seule — aucune action exécutée depuis cette configuration.",
    severity: "info",
  });

  return recs;
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildPierreSetupFootprintActions(
  result: Pick<PierreSetupFootprintReadResult, "has_footprint" | "context">
): PierreSetupFootprintAction[] {
  const actions: PierreSetupFootprintAction[] = [];

  if (!result.has_footprint) {
    actions.push({
      id: "create_footprint",
      label: "Créer l'Empreinte Entreprise",
      href: "/profile/onboarding",
      primary: true,
    });
    return actions;
  }

  const readiness = result.context?.readiness ?? "not_ready";

  if (readiness === "can_operate" || readiness === "can_operate_limited") {
    actions.push({
      id: "see_footprint",
      label: "Voir l'empreinte",
      href: "/profile/agents#empreinte-entreprise",
      primary: true,
    });
  } else {
    actions.push({
      id: "complete_footprint",
      label: "Compléter l'empreinte",
      href: "/profile/onboarding",
      primary: true,
    });
  }

  actions.push(
    {
      id: "cockpit",
      label: "Mon espace",
      href: "/profile/agents",
      primary: false,
    },
    {
      id: "messages",
      label: "Messages",
      href: "/profile/messages",
      primary: false,
    },
    {
      id: "technologies",
      label: "Technologies",
      href: "/profile/technologies",
      primary: false,
    }
  );

  return actions;
}

// ── Load principal ────────────────────────────────────────────────────────────
// Client-safe. Pas de Supabase. Pas d'API call. Pas de runtime Pierre.
//
// Flux :
//   1. loadEnterpriseFootprintForCockpit() → snapshot ou fallback draft
//   2. buildPierreEnterpriseFootprintContext(footprint)
//   3. validatePierreEnterpriseFootprintContext(context)
//   4. buildSummary / buildCards / buildRecommendations / buildActions
//   5. return structured result

export function loadPierreSetupEnterpriseFootprint(): PierreSetupFootprintReadResult {
  // Guard SSR
  if (typeof window === "undefined") {
    return buildEmptyPierreSetupFootprintState();
  }

  try {
    // Étape 1 — Charger via cockpit bridge (snapshot → draft → empty)
    const cockpitResult = loadEnterpriseFootprintForCockpit();

    if (!cockpitResult.has_footprint || !cockpitResult.footprint) {
      return buildEmptyPierreSetupFootprintState();
    }

    const footprint = cockpitResult.footprint;

    // Étape 2 — Construire contexte Pierre
    const context = buildPierreEnterpriseFootprintContext(footprint);

    // Étape 3 — Valider le contexte
    const validation = validatePierreEnterpriseFootprintContext(context);

    // Étape 4 — Construire les éléments UI
    const summary = buildPierreSetupFootprintSummary(footprint, context);
    const cards = buildPierreSetupFootprintCards(footprint, context);
    const recommendations = buildPierreSetupFootprintRecommendations(footprint, context);
    const actions = buildPierreSetupFootprintActions({ has_footprint: true, context });

    return {
      footprint,
      context,
      summary,
      cards,
      recommendations,
      actions,
      has_footprint: true,
      is_valid_context: validation.valid,
      validation_issues: validation.issues,
      source: cockpitResult.source as PierreSetupFootprintSource,
    };
  } catch {
    /* Silent fail — localStorage peut être indisponible */
    return buildEmptyPierreSetupFootprintState();
  }
}
