// src/lib/clonestore/messages/profile-messages-cloneos-history-feed.ts
// PHASE 3.17 — Profile Messages CloneOS History Feed Merge
//
// Bridge read-only localStorage-only autour de l'historique CloneOS local.
// Réutilise loadCloneOSHistoryItemsFromLocalStorage() (PHASE 2.4 / 3.2).
//
// INVARIANTS ABSOLUS :
//   - localStorage uniquement (pas de Supabase, pas d'API, pas de POST)
//   - read-only : aucune écriture DB, aucune exécution CloneOS
//   - client-safe : typeof window checks (déléguée au loader localStorage)
//   - jamais de throw brut
//   - jamais d'import src/lib/pierre

import {
  loadCloneOSHistoryItemsFromLocalStorage,
} from "@/lib/clonestore/cloneos-history";
import type {
  CloneOSHistoryItem,
  CloneOSHistoryStatus,
} from "@/lib/clonestore/cloneos-history";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProfileMessagesCloneOSHistorySource =
  | "cloneos_history_localstorage"  // depuis clonestore.cloneos.commandHistory.v1
  | "empty";                        // aucun historique disponible

export type ProfileMessagesCloneOSHistoryStatus =
  | "available"   // historique présent
  | "empty"       // aucun historique
  | "loading";    // chargement en cours

export type ProfileMessagesCloneOSHistoryItem = {
  id: string;
  title: string;
  body: string;
  category: "request" | "validation" | "blocked" | "refused" | "plan";
  severity: "info" | "warning" | "blocking";
  source: ProfileMessagesCloneOSHistorySource;
  created_at: string;
  read_only: true;
  action_label?: string;
  action_href?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type ProfileMessagesCloneOSHistorySummary = {
  status: ProfileMessagesCloneOSHistoryStatus;
  status_label: string;
  source: ProfileMessagesCloneOSHistorySource;
  source_label: string;
  total_count: number;
  validation_required_count: number;
  blocked_count: number;
  refused_count: number;
  read_only: true;
  updated_at: string;
};

export type ProfileMessagesCloneOSHistoryAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
};

export type ProfileMessagesCloneOSHistoryReadResult = {
  items: ProfileMessagesCloneOSHistoryItem[];
  source: ProfileMessagesCloneOSHistorySource;
  summary: ProfileMessagesCloneOSHistorySummary;
  actions: ProfileMessagesCloneOSHistoryAction[];
  has_history: boolean;
};

// ── Labels ────────────────────────────────────────────────────────────────────

export function getProfileMessagesCloneOSHistoryStatusLabel(
  status: ProfileMessagesCloneOSHistoryStatus
): string {
  const labels: Record<ProfileMessagesCloneOSHistoryStatus, string> = {
    available: "Historique disponible",
    empty: "Aucun historique",
    loading: "Chargement…",
  };
  return labels[status] ?? "Inconnu";
}

export function getProfileMessagesCloneOSHistorySourceLabel(
  source: ProfileMessagesCloneOSHistorySource
): string {
  const labels: Record<ProfileMessagesCloneOSHistorySource, string> = {
    cloneos_history_localstorage: "Historique CloneOS local",
    empty: "Aucune donnée",
  };
  return labels[source] ?? "Inconnu";
}

// ── Status helper ─────────────────────────────────────────────────────────────

function statusToFrLabel(status: CloneOSHistoryStatus): string {
  const labels: Partial<Record<CloneOSHistoryStatus, string>> = {
    received: "Reçue",
    classified: "Classifiée",
    routed: "Routée",
    planned: "Plan préparé",
    guarded: "Évaluée Guard",
    trace_ready: "Trace prête",
    ready_for_execution: "Prête (plan-only)",
    requires_validation: "Validation requise",
    blocked: "Bloquée",
    refused: "Refusée",
    failed: "Échec",
    unknown: "Inconnu",
  };
  return labels[status] ?? "Inconnu";
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function buildEmptyProfileMessagesCloneOSHistoryFeed(): ProfileMessagesCloneOSHistoryReadResult {
  const now = new Date().toISOString();
  return {
    items: [],
    source: "empty",
    summary: {
      status: "empty",
      status_label: getProfileMessagesCloneOSHistoryStatusLabel("empty"),
      source: "empty",
      source_label: getProfileMessagesCloneOSHistorySourceLabel("empty"),
      total_count: 0,
      validation_required_count: 0,
      blocked_count: 0,
      refused_count: 0,
      read_only: true,
      updated_at: now,
    },
    actions: [
      {
        id: "open-pierre-use",
        label: "Ouvrir le cockpit Pierre",
        href: "/agents/pierre/use",
        primary: false,
        description: "Lancer une demande pour générer un historique CloneOS local.",
      },
    ],
    has_history: false,
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildProfileMessagesCloneOSHistorySummary(
  history: CloneOSHistoryItem[]
): ProfileMessagesCloneOSHistorySummary {
  const now = new Date().toISOString();
  if (history.length === 0) {
    return buildEmptyProfileMessagesCloneOSHistoryFeed().summary;
  }

  const validationRequired = history.filter((h) => h.human_validation_required).length;
  const blocked = history.filter((h) => h.blocked).length;
  const refused = history.filter((h) => h.refused).length;

  return {
    status: "available",
    status_label: getProfileMessagesCloneOSHistoryStatusLabel("available"),
    source: "cloneos_history_localstorage",
    source_label: getProfileMessagesCloneOSHistorySourceLabel("cloneos_history_localstorage"),
    total_count: history.length,
    validation_required_count: validationRequired,
    blocked_count: blocked,
    refused_count: refused,
    read_only: true,
    updated_at: history[0]?.updated_at ?? now,
  };
}

// ── Items builder ─────────────────────────────────────────────────────────────

export function buildProfileMessagesCloneOSHistoryItems(
  history: CloneOSHistoryItem[]
): ProfileMessagesCloneOSHistoryItem[] {
  return history.map((h) => {
    const category: ProfileMessagesCloneOSHistoryItem["category"] =
      h.refused ? "refused"
      : h.blocked ? "blocked"
      : h.human_validation_required ? "validation"
      : h.mission_title ? "plan"
      : "request";

    const severity: ProfileMessagesCloneOSHistoryItem["severity"] =
      h.refused || h.blocked ? "blocking"
      : h.human_validation_required ? "warning"
      : "info";

    const statusLabel = statusToFrLabel(h.status);
    const employeePart = h.employee_display_name
      ? ` — ${h.employee_display_name}`
      : "";
    const missionPart = h.mission_title ? ` Plan : ${h.mission_title}.` : "";

    return {
      id: `cloneos-history-${h.command_id}`,
      title: h.raw_request_summary || "Demande CloneOS",
      body: `${statusLabel}${employeePart}.${missionPart} Lecture seule — plan-only, aucune action exécutée.`,
      category,
      severity,
      source: "cloneos_history_localstorage" as const,
      created_at: h.created_at,
      read_only: true,
      action_label: "Ouvrir le cockpit Pierre",
      action_href: "/agents/pierre/use",
      metadata: {
        command_id: h.command_id,
        domain: h.domain,
        status: h.status,
        risk_level: h.risk_level,
        task_count: h.task_count,
        plan_only: true,
      },
    };
  });
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildProfileMessagesCloneOSHistoryActions(
  result: { has_history: boolean }
): ProfileMessagesCloneOSHistoryAction[] {
  const actions: ProfileMessagesCloneOSHistoryAction[] = [
    {
      id: "open-pierre-use",
      label: "Cockpit Pierre",
      href: "/agents/pierre/use",
      primary: result.has_history,
    },
    {
      id: "open-agents",
      label: "Mon espace",
      href: "/profile/agents",
      primary: false,
    },
  ];
  return actions;
}

// ── Main loader ───────────────────────────────────────────────────────────────
// Read-only. localStorage uniquement. Aucun Supabase. Aucun POST.
// Aucune exécution CloneOS. Jamais de throw brut.

export function loadProfileMessagesCloneOSHistoryFeed(): ProfileMessagesCloneOSHistoryReadResult {
  try {
    const history = loadCloneOSHistoryItemsFromLocalStorage();

    if (!history || history.length === 0) {
      return buildEmptyProfileMessagesCloneOSHistoryFeed();
    }

    const summary = buildProfileMessagesCloneOSHistorySummary(history);
    const items = buildProfileMessagesCloneOSHistoryItems(history);
    const actions = buildProfileMessagesCloneOSHistoryActions({ has_history: true });

    return {
      items,
      source: "cloneos_history_localstorage",
      summary,
      actions,
      has_history: true,
    };
  } catch {
    return buildEmptyProfileMessagesCloneOSHistoryFeed();
  }
}
