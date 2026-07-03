// src/lib/clonechat/types.ts
// P9.4 — Modèles canoniques CloneChat (couche cliente PURE, sans import serveur).
// Réutilise les modèles P9.3 (client-cockpit) ; ne duplique aucune logique métier P8.

import type {
  CockpitMissionSummary,
  CockpitValidation,
  CockpitArtifact,
  CockpitEmployeeListItem,
} from "@/lib/client-cockpit";

/** Mode de conversation : public (orientation) ou client authentifié (opérationnel). */
export type CloneChatMode = "public" | "authenticated";

/** Provenance d'un message/bloc — jamais masquée. */
export type CloneChatProvenance = "public" | "company" | "pierre" | "user" | "system";

export type CloneChatMessageRole = "user" | "assistant" | "system";

export type CloneChatMessageStatus = "sending" | "streaming" | "complete" | "failed";

// ── Blocs de contenu riches ─────────────────────────────────────────────────

export interface TextBlock { readonly type: "text"; readonly text: string; }

export interface MissionCardBlock { readonly type: "mission"; readonly mission: CockpitMissionSummary; }
export interface ValidationCardBlock { readonly type: "validation"; readonly validation: CockpitValidation; }
export interface EmployeeCardBlock { readonly type: "employee"; readonly employee: CockpitEmployeeListItem; }
export interface DocumentCardBlock { readonly type: "document"; readonly document: CockpitArtifact; }

export interface ActionPreviewBlock { readonly type: "action_preview"; readonly action: CloneChatProposedAction; }
export interface ErrorBlock { readonly type: "error"; readonly category: CloneChatErrorCategory; readonly message: string; readonly recovery: readonly CloneChatRecovery[]; }
/** Rappelle la source/limite : ex. « Réponse d'orientation — je n'accède pas à votre entreprise ». */
export interface SourceBoundaryBlock { readonly type: "boundary"; readonly text: string; readonly provenance: CloneChatProvenance; }

export type CloneChatContentBlock =
  | TextBlock
  | MissionCardBlock
  | ValidationCardBlock
  | EmployeeCardBlock
  | DocumentCardBlock
  | ActionPreviewBlock
  | ErrorBlock
  | SourceBoundaryBlock;

export interface CloneChatMessage {
  readonly id: string;
  readonly role: CloneChatMessageRole;
  readonly createdAt: string;
  readonly content: readonly CloneChatContentBlock[];
  readonly status: CloneChatMessageStatus;
  readonly provenance: CloneChatProvenance;
}

// ── Actions proposées (gouvernées) ──────────────────────────────────────────

export type CloneChatActionKind =
  | "create_mission"
  | "open_mission"
  | "open_validation"
  | "open_employee"
  | "open_document"
  | "cancel_mission"
  | "decide_validation"
  | "create_support_case"
  | "navigate";

export type CloneChatActionRisk = "low" | "sensitive" | "irreversible";

export interface CloneChatProposedAction {
  readonly id: string;
  readonly kind: CloneChatActionKind;
  readonly label: string;
  readonly risk: CloneChatActionRisk;
  readonly requiresConfirmation: boolean;
  readonly allowed: boolean;
  readonly reason: string | null;   // pourquoi non autorisé / pourquoi sensible
  readonly payload: Readonly<Record<string, unknown>>;
  /** Deep-link cockpit (identifiant opaque uniquement, jamais de contenu sensible). */
  readonly href: string | null;
  /** P9.4.2 r2 §3 — Référence de PROPOSITION persistée côté serveur. Quand présente, la
   *  confirmation exécute l'action CÔTÉ SERVEUR (le client ne soumet que cette référence,
   *  jamais le payload canonique ni un fingerprint). Absente pour la navigation/ouverture. */
  readonly proposalId?: string | null;
}

// ── Intentions ──────────────────────────────────────────────────────────────

export type CloneChatIntent =
  | "explain"          // expliquer / orienter (public + client)
  | "summarize"        // résumer l'activité
  | "list_missions"
  | "open_mission"
  | "create_mission"
  | "list_validations"
  | "explain_validation"
  | "open_validation"
  | "list_employees"
  | "open_employee"
  | "find_document"
  | "open_document"
  | "status"           // statut global
  | "help"
  | "clarify";         // ambigu → demander une précision

export interface CloneChatEntities {
  readonly employeeQuery: string | null;
  readonly documentQuery: string | null;
  readonly missionInstruction: string | null;
  readonly raw: string;
}

export interface CloneChatClassification {
  readonly intent: CloneChatIntent;
  readonly confidence: number;   // 0..1 (heuristique déterministe)
  readonly entities: CloneChatEntities;
  readonly ambiguous: boolean;
}

// ── Erreurs (taxonomie unique) ──────────────────────────────────────────────

export type CloneChatErrorCategory =
  | "auth"
  | "access"
  | "subscription"
  | "runtime"
  | "network"
  | "stale"
  | "validation_conflict"
  | "missing_data"
  | "feature_disabled"
  | "permission"
  | "unknown";

export type CloneChatRecoveryKind =
  | "retry" | "refresh" | "reconnect" | "finish_onboarding"
  | "manage_access" | "open_cockpit" | "contact_support" | "navigate";

export interface CloneChatRecovery {
  readonly kind: CloneChatRecoveryKind;
  readonly label: string;
  readonly href: string | null;
}

// ── État machine de conversation ────────────────────────────────────────────

export type CloneChatPhase =
  | "idle"
  | "classifying"
  | "resolving"
  | "awaiting_confirmation"
  | "executing"
  | "complete"
  | "error";
