// src/lib/clonestore/messages/message-center-types.ts
// PHASE 3.1 — Messages Real Data Read-Only Hook — Types
//
// Types partagés pour le centre de messagerie 4 onglets.
// Lecture seule. Aucune écriture en DB. Aucune exécution.

// ── 4 onglets exacts PHASE 2.5 ──────────────────────────────────────────────
// Invariant absolu : jamais plus, jamais moins que ces 4 onglets.

export type MessageCenterTab =
  | "suivis"
  | "briefings"
  | "livraisons"
  | "alertes";

// ── Priorité ─────────────────────────────────────────────────────────────────

export type MessageCenterPriority = "low" | "normal" | "high" | "urgent";

// ── Statut ────────────────────────────────────────────────────────────────────

export type MessageCenterStatus =
  | "unread"
  | "read"
  | "pending"
  | "done"
  | "blocked"
  | "requires_validation"
  | "delivered"
  | "archived";

// ── Source ────────────────────────────────────────────────────────────────────
// "supabase" = données lues depuis la DB en lecture seule.

export type MessageCenterSource =
  | "cloneos"
  | "clonetrace"
  | "clonebrief"
  | "cloneguard"
  | "pierre"
  | "system"
  | "supabase";

// ── Actions ───────────────────────────────────────────────────────────────────
// read_only = action désactivée côté UI (pointer-events-none).

export type MessageCenterActionKind =
  | "open_cockpit_pierre"
  | "open_technologies"
  | "open_cockpit"
  | "validate"
  | "read_only"
  | "archive";

// ── Mode données ──────────────────────────────────────────────────────────────
// Décrit l'origine des données affichées :
//   real_readonly   = données réelles depuis Supabase, lecture seule
//   demo_fallback   = données de démonstration structurées (PHASE 2.5)
//   empty           = aucune donnée disponible
//   auth_required   = non connecté, données réelles non accessibles
//   error           = erreur lors du chargement, fallback appliqué

export type MessageCenterDataMode =
  | "real_readonly"
  | "demo_fallback"
  | "empty"
  | "auth_required"
  | "error";

// ── État de chargement ────────────────────────────────────────────────────────

export type MessageCenterLoadState = {
  loading: boolean;
  mode: MessageCenterDataMode;
  error: string | null;
  realCount: number;
};

// ── Item principal ────────────────────────────────────────────────────────────
// MessageCenterItem est le type canonique utilisé par la couche messages.
// is_real_data = true si l'item vient de Supabase.
// read_only = toujours true pour les données réelles ; true pour la démo aussi.

export type MessageCenterItem = {
  id: string;
  tab: MessageCenterTab;
  title: string;
  summary: string;
  priority: MessageCenterPriority;
  status: MessageCenterStatus;
  source: MessageCenterSource;
  employee_slug?: string;
  created_at: string;
  updated_at?: string;
  tags: string[];
  action_kind?: MessageCenterActionKind;
  action_label?: string;
  href?: string;
  metadata: Record<string, unknown>;
  is_real_data: boolean;
  read_only: true; // invariant absolu — jamais false
};

// ── Résultat du chargement read-only ─────────────────────────────────────────

export type MessageCenterReadOnlyResult = {
  items: MessageCenterItem[];
  mode: MessageCenterDataMode;
  error: string | null;
  real_count: number;
  fallback_count: number;
};

// ── Alerte tab logic helpers ──────────────────────────────────────────────────
// Statuts qui forcent le tab "alertes" indépendamment de l'onglet par défaut.

export const ALERT_TAB_STATUSES: MessageCenterStatus[] = [
  "blocked",
  "requires_validation",
];

export const ALERT_STATUS_STRINGS = [
  "blocked",
  "failed",
  "error",
  "requires_validation",
  "refused",
  "refused_guard",
];

// ── Constants ─────────────────────────────────────────────────────────────────

export const MESSAGE_CENTER_MAX_ITEMS_PER_TABLE = 20;
export const MESSAGE_CENTER_MAX_TOTAL_ITEMS = 80;

// Garde-fous wording interdit dans les items réels
export const UNSAFE_WORDING_PATTERNS = [
  "public launch go",
  "zéro erreur",
  "zero erreur",
  "conformité garantie",
  "conformite garantie",
  "clonevoice actif production",
  "mission exécutée avec succès",
  "document généré avec succès",
  "email envoyé avec succès",
] as const;
