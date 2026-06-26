// src/lib/clonestore/messages/profile-messages-context-feed.ts
// PHASE 3.17 — Profile Messages CloneOS History Feed Merge — Context Feed unifié
//
// Fusionne le feed Empreinte Entreprise (P3.16) avec l'historique CloneOS local
// pour fournir une source unique à /profile/messages.
//
// INVARIANTS ABSOLUS :
//   - read-only : aucune écriture DB, aucun POST, aucun message envoyé
//   - aucune exécution CloneOS
//   - localStorage uniquement (délégué aux bridges réutilisés)
//   - pas d'import Supabase, pas d'import src/lib/pierre, pas de fetch
//   - jamais de throw brut

import {
  loadEnterpriseFootprintForMessagesFeed,
  type EnterpriseFootprintMessagesFeedReadResult,
} from "@/lib/clonestore/enterprise-footprint";
import {
  loadProfileMessagesCloneOSHistoryFeed,
  type ProfileMessagesCloneOSHistoryReadResult,
} from "./profile-messages-cloneos-history-feed";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProfileMessagesContextFeedSource =
  | "enterprise_footprint"   // contexte Empreinte Entreprise
  | "cloneos_history"        // historique CloneOS local
  | "merged"                 // les deux sources présentes
  | "empty";                 // aucune source

export type ProfileMessagesContextFeedStatus =
  | "ready"          // au moins une source disponible
  | "empty"          // aucune source
  | "loading";       // chargement en cours

export type ProfileMessagesContextFeedItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  source: ProfileMessagesContextFeedSource;
  severity: "info" | "warning" | "blocking";
  created_at: string;
  read_only: true;
  action_label?: string;
  action_href?: string;
};

export type ProfileMessagesContextFeedSectionKind =
  | "enterprise_footprint"
  | "cloneos_history"
  | "recommendations"
  | "empty_state";

export type ProfileMessagesContextFeedSection = {
  id: string;
  kind: ProfileMessagesContextFeedSectionKind;
  title: string;
  description: string;
  items: ProfileMessagesContextFeedItem[];
  read_only: true;
};

export type ProfileMessagesContextFeedRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type ProfileMessagesContextFeedAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
};

export type ProfileMessagesContextFeedSummary = {
  status: ProfileMessagesContextFeedStatus;
  status_label: string;
  source: ProfileMessagesContextFeedSource;
  source_label: string;
  company_name: string;
  has_enterprise_footprint: boolean;
  has_cloneos_history: boolean;
  enterprise_items_count: number;
  cloneos_items_count: number;
  total_items_count: number;
  warnings_count: number;
  actions_count: number;
  read_only: true;
  updated_at: string;
};

export type ProfileMessagesContextFeedReadResult = {
  source: ProfileMessagesContextFeedSource;
  summary: ProfileMessagesContextFeedSummary;
  sections: ProfileMessagesContextFeedSection[];
  items: ProfileMessagesContextFeedItem[];
  recommendations: ProfileMessagesContextFeedRecommendation[];
  actions: ProfileMessagesContextFeedAction[];
  has_enterprise_footprint: boolean;
  has_cloneos_history: boolean;
};

// Limite d'affichage pour ne pas surcharger /profile/messages.
const CONTEXT_FEED_MAX_ITEMS = 8;

// ── Labels ────────────────────────────────────────────────────────────────────

export function getProfileMessagesContextFeedStatusLabel(
  status: ProfileMessagesContextFeedStatus
): string {
  const labels: Record<ProfileMessagesContextFeedStatus, string> = {
    ready: "Contexte disponible",
    empty: "Aucun contexte",
    loading: "Chargement…",
  };
  return labels[status] ?? "Inconnu";
}

export function getProfileMessagesContextFeedSourceLabel(
  source: ProfileMessagesContextFeedSource
): string {
  const labels: Record<ProfileMessagesContextFeedSource, string> = {
    enterprise_footprint: "Empreinte Entreprise",
    cloneos_history: "Historique CloneOS local",
    merged: "Empreinte + Historique CloneOS",
    empty: "Aucune donnée",
  };
  return labels[source] ?? "Inconnu";
}

// ── Source resolver ───────────────────────────────────────────────────────────

function resolveContextSource(
  hasEnterprise: boolean,
  hasCloneOS: boolean
): ProfileMessagesContextFeedSource {
  if (hasEnterprise && hasCloneOS) return "merged";
  if (hasEnterprise) return "enterprise_footprint";
  if (hasCloneOS) return "cloneos_history";
  return "empty";
}

// ── Items mappers ─────────────────────────────────────────────────────────────

function mapEnterpriseItems(
  enterpriseFeed: EnterpriseFootprintMessagesFeedReadResult
): ProfileMessagesContextFeedItem[] {
  return enterpriseFeed.items.map((item) => ({
    id: `ctx-${item.id}`,
    title: item.title,
    body: item.body,
    category: item.category,
    source: "enterprise_footprint" as const,
    severity: item.severity,
    created_at: item.created_at,
    read_only: true,
    action_label: item.action_label,
    action_href: item.action_href,
  }));
}

function mapCloneOSItems(
  cloneosHistory: ProfileMessagesCloneOSHistoryReadResult
): ProfileMessagesContextFeedItem[] {
  return cloneosHistory.items.map((item) => ({
    id: `ctx-${item.id}`,
    title: item.title,
    body: item.body,
    category: item.category,
    source: "cloneos_history" as const,
    severity: item.severity,
    created_at: item.created_at,
    read_only: true,
    action_label: item.action_label,
    action_href: item.action_href,
  }));
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildProfileMessagesContextFeedSummary(
  enterpriseFeed: EnterpriseFootprintMessagesFeedReadResult,
  cloneosHistory: ProfileMessagesCloneOSHistoryReadResult
): ProfileMessagesContextFeedSummary {
  const hasEnterprise = enterpriseFeed.has_footprint;
  const hasCloneOS = cloneosHistory.has_history;
  const source = resolveContextSource(hasEnterprise, hasCloneOS);
  const status: ProfileMessagesContextFeedStatus =
    hasEnterprise || hasCloneOS ? "ready" : "empty";

  const enterpriseItemsCount = enterpriseFeed.items.length;
  const cloneosItemsCount = cloneosHistory.items.length;
  const warningsCount =
    (enterpriseFeed.summary?.warnings_count ?? 0) +
    cloneosHistory.summary.blocked_count +
    cloneosHistory.summary.refused_count;

  return {
    status,
    status_label: getProfileMessagesContextFeedStatusLabel(status),
    source,
    source_label: getProfileMessagesContextFeedSourceLabel(source),
    company_name: enterpriseFeed.summary?.company_name ?? "",
    has_enterprise_footprint: hasEnterprise,
    has_cloneos_history: hasCloneOS,
    enterprise_items_count: enterpriseItemsCount,
    cloneos_items_count: cloneosItemsCount,
    total_items_count: enterpriseItemsCount + cloneosItemsCount,
    warnings_count: warningsCount,
    actions_count: enterpriseFeed.actions.length + cloneosHistory.actions.length,
    read_only: true,
    updated_at: new Date().toISOString(),
  };
}

// ── Sections builder ──────────────────────────────────────────────────────────
// Merge rules :
//   1. Toujours afficher le contexte Empreinte si disponible.
//   2. Toujours afficher l'historique CloneOS si disponible.
//   3. Si les deux absents → empty state unique.
//   4. Empreinte sans CloneOS → item "Aucun historique CloneOS local disponible."
//   5. CloneOS sans Empreinte → item "Historique CloneOS disponible, mais Empreinte manquante."

export function buildProfileMessagesContextFeedSections(
  enterpriseFeed: EnterpriseFootprintMessagesFeedReadResult,
  cloneosHistory: ProfileMessagesCloneOSHistoryReadResult
): ProfileMessagesContextFeedSection[] {
  const hasEnterprise = enterpriseFeed.has_footprint;
  const hasCloneOS = cloneosHistory.has_history;
  const now = new Date().toISOString();

  // Cas 3 : rien
  if (!hasEnterprise && !hasCloneOS) {
    return [
      {
        id: "section-empty",
        kind: "empty_state",
        title: "Contexte système indisponible",
        description: "Aucun contexte système disponible pour l'instant.",
        read_only: true,
        items: [
          {
            id: "ctx-empty",
            title: "Aucun contexte système disponible pour l'instant.",
            body: "Configurez l'Empreinte Entreprise et lancez une demande CloneOS pour enrichir ce feed. Lecture seule — aucune action exécutée.",
            category: "empty",
            source: "empty",
            severity: "info",
            created_at: now,
            read_only: true,
            action_label: "Configurer dans l'onboarding",
            action_href: "/profile/onboarding",
          },
        ],
      },
    ];
  }

  const sections: ProfileMessagesContextFeedSection[] = [];

  // Section Empreinte Entreprise
  if (hasEnterprise) {
    sections.push({
      id: "section-enterprise",
      kind: "enterprise_footprint",
      title: "Empreinte Entreprise",
      description: "Contexte entreprise connu — lecture seule.",
      read_only: true,
      items: mapEnterpriseItems(enterpriseFeed).slice(0, 4),
    });
  }

  // Section Historique CloneOS
  if (hasCloneOS) {
    sections.push({
      id: "section-cloneos",
      kind: "cloneos_history",
      title: "Historique CloneOS",
      description: "Dernières demandes CloneOS locales — plan-only, aucune action exécutée.",
      read_only: true,
      items: mapCloneOSItems(cloneosHistory).slice(0, 4),
    });
  } else if (hasEnterprise) {
    // Cas 4 : Empreinte sans CloneOS history
    sections.push({
      id: "section-cloneos-empty",
      kind: "cloneos_history",
      title: "Historique CloneOS",
      description: "Aucune demande CloneOS locale enregistrée.",
      read_only: true,
      items: [
        {
          id: "ctx-cloneos-empty",
          title: "Aucun historique CloneOS local disponible.",
          body: "Lancez une demande depuis le cockpit Pierre pour générer un historique local. Lecture seule.",
          category: "empty",
          source: "cloneos_history",
          severity: "info",
          created_at: now,
          read_only: true,
          action_label: "Cockpit Pierre",
          action_href: "/agents/pierre/use",
        },
      ],
    });
  }

  // Cas 5 : CloneOS sans Empreinte → note dans la section CloneOS
  if (hasCloneOS && !hasEnterprise) {
    sections.unshift({
      id: "section-enterprise-missing",
      kind: "enterprise_footprint",
      title: "Empreinte Entreprise",
      description: "Empreinte Entreprise manquante.",
      read_only: true,
      items: [
        {
          id: "ctx-enterprise-missing",
          title: "Historique CloneOS disponible, mais Empreinte Entreprise manquante.",
          body: "Créez l'Empreinte Entreprise pour enrichir le contexte des messages. Lecture seule.",
          category: "empty",
          source: "enterprise_footprint",
          severity: "warning",
          created_at: now,
          read_only: true,
          action_label: "Créer l'Empreinte",
          action_href: "/profile/onboarding",
        },
      ],
    });
  }

  return sections;
}

// ── Items builder (flat, limité) ──────────────────────────────────────────────

export function buildProfileMessagesContextFeedItems(
  enterpriseFeed: EnterpriseFootprintMessagesFeedReadResult,
  cloneosHistory: ProfileMessagesCloneOSHistoryReadResult
): ProfileMessagesContextFeedItem[] {
  const enterpriseItems = enterpriseFeed.has_footprint
    ? mapEnterpriseItems(enterpriseFeed)
    : [];
  const cloneosItems = cloneosHistory.has_history
    ? mapCloneOSItems(cloneosHistory)
    : [];

  // Empreinte d'abord (contexte), puis historique CloneOS.
  return [...enterpriseItems, ...cloneosItems].slice(0, CONTEXT_FEED_MAX_ITEMS);
}

// ── Recommendations builder ───────────────────────────────────────────────────

export function buildProfileMessagesContextFeedRecommendations(
  enterpriseFeed: EnterpriseFootprintMessagesFeedReadResult,
  cloneosHistory: ProfileMessagesCloneOSHistoryReadResult
): ProfileMessagesContextFeedRecommendation[] {
  const recs: ProfileMessagesContextFeedRecommendation[] = [];

  // Réutiliser les recommendations Empreinte (déjà calculées P3.16).
  for (const rec of enterpriseFeed.recommendations) {
    recs.push({
      id: `ctx-${rec.id}`,
      text: rec.text,
      href: rec.href,
      action_label: rec.action_label,
    });
  }

  // Recommendation CloneOS si validations en attente.
  if (cloneosHistory.summary.validation_required_count > 0) {
    recs.push({
      id: "ctx-rec-cloneos-validation",
      text: `${cloneosHistory.summary.validation_required_count} demande(s) CloneOS en attente de validation humaine.`,
      href: "/agents/pierre/use",
      action_label: "Cockpit Pierre",
    });
  }

  if (!cloneosHistory.has_history && enterpriseFeed.has_footprint) {
    recs.push({
      id: "ctx-rec-launch-cloneos",
      text: "Lancer une demande CloneOS pour enrichir le contexte des messages.",
      href: "/agents/pierre/use",
      action_label: "Cockpit Pierre",
    });
  }

  return recs;
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildProfileMessagesContextFeedActions(
  result: {
    has_enterprise_footprint: boolean;
    has_cloneos_history: boolean;
  }
): ProfileMessagesContextFeedAction[] {
  const actions: ProfileMessagesContextFeedAction[] = [
    {
      id: "go-onboarding",
      label: result.has_enterprise_footprint ? "Modifier l'Empreinte" : "Créer l'Empreinte Entreprise",
      href: "/profile/onboarding",
      primary: !result.has_enterprise_footprint,
    },
    {
      id: "go-agents",
      label: "Empreinte dans Mon espace",
      href: "/profile/agents#empreinte-entreprise",
      primary: false,
    },
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
      primary: result.has_enterprise_footprint || result.has_cloneos_history,
    },
  ];
  return actions;
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function buildEmptyProfileMessagesContextFeed(): ProfileMessagesContextFeedReadResult {
  const now = new Date().toISOString();
  return {
    source: "empty",
    summary: {
      status: "empty",
      status_label: getProfileMessagesContextFeedStatusLabel("empty"),
      source: "empty",
      source_label: getProfileMessagesContextFeedSourceLabel("empty"),
      company_name: "",
      has_enterprise_footprint: false,
      has_cloneos_history: false,
      enterprise_items_count: 0,
      cloneos_items_count: 0,
      total_items_count: 0,
      warnings_count: 0,
      actions_count: 0,
      read_only: true,
      updated_at: now,
    },
    sections: [
      {
        id: "section-empty",
        kind: "empty_state",
        title: "Contexte système indisponible",
        description: "Aucun contexte système disponible pour l'instant.",
        read_only: true,
        items: [
          {
            id: "ctx-empty",
            title: "Aucun contexte système disponible pour l'instant.",
            body: "Configurez l'Empreinte Entreprise et lancez une demande CloneOS pour enrichir ce feed. Lecture seule — aucune action exécutée.",
            category: "empty",
            source: "empty",
            severity: "info",
            created_at: now,
            read_only: true,
            action_label: "Configurer dans l'onboarding",
            action_href: "/profile/onboarding",
          },
        ],
      },
    ],
    items: [],
    recommendations: [
      {
        id: "ctx-rec-create",
        text: "Créer l'Empreinte Entreprise dans l'onboarding.",
        href: "/profile/onboarding",
        action_label: "Aller à l'onboarding",
      },
    ],
    actions: buildProfileMessagesContextFeedActions({
      has_enterprise_footprint: false,
      has_cloneos_history: false,
    }),
    has_enterprise_footprint: false,
    has_cloneos_history: false,
  };
}

// ── Main loader ───────────────────────────────────────────────────────────────
// Read-only. localStorage uniquement (délégué aux bridges).
// Aucun Supabase. Aucun POST. Aucune exécution CloneOS. Jamais de throw brut.

export function loadProfileMessagesContextFeed(): ProfileMessagesContextFeedReadResult {
  try {
    const enterpriseFeed = loadEnterpriseFootprintForMessagesFeed();
    const cloneosHistory = loadProfileMessagesCloneOSHistoryFeed();

    const hasEnterprise = enterpriseFeed.has_footprint;
    const hasCloneOS = cloneosHistory.has_history;

    if (!hasEnterprise && !hasCloneOS) {
      return buildEmptyProfileMessagesContextFeed();
    }

    const summary = buildProfileMessagesContextFeedSummary(enterpriseFeed, cloneosHistory);
    const sections = buildProfileMessagesContextFeedSections(enterpriseFeed, cloneosHistory);
    const items = buildProfileMessagesContextFeedItems(enterpriseFeed, cloneosHistory);
    const recommendations = buildProfileMessagesContextFeedRecommendations(enterpriseFeed, cloneosHistory);
    const actions = buildProfileMessagesContextFeedActions({
      has_enterprise_footprint: hasEnterprise,
      has_cloneos_history: hasCloneOS,
    });

    return {
      source: summary.source,
      summary,
      sections,
      items,
      recommendations,
      actions,
      has_enterprise_footprint: hasEnterprise,
      has_cloneos_history: hasCloneOS,
    };
  } catch {
    return buildEmptyProfileMessagesContextFeed();
  }
}
