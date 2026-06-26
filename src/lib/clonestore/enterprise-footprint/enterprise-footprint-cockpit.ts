// src/lib/clonestore/enterprise-footprint/enterprise-footprint-cockpit.ts
// PHASE 3.9 — Empreinte Entreprise Cockpit Integration — Bridge Cockpit
//
// Centralise la logique de lecture et présentation de l'Empreinte Entreprise
// pour le cockpit /profile/agents.
//
// INVARIANTS ABSOLUS :
//   - localStorage uniquement (pas de Supabase, pas d'API call)
//   - read-only : aucune écriture DB
//   - client-safe : typeof window checks
//   - jamais de throw brut
//   - fallback propre si aucune donnée disponible

import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import {
  loadEnterpriseFootprintFromLocalStorage,
  normalizeEnterpriseFootprintPayload,
  saveEnterpriseFootprintToLocalStorage,
} from "./enterprise-footprint-localstorage";
import {
  loadGlobalOnboardingDraftFromLocalStorage,
  normalizeGlobalOnboardingPayload,
} from "@/lib/clonestore/onboarding";
import { mapGlobalOnboardingDraftToEnterpriseFootprint } from "./enterprise-footprint-mappers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintCockpitStatus =
  | "ready"           // empreinte complète
  | "incomplete"      // données manquantes mais utilisable
  | "draft"           // brouillon initial
  | "needs_review"    // incohérences
  | "empty"           // aucune empreinte disponible
  | "loading";        // chargement en cours

export type EnterpriseFootprintCockpitSource =
  | "enterprise_footprint_snapshot"  // depuis localStorage snapshot P3.8
  | "onboarding_draft_fallback"      // depuis GlobalOnboardingDraft localStorage
  | "empty";                         // aucune donnée disponible

export type EnterpriseFootprintCockpitSummary = {
  company_name: string;
  status: EnterpriseFootprintCockpitStatus;
  status_label: string;
  source: EnterpriseFootprintCockpitSource;
  source_label: string;
  readiness_score: number;
  readiness_level: "low" | "medium" | "high" | "complete";
  coverage_score: number;
  humans_count: number;
  approvers_count: number;
  approval_rules_count: number;
  documents_count: number;
  technologies_count: number;
  missing_items_count: number;
  warnings_count: number;
  top_missing_items: string[];
  top_warnings: string[];
  updated_at: string;
  read_only: true;
};

export type EnterpriseFootprintCockpitCard = {
  id: string;
  label: string;
  value: string | number;
  sub_label?: string;
  tone: "success" | "warning" | "neutral" | "violet";
};

export type EnterpriseFootprintCockpitAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
};

export type EnterpriseFootprintCockpitReadResult = {
  footprint: EnterpriseFootprint | null;
  source: EnterpriseFootprintCockpitSource;
  summary: EnterpriseFootprintCockpitSummary | null;
  cards: EnterpriseFootprintCockpitCard[];
  actions: EnterpriseFootprintCockpitAction[];
  has_footprint: boolean;
};

// ── Labels ────────────────────────────────────────────────────────────────────

export function getEnterpriseFootprintCockpitStatusLabel(
  status: EnterpriseFootprintCockpitStatus
): string {
  const labels: Record<EnterpriseFootprintCockpitStatus, string> = {
    ready: "Prête",
    incomplete: "Incomplète",
    draft: "Brouillon",
    needs_review: "À revoir",
    empty: "Aucune empreinte",
    loading: "Chargement…",
  };
  return labels[status] ?? "Inconnu";
}

export function getEnterpriseFootprintCockpitSourceLabel(
  source: EnterpriseFootprintCockpitSource
): string {
  const labels: Record<EnterpriseFootprintCockpitSource, string> = {
    enterprise_footprint_snapshot: "Snapshot local",
    onboarding_draft_fallback: "Brouillon onboarding",
    empty: "Aucune donnée",
  };
  return labels[source] ?? "Inconnu";
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function buildEmptyEnterpriseFootprintCockpitState(): EnterpriseFootprintCockpitReadResult {
  const emptySummary: EnterpriseFootprintCockpitSummary = {
    company_name: "",
    status: "empty",
    status_label: "Aucune empreinte",
    source: "empty",
    source_label: "Aucune donnée",
    readiness_score: 0,
    readiness_level: "low",
    coverage_score: 0,
    humans_count: 0,
    approvers_count: 0,
    approval_rules_count: 0,
    documents_count: 0,
    technologies_count: 0,
    missing_items_count: 0,
    warnings_count: 0,
    top_missing_items: [],
    top_warnings: [],
    updated_at: new Date().toISOString(),
    read_only: true,
  };

  return {
    footprint: null,
    source: "empty",
    summary: emptySummary,
    cards: [],
    actions: [
      {
        id: "create_footprint",
        label: "Créer l'Empreinte Entreprise",
        href: "/profile/onboarding",
        primary: true,
        description: "Configurez votre entreprise pour utiliser CloneStore.",
      },
    ],
    has_footprint: false,
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildEnterpriseFootprintCockpitSummary(
  footprint: EnterpriseFootprint,
  source: EnterpriseFootprintCockpitSource = "enterprise_footprint_snapshot"
): EnterpriseFootprintCockpitSummary {
  const approvers = footprint.humans.filter((h) => h.is_approver);
  const topMissing = footprint.missing_items.slice(0, 3);
  const topWarnings = footprint.warnings.slice(0, 2);

  const status: EnterpriseFootprintCockpitStatus =
    footprint.status === "ready" ? "ready"
    : footprint.status === "incomplete" ? "incomplete"
    : footprint.status === "needs_review" ? "needs_review"
    : "draft";

  return {
    company_name: footprint.company.company_name || "Entreprise non renseignée",
    status,
    status_label: getEnterpriseFootprintCockpitStatusLabel(status),
    source,
    source_label: getEnterpriseFootprintCockpitSourceLabel(source),
    readiness_score: footprint.readiness_score.score,
    readiness_level: footprint.readiness_score.level,
    coverage_score: footprint.coverage_score,
    humans_count: footprint.humans.length,
    approvers_count: approvers.length,
    approval_rules_count: footprint.approval_rules.length,
    documents_count: footprint.documents.length,
    technologies_count: footprint.technologies.length,
    missing_items_count: footprint.missing_items.length,
    warnings_count: footprint.warnings.length,
    top_missing_items: topMissing,
    top_warnings: topWarnings,
    updated_at: footprint.updated_at,
    read_only: true,
  };
}

// ── Cards builder ─────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintCockpitCards(
  footprint: EnterpriseFootprint
): EnterpriseFootprintCockpitCard[] {
  const cards: EnterpriseFootprintCockpitCard[] = [
    {
      id: "readiness",
      label: "Readiness",
      value: `${footprint.readiness_score.score}%`,
      sub_label: footprint.readiness_score.level === "complete" ? "Complète"
        : footprint.readiness_score.level === "high" ? "Haute"
        : footprint.readiness_score.level === "medium" ? "Moyenne"
        : "Faible",
      tone: footprint.readiness_score.score >= 85 ? "success"
        : footprint.readiness_score.score >= 50 ? "warning"
        : "neutral",
    },
    {
      id: "coverage",
      label: "CloneADN",
      value: `${footprint.coverage_score}%`,
      sub_label: "Couverture mémoire",
      tone: footprint.coverage_score >= 70 ? "success"
        : footprint.coverage_score >= 40 ? "warning"
        : "neutral",
    },
    {
      id: "humans",
      label: "Humains",
      value: footprint.humans.length,
      sub_label: `${footprint.humans.filter((h) => h.is_approver).length} approbateur(s)`,
      tone: footprint.humans.length > 0 ? "success" : "neutral",
    },
    {
      id: "rules",
      label: "Règles",
      value: footprint.approval_rules.length,
      sub_label: `${footprint.documents.length} document(s)`,
      tone: footprint.approval_rules.length > 0 ? "success" : "neutral",
    },
  ];

  if (footprint.missing_items.length > 0) {
    cards.push({
      id: "missing",
      label: "Éléments manquants",
      value: footprint.missing_items.length,
      sub_label: footprint.missing_items[0] ?? "",
      tone: "warning",
    });
  }

  return cards;
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildEnterpriseFootprintCockpitActions(
  footprint: EnterpriseFootprint
): EnterpriseFootprintCockpitAction[] {
  const actions: EnterpriseFootprintCockpitAction[] = [];

  // Action principale selon readiness
  if (footprint.readiness_score.score < 60) {
    actions.push({
      id: "complete_onboarding",
      label: "Compléter l'empreinte",
      href: "/profile/onboarding",
      primary: true,
      description: "Compléter les informations manquantes.",
    });
  } else {
    actions.push({
      id: "verify_onboarding",
      label: "Vérifier l'empreinte",
      href: "/profile/onboarding",
      primary: true,
      description: "Vérifier et mettre à jour l'empreinte entreprise.",
    });
  }

  // Actions secondaires
  actions.push(
    {
      id: "messages",
      label: "Voir messages",
      href: "/profile/messages",
      primary: false,
    },
    {
      id: "technologies",
      label: "Technologies",
      href: "/profile/technologies",
      primary: false,
    },
    {
      id: "pierre_use",
      label: "Ouvrir Pierre",
      href: "/agents/pierre/use",
      primary: false,
    },
    {
      id: "pierre_setup",
      label: "Configurer Pierre",
      href: "/agents/pierre/setup",
      primary: false,
    }
  );

  return actions;
}

// ── Load pour cockpit ─────────────────────────────────────────────────────────
// Client-safe (typeof window). Pas de Supabase. Pas de DB. Pas de throw brut.
//
// Flux :
//   1. Tenter loadEnterpriseFootprintFromLocalStorage
//   2. Si valide → source enterprise_footprint_snapshot
//   3. Sinon tenter loadGlobalOnboardingDraftFromLocalStorage
//   4. Si draft valide → mapper + sauvegarder snapshot + source onboarding_draft_fallback
//   5. Sinon → empty state avec CTA /profile/onboarding

export function loadEnterpriseFootprintForCockpit(): EnterpriseFootprintCockpitReadResult {
  // Guard SSR
  if (typeof window === "undefined") {
    return buildEmptyEnterpriseFootprintCockpitState();
  }

  // 1. Tenter snapshot EnterpriseFootprint
  try {
    const rawFootprint = loadEnterpriseFootprintFromLocalStorage();
    if (rawFootprint) {
      const footprint = normalizeEnterpriseFootprintPayload(rawFootprint);
      if (footprint && footprint.company_id) {
        const summary = buildEnterpriseFootprintCockpitSummary(
          footprint,
          "enterprise_footprint_snapshot"
        );
        return {
          footprint,
          source: "enterprise_footprint_snapshot",
          summary,
          cards: buildEnterpriseFootprintCockpitCards(footprint),
          actions: buildEnterpriseFootprintCockpitActions(footprint),
          has_footprint: true,
        };
      }
    }
  } catch {
    /* Silent fail — passer au fallback */
  }

  // 2. Fallback : GlobalOnboardingDraft localStorage
  try {
    const rawDraft = loadGlobalOnboardingDraftFromLocalStorage();
    if (rawDraft) {
      const draft = normalizeGlobalOnboardingPayload(rawDraft);
      if (draft && (draft.company?.company_name || draft.current_step || draft.company_id)) {
        // Mapper draft → footprint (best-effort)
        const footprintFromDraft = mapGlobalOnboardingDraftToEnterpriseFootprint(
          draft as Parameters<typeof mapGlobalOnboardingDraftToEnterpriseFootprint>[0]
        );
        // Sauvegarder le snapshot pour éviter de recalculer
        try {
          saveEnterpriseFootprintToLocalStorage(footprintFromDraft);
        } catch {
          /* Silent fail */
        }
        const summary = buildEnterpriseFootprintCockpitSummary(
          footprintFromDraft,
          "onboarding_draft_fallback"
        );
        return {
          footprint: footprintFromDraft,
          source: "onboarding_draft_fallback",
          summary,
          cards: buildEnterpriseFootprintCockpitCards(footprintFromDraft),
          actions: buildEnterpriseFootprintCockpitActions(footprintFromDraft),
          has_footprint: true,
        };
      }
    }
  } catch {
    /* Silent fail */
  }

  // 3. Aucune donnée → empty state
  return buildEmptyEnterpriseFootprintCockpitState();
}
