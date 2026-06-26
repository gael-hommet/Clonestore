// src/lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed.ts
// PHASE 3.16 — Profile Messages Enterprise Footprint Feed
//
// Bridge messages dédié — centralise la lecture et la présentation de l'Empreinte
// Entreprise pour /profile/messages.
//
// INVARIANTS ABSOLUS :
//   - localStorage uniquement (pas de Supabase, pas d'API call, pas de DB)
//   - read-only : aucune écriture DB, aucun POST, aucun message envoyé
//   - client-safe : typeof window checks
//   - fallback chain : snapshot → onboarding_draft_fallback → empty
//   - jamais de throw brut
//   - jamais d'import src/lib/pierre

import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import {
  loadEnterpriseFootprintForCockpit,
} from "./enterprise-footprint-cockpit";

// Fallback chain note :
// loadEnterpriseFootprintForCockpit() gère :
//   1. snapshot localStorage (enterprise_footprint_snapshot)
//   2. onboarding_draft_fallback (loadGlobalOnboardingDraftFromLocalStorage via cockpit)
//   3. empty state
// Ce module délègue la chaîne de fallback au cockpit pour éviter la duplication.

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintMessagesFeedStatus =
  | "ready"         // empreinte complète
  | "incomplete"    // données manquantes mais utilisable
  | "draft"         // brouillon initial
  | "needs_review"  // incohérences
  | "empty"         // aucune empreinte disponible
  | "loading";      // chargement en cours

export type EnterpriseFootprintMessagesFeedSource =
  | "enterprise_footprint_snapshot"  // depuis localStorage snapshot P3.8
  | "onboarding_draft_fallback"      // depuis GlobalOnboardingDraft localStorage
  | "empty";                         // aucune donnée disponible

export type EnterpriseFootprintMessagesFeedSummary = {
  company_name: string;
  status: EnterpriseFootprintMessagesFeedStatus;
  status_label: string;
  source: EnterpriseFootprintMessagesFeedSource;
  source_label: string;
  readiness_score: number;
  coverage_score: number;
  humans_count: number;
  approvers_count: number;
  approval_rules_count: number;
  documents_count: number;
  missing_items_count: number;
  warnings_count: number;
  read_only: true;
  updated_at: string;
};

export type EnterpriseFootprintMessagesFeedCard = {
  id: string;
  label: string;
  value: string | number;
  sub_label?: string;
  tone: "success" | "warning" | "neutral" | "violet";
};

export type EnterpriseFootprintMessagesFeedItem = {
  id: string;
  title: string;
  body: string;
  category: "context" | "incomplete" | "validation" | "documents" | "warning" | "empty";
  severity: "info" | "warning" | "blocking";
  source: EnterpriseFootprintMessagesFeedSource;
  created_at: string;
  read_only: true;
  action_label?: string;
  action_href?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type EnterpriseFootprintMessagesFeedRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type EnterpriseFootprintMessagesFeedAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
};

export type EnterpriseFootprintMessagesFeedReadResult = {
  footprint: EnterpriseFootprint | null;
  source: EnterpriseFootprintMessagesFeedSource;
  summary: EnterpriseFootprintMessagesFeedSummary | null;
  cards: EnterpriseFootprintMessagesFeedCard[];
  items: EnterpriseFootprintMessagesFeedItem[];
  recommendations: EnterpriseFootprintMessagesFeedRecommendation[];
  actions: EnterpriseFootprintMessagesFeedAction[];
  has_footprint: boolean;
};

// ── Labels ────────────────────────────────────────────────────────────────────

export function getEnterpriseFootprintMessagesFeedStatusLabel(
  status: EnterpriseFootprintMessagesFeedStatus
): string {
  const labels: Record<EnterpriseFootprintMessagesFeedStatus, string> = {
    ready: "Prête",
    incomplete: "Incomplète",
    draft: "Brouillon",
    needs_review: "À revoir",
    empty: "Aucune empreinte",
    loading: "Chargement…",
  };
  return labels[status] ?? "Inconnu";
}

export function getEnterpriseFootprintMessagesFeedSourceLabel(
  source: EnterpriseFootprintMessagesFeedSource
): string {
  const labels: Record<EnterpriseFootprintMessagesFeedSource, string> = {
    enterprise_footprint_snapshot: "Snapshot local",
    onboarding_draft_fallback: "Brouillon onboarding",
    empty: "Aucune donnée",
  };
  return labels[source] ?? "Inconnu";
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function buildEmptyEnterpriseFootprintMessagesFeedState(): EnterpriseFootprintMessagesFeedReadResult {
  const now = new Date().toISOString();
  return {
    footprint: null,
    source: "empty",
    summary: {
      company_name: "",
      status: "empty",
      status_label: "Aucune empreinte",
      source: "empty",
      source_label: "Aucune donnée",
      readiness_score: 0,
      coverage_score: 0,
      humans_count: 0,
      approvers_count: 0,
      approval_rules_count: 0,
      documents_count: 0,
      missing_items_count: 0,
      warnings_count: 0,
      read_only: true,
      updated_at: now,
    },
    cards: [],
    items: [
      {
        id: "feed-item-empty",
        title: "Aucune Empreinte Entreprise",
        body: "Le contexte entreprise global n'est pas encore disponible. Les messages peuvent être consultés, mais certaines validations nécessiteront une configuration préalable.",
        category: "empty",
        severity: "info",
        source: "empty",
        created_at: now,
        read_only: true,
        action_label: "Configurer dans l'onboarding",
        action_href: "/profile/onboarding",
      },
    ],
    recommendations: [
      {
        id: "rec-create-footprint",
        text: "Créer l'Empreinte Entreprise dans l'onboarding.",
        href: "/profile/onboarding",
        action_label: "Aller à l'onboarding",
      },
    ],
    actions: [
      {
        id: "create_footprint",
        label: "Créer l'Empreinte Entreprise",
        href: "/profile/onboarding",
        primary: true,
        description: "Configurez votre entreprise pour enrichir le contexte des messages.",
      },
    ],
    has_footprint: false,
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildEnterpriseFootprintMessagesFeedSummary(
  footprint: EnterpriseFootprint,
  source: EnterpriseFootprintMessagesFeedSource = "enterprise_footprint_snapshot"
): EnterpriseFootprintMessagesFeedSummary {
  const approvers = footprint.humans.filter((h) => h.is_approver);
  const status: EnterpriseFootprintMessagesFeedStatus =
    footprint.status === "ready" ? "ready"
    : footprint.status === "incomplete" ? "incomplete"
    : footprint.status === "needs_review" ? "needs_review"
    : "draft";

  return {
    company_name: footprint.company.company_name || "Entreprise non renseignée",
    status,
    status_label: getEnterpriseFootprintMessagesFeedStatusLabel(status),
    source,
    source_label: getEnterpriseFootprintMessagesFeedSourceLabel(source),
    readiness_score: footprint.readiness_score.score,
    coverage_score: footprint.coverage_score,
    humans_count: footprint.humans.length,
    approvers_count: approvers.length,
    approval_rules_count: footprint.approval_rules.length,
    documents_count: footprint.documents.length,
    missing_items_count: footprint.missing_items.length,
    warnings_count: footprint.warnings.length,
    read_only: true,
    updated_at: footprint.updated_at,
  };
}

// ── Cards builder ─────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintMessagesFeedCards(
  footprint: EnterpriseFootprint
): EnterpriseFootprintMessagesFeedCard[] {
  const readiness = footprint.readiness_score.score;
  const coverage = footprint.coverage_score;
  const approvers = footprint.humans.filter((h) => h.is_approver);

  return [
    {
      id: "card-readiness",
      label: "Empreinte",
      value: `${readiness}%`,
      sub_label: coverage > 0 ? `Couverture ${coverage}%` : "Couverture non calculée",
      tone: readiness >= 60 ? "success" : readiness >= 30 ? "warning" : "neutral",
    },
    {
      id: "card-validation",
      label: "Validation",
      value:
        approvers.length > 0
          ? `${approvers.length} approbateur${approvers.length > 1 ? "s" : ""}`
          : "Aucun approbateur",
      sub_label:
        footprint.approval_rules.length > 0
          ? `${footprint.approval_rules.length} règle${footprint.approval_rules.length > 1 ? "s" : ""}`
          : "Aucune règle",
      tone: approvers.length > 0 ? "success" : "warning",
    },
    {
      id: "card-documents",
      label: "Documents",
      value:
        footprint.documents.length > 0
          ? `${footprint.documents.length} doc${footprint.documents.length > 1 ? "s" : ""}`
          : "Aucun document",
      sub_label: "Référencés",
      tone: footprint.documents.length > 0 ? "neutral" : "warning",
    },
    {
      id: "card-complete",
      label: "À compléter",
      value:
        footprint.missing_items.length > 0
          ? `${footprint.missing_items.length} élément${footprint.missing_items.length > 1 ? "s" : ""}`
          : "Rien à compléter",
      sub_label:
        footprint.warnings.length > 0
          ? `${footprint.warnings.length} avertissement${footprint.warnings.length > 1 ? "s" : ""}`
          : undefined,
      tone: footprint.missing_items.length === 0 ? "success" : "warning",
    },
  ];
}

// ── Feed items builder ────────────────────────────────────────────────────────

export function buildEnterpriseFootprintMessagesFeedItems(
  footprint: EnterpriseFootprint,
  source: EnterpriseFootprintMessagesFeedSource
): EnterpriseFootprintMessagesFeedItem[] {
  const now = new Date().toISOString();
  const items: EnterpriseFootprintMessagesFeedItem[] = [];

  // 1. Contexte entreprise disponible
  if (footprint.company.company_name) {
    items.push({
      id: "feed-item-context",
      title: "Contexte entreprise disponible",
      body: `Entreprise : ${footprint.company.company_name}. Source : ${getEnterpriseFootprintMessagesFeedSourceLabel(source)}. Lecture seule — aucune action exécutée.`,
      category: "context",
      severity: "info",
      source,
      created_at: now,
      read_only: true,
      metadata: {
        company_name: footprint.company.company_name,
        readiness: footprint.readiness_score.score,
      },
    });
  }

  // 2. Empreinte incomplète
  if (footprint.missing_items.length > 0) {
    const top = footprint.missing_items.slice(0, 3).join(", ");
    items.push({
      id: "feed-item-incomplete",
      title: "Empreinte Entreprise incomplète",
      body: `${footprint.missing_items.length} élément${footprint.missing_items.length > 1 ? "s" : ""} manquant${footprint.missing_items.length > 1 ? "s" : ""}. À compléter : ${top}.`,
      category: "incomplete",
      severity: "warning",
      source,
      created_at: now,
      read_only: true,
      action_label: "Compléter l'onboarding",
      action_href: "/profile/onboarding",
      metadata: { missing_count: footprint.missing_items.length },
    });
  }

  // 3. Validations humaines
  const approvers = footprint.humans.filter((h) => h.is_approver);
  if (approvers.length > 0) {
    items.push({
      id: "feed-item-validation",
      title: "Validations humaines configurées",
      body: `${approvers.length} approbateur${approvers.length > 1 ? "s" : ""} configuré${approvers.length > 1 ? "s" : ""}. Les actions sensibles nécessiteront leur validation avant toute exécution. Aucune action exécutée depuis la messagerie.`,
      category: "validation",
      severity: "info",
      source,
      created_at: now,
      read_only: true,
      metadata: { approvers_count: approvers.length },
    });
  }

  // 4. Documents RH
  if (footprint.documents.length > 0) {
    items.push({
      id: "feed-item-documents",
      title: "Documents RH référencés",
      body: `${footprint.documents.length} document${footprint.documents.length > 1 ? "s" : ""} référencé${footprint.documents.length > 1 ? "s" : ""} dans l'Empreinte Entreprise. Lecture seule — aucun message envoyé depuis la messagerie.`,
      category: "documents",
      severity: "info",
      source,
      created_at: now,
      read_only: true,
      metadata: { documents_count: footprint.documents.length },
    });
  }

  // 5. Warnings Empreinte
  if (footprint.warnings.length > 0) {
    const topWarning = footprint.warnings[0] ?? "";
    items.push({
      id: "feed-item-warnings",
      title: "Warnings Empreinte",
      body: `${footprint.warnings.length} avertissement${footprint.warnings.length > 1 ? "s" : ""} détecté${footprint.warnings.length > 1 ? "s" : ""}. ${topWarning}`,
      category: "warning",
      severity: "warning",
      source,
      created_at: now,
      read_only: true,
      metadata: { warnings_count: footprint.warnings.length },
    });
  }

  return items;
}

// ── Recommendations builder ───────────────────────────────────────────────────

export function buildEnterpriseFootprintMessagesFeedRecommendations(
  footprint: EnterpriseFootprint | null
): EnterpriseFootprintMessagesFeedRecommendation[] {
  if (!footprint) {
    return [
      {
        id: "rec-create",
        text: "Créer l'Empreinte Entreprise dans l'onboarding.",
        href: "/profile/onboarding",
        action_label: "Aller à l'onboarding",
      },
    ];
  }

  const recs: EnterpriseFootprintMessagesFeedRecommendation[] = [];
  const approvers = footprint.humans.filter((h) => h.is_approver);

  if (approvers.length === 0) {
    recs.push({
      id: "rec-approver",
      text: "Ajouter un approbateur avant les futures validations sensibles.",
      href: "/profile/onboarding",
      action_label: "Configurer",
    });
  }

  if (footprint.approval_rules.length === 0) {
    recs.push({
      id: "rec-rules",
      text: "Définir les règles de validation dans l'onboarding.",
      href: "/profile/onboarding",
      action_label: "Configurer",
    });
  }

  if (footprint.documents.length === 0) {
    recs.push({
      id: "rec-docs",
      text: "Référencer les documents nécessaires.",
      href: "/profile/onboarding",
      action_label: "Configurer",
    });
  }

  if (footprint.readiness_score.score >= 60) {
    recs.push({
      id: "rec-ready",
      text: "Le contexte est exploitable en lecture seule pour guider les messages.",
      href: "/agents/pierre/use",
      action_label: "Cockpit Pierre",
    });
  }

  return recs;
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildEnterpriseFootprintMessagesFeedActions(
  result: {
    has_footprint: boolean;
    summary: EnterpriseFootprintMessagesFeedSummary | null;
  }
): EnterpriseFootprintMessagesFeedAction[] {
  const actions: EnterpriseFootprintMessagesFeedAction[] = [
    {
      id: "go-onboarding",
      label: result.has_footprint ? "Modifier l'Empreinte" : "Créer l'Empreinte Entreprise",
      href: "/profile/onboarding",
      primary: !result.has_footprint,
    },
    {
      id: "go-agents",
      label: "Empreinte dans Mon espace",
      href: "/profile/agents#empreinte-entreprise",
      primary: false,
    },
  ];

  if (result.has_footprint) {
    actions.push(
      {
        id: "go-technologies",
        label: "Technologies",
        href: "/profile/technologies",
        primary: false,
      },
      {
        id: "go-pierre-setup",
        label: "Pierre Setup",
        href: "/agents/pierre/setup",
        primary: false,
      },
      {
        id: "go-pierre-use",
        label: "Cockpit Pierre",
        href: "/agents/pierre/use",
        primary: true,
      }
    );
  }

  return actions;
}

// ── Main loader ───────────────────────────────────────────────────────────────
// Client-safe. Pas de Supabase. Pas de DB. Pas de POST. Pas de throw brut.
//
// Délègue à loadEnterpriseFootprintForCockpit() qui gère la chaîne complète :
//   1. snapshot localStorage (enterprise_footprint_snapshot)
//   2. onboarding_draft_fallback via loadGlobalOnboardingDraftFromLocalStorage
//   3. empty state avec CTA /profile/onboarding
//
// localStorage reste le fallback actif.

export function loadEnterpriseFootprintForMessagesFeed(): EnterpriseFootprintMessagesFeedReadResult {
  if (typeof window === "undefined") {
    return buildEmptyEnterpriseFootprintMessagesFeedState();
  }

  try {
    const cockpitResult = loadEnterpriseFootprintForCockpit();

    if (!cockpitResult.has_footprint || !cockpitResult.footprint) {
      return buildEmptyEnterpriseFootprintMessagesFeedState();
    }

    const fp = cockpitResult.footprint;

    // Mapper la source cockpit → source feed
    const source: EnterpriseFootprintMessagesFeedSource =
      cockpitResult.source === "enterprise_footprint_snapshot"
        ? "enterprise_footprint_snapshot"
        : cockpitResult.source === "onboarding_draft_fallback"
        ? "onboarding_draft_fallback"
        : "empty";

    const summary = buildEnterpriseFootprintMessagesFeedSummary(fp, source);
    const cards = buildEnterpriseFootprintMessagesFeedCards(fp);
    const items = buildEnterpriseFootprintMessagesFeedItems(fp, source);
    const recommendations = buildEnterpriseFootprintMessagesFeedRecommendations(fp);
    const actions = buildEnterpriseFootprintMessagesFeedActions({ has_footprint: true, summary });

    return {
      footprint: fp,
      source,
      summary,
      cards,
      items,
      recommendations,
      actions,
      has_footprint: true,
    };
  } catch {
    return buildEmptyEnterpriseFootprintMessagesFeedState();
  }
}
