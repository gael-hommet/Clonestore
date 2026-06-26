// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use.ts
// PHASE 3.11 — Pierre Use Reads Enterprise Footprint — Bridge Use
//
// Centralise la lecture read-only de l'Empreinte Entreprise pour /agents/pierre/use.
// Réutilise le cockpit bridge (PHASE 3.9) et le handoff Pierre (PHASE 3.9).
//
// INVARIANTS ABSOLUS :
//   - localStorage uniquement (pas de Supabase, pas d'API call)
//   - read-only : aucune écriture DB
//   - pas d'import src/lib/pierre/**
//   - pas de runtime execution
//   - pas d'auto-submit
//   - suggestions plan_only: true — jamais d'exécution automatique
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

export type PierreUseFootprintStatus =
  | "ready"             // empreinte prête, Pierre peut opérer
  | "partial"           // empreinte partielle, limitations
  | "setup_required"    // configuration requise avant Pierre
  | "not_ready"         // empreinte insuffisante
  | "empty";            // aucune empreinte disponible

export type PierreUseFootprintSource =
  | "enterprise_footprint_snapshot"
  | "onboarding_draft_fallback"
  | "empty";

export type PierreUseFootprintSummary = {
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

export type PierreUseFootprintCard = {
  id: string;
  label: string;
  value: string | number | boolean;
  sub_label?: string;
  tone: "success" | "warning" | "neutral" | "violet";
};

export type PierreUseFootprintWarning = {
  id: string;
  message: string;
  severity: "blocking" | "warning" | "info";
};

/** Suggestion de mission UI-only. Jamais auto-exécutée. plan_only: true invariant. */
export type PierreUseFootprintMissionSuggestion = {
  id: string;
  title: string;
  prompt: string;
  category: string;
  risk_level: "low" | "medium" | "high";
  requires_validation: boolean;
  plan_only: true;      // invariant — toujours true
  disabled: boolean;
  disabled_reason?: string;
};

export type PierreUseFootprintAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type PierreUseFootprintReadResult = {
  footprint: EnterpriseFootprint | null;
  context: PierreEnterpriseFootprintContext | null;
  summary: PierreUseFootprintSummary | null;
  cards: PierreUseFootprintCard[];
  warnings: PierreUseFootprintWarning[];
  suggestions: PierreUseFootprintMissionSuggestion[];
  actions: PierreUseFootprintAction[];
  has_footprint: boolean;
  is_valid_context: boolean;
  validation_issues: string[];
  source: PierreUseFootprintSource;
};

// ── Labels ────────────────────────────────────────────────────────────────────

export function getPierreUseFootprintStatusLabel(
  status: PierreUseFootprintStatus
): string {
  const labels: Record<PierreUseFootprintStatus, string> = {
    ready: "Prêt à opérer",
    partial: "Opération limitée",
    setup_required: "Configuration requise",
    not_ready: "Non prêt",
    empty: "Aucune empreinte",
  };
  return labels[status] ?? "Inconnu";
}

export function getPierreUseFootprintRiskLabel(risk: string): string {
  const labels: Record<string, string> = {
    low: "Faible",
    medium: "Moyen",
    high: "Élevé",
    unknown: "Indéterminé",
  };
  return labels[risk] ?? risk;
}

export function getPierreUseFootprintReadinessLabel(readiness: string): string {
  const labels: Record<string, string> = {
    can_operate: "Peut opérer normalement",
    can_operate_limited: "Opération limitée",
    requires_setup: "Configuration requise",
    not_ready: "Non prêt",
  };
  return labels[readiness] ?? readiness;
}

// ── Suggestions désactivées (empty state) ────────────────────────────────────
// Toutes plan_only: true — jamais d'exécution.

function buildDisabledSuggestions(): PierreUseFootprintMissionSuggestion[] {
  return [
    {
      id: "prepare_hr_procedure",
      title: "Préparer une procédure RH",
      prompt: "Pierre, prépare une procédure RH adaptée à notre entreprise, sans l'envoyer, avec les points à valider par un humain.",
      category: "procédure",
      risk_level: "medium",
      requires_validation: true,
      plan_only: true,
      disabled: true,
      disabled_reason: "Empreinte Entreprise requise pour personnaliser la procédure.",
    },
    {
      id: "list_missing_hr_docs",
      title: "Lister les documents RH manquants",
      prompt: "Pierre, analyse les documents RH référencés et liste ce qu'il manque pour sécuriser notre fonctionnement.",
      category: "audit",
      risk_level: "low",
      requires_validation: false,
      plan_only: true,
      disabled: true,
      disabled_reason: "Empreinte Entreprise requise pour analyser les documents.",
    },
    {
      id: "prepare_internal_comms",
      title: "Préparer une communication interne",
      prompt: "Pierre, prépare un brouillon de communication interne conforme au ton et aux règles de l'entreprise.",
      category: "communication",
      risk_level: "low",
      requires_validation: false,
      plan_only: true,
      disabled: true,
      disabled_reason: "Empreinte Entreprise requise pour aligner le ton.",
    },
    {
      id: "check_sensitive_action",
      title: "Vérifier une action sensible",
      prompt: "Pierre, vérifie si cette action RH nécessite validation humaine selon nos règles internes.",
      category: "gouvernance",
      risk_level: "high",
      requires_validation: true,
      plan_only: true,
      disabled: true,
      disabled_reason: "Empreinte Entreprise requise pour appliquer les règles de validation.",
    },
    {
      id: "create_plan_only_mission",
      title: "Créer une mission RH plan-only",
      prompt: "Pierre, transforme ma demande RH en plan de mission avec tâches, risques et validations nécessaires, sans exécution.",
      category: "planification",
      risk_level: "medium",
      requires_validation: true,
      plan_only: true,
      disabled: true,
      disabled_reason: "Empreinte Entreprise requise pour générer un plan contextualisé.",
    },
  ];
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function buildEmptyPierreUseFootprintState(): PierreUseFootprintReadResult {
  return {
    footprint: null,
    context: null,
    summary: null,
    cards: [],
    warnings: [
      {
        id: "no_footprint",
        message: "L'Empreinte Entreprise n'est pas disponible. Pierre peut être utilisé, mais sans contexte entreprise.",
        severity: "warning",
      },
    ],
    suggestions: buildDisabledSuggestions(),
    actions: [
      {
        id: "onboarding",
        label: "Compléter l'Empreinte Entreprise",
        href: "/profile/onboarding",
        primary: true,
      },
      {
        id: "setup",
        label: "Configuration Pierre",
        href: "/agents/pierre/setup",
        primary: false,
      },
    ],
    has_footprint: false,
    is_valid_context: false,
    validation_issues: ["Aucune empreinte entreprise disponible"],
    source: "empty",
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildPierreUseFootprintSummary(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreUseFootprintSummary {
  const readinessLabel = getPierreUseFootprintReadinessLabel(context.readiness);
  const riskLabel = getPierreUseFootprintRiskLabel(context.risk);

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

export function buildPierreUseFootprintCards(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreUseFootprintCard[] {
  return [
    {
      id: "context_entreprise",
      label: "Contexte entreprise",
      value: context.company_name || "Non renseigné",
      sub_label: `Source : ${footprint.source ?? "local"}`,
      tone: context.company_name ? "success" : "neutral",
    },
    {
      id: "readiness",
      label: "Readiness Pierre",
      value: `${context.readiness_score}%`,
      sub_label: getPierreUseFootprintReadinessLabel(context.readiness),
      tone:
        context.readiness === "can_operate" ? "success"
        : context.readiness === "can_operate_limited" ? "warning"
        : "neutral",
    },
    {
      id: "garde_fous",
      label: "Garde-fous RH",
      value: getPierreUseFootprintRiskLabel(context.risk),
      sub_label: context.requires_human_validation
        ? "Validation humaine requise"
        : "Pas de règle de validation",
      tone:
        context.risk === "low" ? "success"
        : context.risk === "medium" ? "warning"
        : "neutral",
    },
    {
      id: "ressources_rh",
      label: "Ressources RH",
      value: `${context.approvers.length} approbateur(s)`,
      sub_label: `${context.approval_rules.length} règle(s) · ${context.document_references.length} doc(s)`,
      tone:
        context.approvers.length > 0 && context.approval_rules.length > 0
          ? "success"
          : "warning",
    },
  ];
}

// ── Warnings builder ──────────────────────────────────────────────────────────

export function buildPierreUseFootprintWarnings(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreUseFootprintWarning[] {
  const warnings: PierreUseFootprintWarning[] = [];

  if (context.approvers.length === 0) {
    warnings.push({
      id: "no_approver",
      message: "Aucun approbateur RH n'est défini.",
      severity: "blocking",
    });
  }

  if (context.approval_rules.length === 0) {
    warnings.push({
      id: "no_rules",
      message: "Aucune règle de validation RH n'est définie.",
      severity: "blocking",
    });
  }

  if (context.document_references.length === 0) {
    warnings.push({
      id: "no_documents",
      message: "Aucun document RH officiel n'est référencé.",
      severity: "warning",
    });
  }

  if (context.readiness === "not_ready") {
    warnings.push({
      id: "not_ready",
      message: "L'Empreinte est insuffisante pour des missions RH avancées.",
      severity: "blocking",
    });
  }

  if (context.risk === "high" || context.risk === "unknown") {
    warnings.push({
      id: "high_risk",
      message: "Les missions sensibles doivent rester en préparation/plan-only.",
      severity: "warning",
    });
  }

  // Toujours rappeler le mode read-only
  warnings.push({
    id: "plan_only_reminder",
    message: "Lecture seule — aucune action exécutée depuis ce panneau.",
    severity: "info",
  });

  return warnings;
}

// ── Mission suggestions builder ───────────────────────────────────────────────
// Toutes les suggestions sont plan_only: true — jamais d'exécution automatique.
// L'affichage est UI-only. Aucune suggestion ne soumet automatiquement au moteur Pierre.

export function buildPierreUseFootprintMissionSuggestions(
  footprint: EnterpriseFootprint,
  context: PierreEnterpriseFootprintContext
): PierreUseFootprintMissionSuggestion[] {
  const isOperational =
    context.readiness === "can_operate" ||
    context.readiness === "can_operate_limited";

  return [
    {
      id: "prepare_hr_procedure",
      title: "Préparer une procédure RH",
      prompt: `Pierre, prépare une procédure RH adaptée à ${context.company_name || "notre entreprise"}, sans l'envoyer, avec les points à valider par un humain.`,
      category: "procédure",
      risk_level: "medium",
      requires_validation: true,
      plan_only: true,
      disabled: !isOperational,
      disabled_reason: !isOperational
        ? "Configuration Pierre insuffisante pour personnaliser."
        : undefined,
    },
    {
      id: "list_missing_hr_docs",
      title: "Lister les documents RH manquants",
      prompt: "Pierre, analyse les documents RH référencés et liste ce qu'il manque pour sécuriser notre fonctionnement.",
      category: "audit",
      risk_level: "low",
      requires_validation: false,
      plan_only: true,
      disabled: false,
    },
    {
      id: "prepare_internal_comms",
      title: "Préparer une communication interne",
      prompt: `Pierre, prépare un brouillon de communication interne conforme au ton et aux règles de ${context.company_name || "l'entreprise"}.`,
      category: "communication",
      risk_level: "low",
      requires_validation: false,
      plan_only: true,
      disabled: false,
    },
    {
      id: "check_sensitive_action",
      title: "Vérifier une action sensible",
      prompt: "Pierre, vérifie si cette action RH nécessite validation humaine selon nos règles internes.",
      category: "gouvernance",
      risk_level: "high",
      requires_validation: true,
      plan_only: true,
      disabled: context.approvers.length === 0,
      disabled_reason:
        context.approvers.length === 0
          ? "Aucun approbateur RH défini."
          : undefined,
    },
    {
      id: "create_plan_only_mission",
      title: "Créer une mission RH plan-only",
      prompt: "Pierre, transforme ma demande RH en plan de mission avec tâches, risques et validations nécessaires, sans exécution.",
      category: "planification",
      risk_level: "medium",
      requires_validation: true,
      plan_only: true,
      disabled: false,
    },
  ];
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildPierreUseFootprintActions(
  result: Pick<PierreUseFootprintReadResult, "has_footprint" | "context">
): PierreUseFootprintAction[] {
  const actions: PierreUseFootprintAction[] = [];

  if (!result.has_footprint) {
    actions.push(
      {
        id: "create_footprint",
        label: "Compléter l'Empreinte Entreprise",
        href: "/profile/onboarding",
        primary: true,
      },
      {
        id: "setup_pierre",
        label: "Configuration Pierre",
        href: "/agents/pierre/setup",
        primary: false,
      }
    );
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
      id: "setup",
      label: "Configuration Pierre",
      href: "/agents/pierre/setup",
      primary: false,
    },
    {
      id: "cockpit",
      label: "Mon espace",
      href: "/profile/agents",
      primary: false,
    }
  );

  return actions;
}

// ── Load principal ────────────────────────────────────────────────────────────
// Client-safe. Pas de Supabase. Pas d'API call. Pas de runtime Pierre. Pas d'auto-submit.
//
// Flux :
//   1. loadEnterpriseFootprintForCockpit() → snapshot ou fallback draft
//   2. buildPierreEnterpriseFootprintContext(footprint)
//   3. validatePierreEnterpriseFootprintContext(context)
//   4. buildSummary / buildCards / buildWarnings / buildSuggestions / buildActions
//   5. return structured result

export function loadPierreUseEnterpriseFootprint(): PierreUseFootprintReadResult {
  // Guard SSR
  if (typeof window === "undefined") {
    return buildEmptyPierreUseFootprintState();
  }

  try {
    // Étape 1 — Charger via cockpit bridge (snapshot → draft → empty)
    const cockpitResult = loadEnterpriseFootprintForCockpit();

    if (!cockpitResult.has_footprint || !cockpitResult.footprint) {
      return buildEmptyPierreUseFootprintState();
    }

    const footprint = cockpitResult.footprint;

    // Étape 2 — Construire contexte Pierre
    const context = buildPierreEnterpriseFootprintContext(footprint);

    // Étape 3 — Valider le contexte
    const validation = validatePierreEnterpriseFootprintContext(context);

    // Étape 4 — Construire les éléments UI
    const summary = buildPierreUseFootprintSummary(footprint, context);
    const cards = buildPierreUseFootprintCards(footprint, context);
    const warnings = buildPierreUseFootprintWarnings(footprint, context);
    const suggestions = buildPierreUseFootprintMissionSuggestions(footprint, context);
    const actions = buildPierreUseFootprintActions({ has_footprint: true, context });

    return {
      footprint,
      context,
      summary,
      cards,
      warnings,
      suggestions,
      actions,
      has_footprint: true,
      is_valid_context: validation.valid,
      validation_issues: validation.issues,
      source: cockpitResult.source as PierreUseFootprintSource,
    };
  } catch {
    /* Silent fail — localStorage peut être indisponible */
    return buildEmptyPierreUseFootprintState();
  }
}
