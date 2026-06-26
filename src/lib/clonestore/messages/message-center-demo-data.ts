// src/lib/clonestore/messages/message-center-demo-data.ts
// PHASE 3.1 — Messages Real Data Read-Only Hook — Données de démonstration
//
// Données de démonstration structurées et honnêtes.
// Ces items sont affichés quand aucune donnée réelle n'est disponible
// (non connecté, tables vides, Supabase non configuré).
//
// Invariants :
//   - is_real_data = false
//   - read_only = true
//   - pas de "email envoyé réel"
//   - pas de "document généré réel"
//   - pas de "mission exécutée réelle"
//   - "données de démonstration" ou "aperçu local"

import type {
  MessageCenterItem,
  MessageCenterDataMode,
  MessageCenterReadOnlyResult,
} from "./message-center-types";

const DEMO_TIMESTAMP_BASE = new Date("2026-06-03T09:00:00Z").getTime();

function demoTimestamp(minutesAgo: number): string {
  return new Date(DEMO_TIMESTAMP_BASE - minutesAgo * 60 * 1000).toISOString();
}

// ── Données de démonstration ──────────────────────────────────────────────────

export function buildDemoMessageCenterItems(): MessageCenterItem[] {
  return [
    // ── Suivis ────────────────────────────────────────────────────────────────
    {
      id: "demo-suivi-cloneos-001",
      tab: "suivis",
      title: "Demande RH analysée par CloneOS",
      summary:
        "CloneOS a classifié la demande, routé Pierre et préparé un plan de mission — données de démonstration locale. Lecture seule, aucune action exécutée.",
      priority: "high",
      status: "pending",
      source: "cloneos",
      employee_slug: "pierre",
      created_at: demoTimestamp(45),
      updated_at: demoTimestamp(18),
      tags: ["CloneOS", "plan préparé", "non exécuté", "RH", "démo"],
      action_kind: "open_cockpit_pierre",
      action_label: "Ouvrir le cockpit Pierre",
      href: "/agents/pierre/use",
      metadata: { demo: true, plan_only: true },
      is_real_data: false,
      read_only: true,
    },
    {
      id: "demo-suivi-absence-001",
      tab: "suivis",
      title: "Suivi d'absence — information manquante",
      summary:
        "Pierre a identifié un dossier d'absence incomplet. Information manquante avant de continuer. Données de démonstration.",
      priority: "high",
      status: "pending",
      source: "pierre",
      employee_slug: "pierre",
      created_at: demoTimestamp(90),
      updated_at: demoTimestamp(30),
      tags: ["absence", "information manquante", "dossier incomplet", "démo"],
      action_kind: "open_cockpit_pierre",
      action_label: "Compléter dans le cockpit",
      href: "/agents/pierre/use",
      metadata: { demo: true },
      is_real_data: false,
      read_only: true,
    },
    {
      id: "demo-suivi-onboarding-001",
      tab: "suivis",
      title: "Plan d'onboarding préparé — non exécuté",
      summary:
        "Pierre a préparé les étapes d'onboarding. Plan prêt à validation humaine avant toute exécution. Données de démonstration.",
      priority: "normal",
      status: "pending",
      source: "pierre",
      employee_slug: "pierre",
      created_at: demoTimestamp(48),
      updated_at: demoTimestamp(16),
      tags: ["onboarding", "plan préparé", "non exécuté", "validation requise", "démo"],
      action_kind: "validate",
      action_label: "Valider dans le cockpit Pierre",
      href: "/agents/pierre/use",
      metadata: { demo: true },
      is_real_data: false,
      read_only: true,
    },

    // ── Briefings ─────────────────────────────────────────────────────────────
    {
      id: "demo-brief-daily-001",
      tab: "briefings",
      title: "Briefing du jour — activité Pierre",
      summary:
        "Synthèse CloneBrief des actions du jour : missions analysées, validations en attente, blocages. Données de démonstration.",
      priority: "normal",
      status: "delivered",
      source: "clonebrief",
      employee_slug: "pierre",
      created_at: demoTimestamp(120),
      updated_at: demoTimestamp(110),
      tags: ["briefing", "quotidien", "CloneBrief", "synthèse", "démo"],
      action_kind: "open_cockpit",
      action_label: "Lire dans Mon espace",
      href: "/profile/agents",
      metadata: { demo: true, brief_type: "daily" },
      is_real_data: false,
      read_only: true,
    },
    {
      id: "demo-brief-validations-001",
      tab: "briefings",
      title: "Synthèse des validations en attente",
      summary:
        "CloneBrief liste les actions qui nécessitent votre décision avant toute exécution. Données de démonstration.",
      priority: "high",
      status: "pending",
      source: "clonebrief",
      employee_slug: "pierre",
      created_at: demoTimestamp(35),
      updated_at: demoTimestamp(20),
      tags: ["validations", "briefing", "CloneGuard", "en attente", "démo"],
      action_kind: "open_cockpit_pierre",
      action_label: "Cockpit Pierre",
      href: "/agents/pierre/use",
      metadata: { demo: true, brief_type: "validation" },
      is_real_data: false,
      read_only: true,
    },

    // ── Livraisons ────────────────────────────────────────────────────────────
    {
      id: "demo-delivery-document-001",
      tab: "livraisons",
      title: "Brouillon de document RH prêt à validation",
      summary:
        "Pierre a préparé un document RH. Il est en attente de validation humaine — non signé, non envoyé. Données de démonstration.",
      priority: "high",
      status: "delivered",
      source: "pierre",
      employee_slug: "pierre",
      created_at: demoTimestamp(240),
      updated_at: demoTimestamp(210),
      tags: ["livrable", "document RH", "validation requise", "non envoyé", "démo"],
      action_kind: "open_cockpit_pierre",
      action_label: "Ouvrir dans le cockpit Pierre",
      href: "/agents/pierre/use",
      metadata: { demo: true, document_type: "hr_document" },
      is_real_data: false,
      read_only: true,
    },
    {
      id: "demo-delivery-email-001",
      tab: "livraisons",
      title: "Brouillon d'email préparé — non envoyé",
      summary:
        "Pierre a rédigé un email RH. Il est en attente de validation humaine avant envoi éventuel. Données de démonstration.",
      priority: "high",
      status: "pending",
      source: "pierre",
      employee_slug: "pierre",
      created_at: demoTimestamp(60),
      updated_at: demoTimestamp(40),
      tags: ["email", "brouillon", "non envoyé", "validation", "démo"],
      action_kind: "open_cockpit_pierre",
      action_label: "Voir le brouillon",
      href: "/agents/pierre/use",
      metadata: { demo: true, email_type: "outbound_draft" },
      is_real_data: false,
      read_only: true,
    },

    // ── Alertes ───────────────────────────────────────────────────────────────
    {
      id: "demo-alert-validation-001",
      tab: "alertes",
      title: "Validation humaine requise — action sensible",
      summary:
        "CloneGuard a détecté un sujet sensible. L'action reste bloquée en attente de décision humaine. Données de démonstration.",
      priority: "urgent",
      status: "requires_validation",
      source: "cloneguard",
      employee_slug: "pierre",
      created_at: demoTimestamp(32),
      updated_at: demoTimestamp(28),
      tags: ["validation humaine", "CloneGuard", "sensible", "bloqué", "démo"],
      action_kind: "open_cockpit_pierre",
      action_label: "Décider dans le cockpit Pierre",
      href: "/agents/pierre/use",
      metadata: { demo: true, guard_decision: "require_validation" },
      is_real_data: false,
      read_only: true,
    },
    {
      id: "demo-alert-refused-001",
      tab: "alertes",
      title: "Action refusée — invariant absolu CloneGuard",
      summary:
        "Paie officielle, licenciement, décision légale ou signature de contrat : refusés en autonomie IA. Données de démonstration.",
      priority: "urgent",
      status: "blocked",
      source: "cloneguard",
      created_at: demoTimestamp(15),
      updated_at: demoTimestamp(10),
      tags: ["refusé", "invariant absolu", "paie", "licenciement", "légal", "démo"],
      action_kind: "open_technologies",
      action_label: "Voir les règles Guard",
      href: "/profile/technologies",
      metadata: { demo: true, guard_decision: "refuse" },
      is_real_data: false,
      read_only: true,
    },
  ];
}

export function buildEmptyMessageCenterItems(): MessageCenterItem[] {
  return [];
}

export function buildFallbackMessageCenterResult(
  reason: "demo" | "auth_required" | "error" | "empty"
): MessageCenterReadOnlyResult {
  const mode =
    reason === "auth_required"
      ? "auth_required"
      : reason === "error"
        ? "error"
        : reason === "empty"
          ? "demo_fallback"
          : "demo_fallback";

  const items =
    reason === "empty" ? buildEmptyMessageCenterItems() : buildDemoMessageCenterItems();

  return {
    items,
    mode,
    error:
      reason === "error"
        ? "Erreur lors du chargement des données réelles — aperçu démo affiché."
        : reason === "auth_required"
          ? "Connexion requise pour charger vos données réelles."
          : null,
    real_count: 0,
    fallback_count: items.length,
  };
}

// ── Badge labels ──────────────────────────────────────────────────────────────
// Utilisés dans la page pour afficher l'état des données.

export const DATA_MODE_LABELS: Record<MessageCenterDataMode, string> = {
  real_readonly: "Données réelles — lecture seule",
  demo_fallback: "Démo locale — aucune donnée réelle chargée",
  empty: "Aucune donnée disponible",
  auth_required: "Connexion requise pour charger vos données",
  error: "Aperçu démo — données réelles non disponibles",
};
