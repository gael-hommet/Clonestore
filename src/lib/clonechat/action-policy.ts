// src/lib/clonechat/action-policy.ts
// P9.4 — Politique d'action GOUVERNÉE : risque + confirmation + permission.
// Le LLM/moteur PROPOSE, cette politique GOUVERNE, l'humain CONFIRME le sensible.
// Réutilise les permissions serveur P9.3 (CockpitPermissions). Pur → testable.

import type { CockpitPermissions } from "@/lib/client-cockpit";
import type { CloneChatActionKind, CloneChatActionRisk, CloneChatProposedAction } from "./types";

const RISK: Record<CloneChatActionKind, CloneChatActionRisk> = {
  create_mission: "sensitive",
  decide_validation: "sensitive",
  cancel_mission: "irreversible",
  create_support_case: "sensitive",
  open_mission: "low",
  open_validation: "low",
  open_employee: "low",
  open_document: "low",
  navigate: "low",
};

/** Une action requiert-elle une confirmation humaine explicite ? */
export function requiresConfirmation(kind: CloneChatActionKind): boolean {
  return RISK[kind] !== "low";
}

/** Le mode public n'autorise QUE la navigation d'orientation, jamais d'opérationnel. */
const PUBLIC_ALLOWED_KINDS: ReadonlySet<CloneChatActionKind> = new Set(["navigate"]);

function permissionFor(kind: CloneChatActionKind, perms: CockpitPermissions): { allowed: boolean; reason: string | null } {
  switch (kind) {
    case "create_mission":
      return perms.canCreateMission ? { allowed: true, reason: null } : { allowed: false, reason: "Votre rôle ne permet pas de créer des missions." };
    case "decide_validation":
      return perms.canDecideValidations ? { allowed: true, reason: null } : { allowed: false, reason: "Votre rôle ne permet pas de décider des validations." };
    case "cancel_mission":
      return perms.canCancelMission ? { allowed: true, reason: null } : { allowed: false, reason: "Votre rôle ne permet pas d'annuler une mission." };
    case "create_support_case":
      return { allowed: true, reason: null }; // tout client connecté peut ouvrir un cas de support
    // Ouvertures = navigation gouvernée par le cockpit à l'arrivée (relecture serveur).
    default:
      return { allowed: true, reason: null };
  }
}

export interface ProposeActionInput {
  readonly kind: CloneChatActionKind;
  readonly label: string;
  readonly mode: "public" | "authenticated";
  readonly permissions: CockpitPermissions;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly href?: string | null;
  readonly idSeed?: string;
}

/** Construit une action proposée GOUVERNÉE (jamais exécutée ici). */
export function proposeAction(input: ProposeActionInput): CloneChatProposedAction {
  const risk = RISK[input.kind];
  const requiresConfirm = risk !== "low";
  // Mode public : seule la navigation d'orientation est permise.
  if (input.mode === "public" && !PUBLIC_ALLOWED_KINDS.has(input.kind)) {
    return {
      id: `act-${input.idSeed ?? input.kind}`,
      kind: input.kind,
      label: input.label,
      risk,
      requiresConfirmation: requiresConfirm,
      allowed: false,
      reason: "Connectez-vous pour agir sur votre entreprise. En mode public, je vous oriente uniquement.",
      payload: input.payload ?? {},
      href: input.href ?? null,
    };
  }
  const perm = permissionFor(input.kind, input.permissions);
  return {
    id: `act-${input.idSeed ?? input.kind}`,
    kind: input.kind,
    label: input.label,
    risk,
    requiresConfirmation: requiresConfirm,
    allowed: perm.allowed,
    reason: perm.reason,
    payload: input.payload ?? {},
    href: input.href ?? null,
  };
}

/** Garde d'exécution : une action ne peut être exécutée que si autorisée ET
 *  (non sensible OU confirmée explicitement). Jamais d'exécution optimiste. */
export function canExecute(action: CloneChatProposedAction, confirmed: boolean): { ok: boolean; reason: string | null } {
  if (!action.allowed) return { ok: false, reason: action.reason ?? "Action non autorisée." };
  if (action.requiresConfirmation && !confirmed) return { ok: false, reason: "Confirmation requise avant exécution." };
  return { ok: true, reason: null };
}
