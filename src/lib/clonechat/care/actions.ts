// src/lib/clonechat/care/actions.ts
// C1.8 §7 — CLONEACTIONS : donner des mains à CloneChat, mais des mains GOUVERNÉES.
//
// Le danger n'est pas qu'il agisse : c'est qu'il agisse **en croyant savoir**. D'où quatre paliers,
// et une règle qui prime sur tout le reste :
//
//   ┌ palier 1 — navigation client        : aucun effet serveur, aucune confirmation
//   ├ palier 2 — lecture authentifiée     : permission requise, aucun effet
//   ├ palier 3 — self-service réversible  : confirmation EXPLICITE + idempotence + audit
//   └ palier 4 — effet provider / sensible: DÉSACTIVÉ en local (LIVE_DISABLED), jamais autonome
//
// Et : une action n'est JAMAIS autorisée sur un diagnostic à confiance faible ou inconnue.

import type {
  CloneChatAction, CloneChatActionKind, CloneChatEffectCategory,
  CloneChatResolvedAccountContext, CloneChatDiagnosis,
} from "./contracts";
import { mayTriggerEffect } from "./diagnosis";

export type ActionState =
  | "PROPOSED" | "REQUIRES_CONFIRMATION" | "AUTHORIZED" | "STARTED"
  | "COMPLETED_WITH_EVIDENCE" | "FAILED_RETRYABLE" | "FAILED_FINAL"
  | "STATUS_UNKNOWN" | "RECONCILIATION_REQUIRED" | "CANCELLED"
  | "BLOCKED_PERMISSION" | "BLOCKED_CONFIGURATION" | "LIVE_DISABLED";

/** Palier d'effet de chaque type d'action — la table fait FOI, pas le libellé. */
export const ACTION_TIERS: Readonly<Record<CloneChatActionKind, CloneChatEffectCategory>> = Object.freeze({
  navigate: "client_navigation",
  focus: "client_navigation",
  open_modal: "client_navigation",
  copy: "client_navigation",
  show_invoice: "read_only",
  retry: "reversible_self_service",
  resend_verification: "provider_effect",   // envoie un VRAI e-mail ⇒ effet externe
  open_billing_portal: "provider_effect",   // ouvre un portail prestataire ⇒ effet externe
  prefill_mission: "reversible_self_service",
  create_support_ticket: "reversible_self_service",
});

/** Permission requise par action (null = aucune). */
const REQUIRED_PERMISSION: Readonly<Record<CloneChatActionKind, string | null>> = Object.freeze({
  navigate: null, focus: null, open_modal: null, copy: null,
  show_invoice: "billing.read",
  retry: "mission.create",
  resend_verification: "tenancy.admin",
  open_billing_portal: "billing.admin",
  prefill_mission: "mission.create",
  create_support_ticket: null, // même un anonyme doit pouvoir demander de l'aide
});

export interface AuthorizeInput {
  readonly kind: CloneChatActionKind;
  readonly account: CloneChatResolvedAccountContext | null;
  readonly diagnosis: CloneChatDiagnosis | null;
  readonly confirmed?: boolean;
  /** Version du contexte au moment où l'action a été PROPOSÉE (anti-obsolescence). */
  readonly proposedAtContextVersion?: string | null;
  /** Clé d'idempotence — obligatoire pour tout effet. */
  readonly idempotencyKey?: string | null;
  /** Le mode live est-il autorisé ? (plancher de production — false en local) */
  readonly liveEnabled?: boolean;
}

export interface AuthorizeResult {
  readonly state: ActionState;
  readonly reason: string;
  readonly effect_category: CloneChatEffectCategory;
  readonly requires_confirmation: boolean;
  readonly idempotency_key: string | null;
  readonly audit: { readonly kind: string; readonly actor: string | null; readonly company: string | null; readonly context_version: string | null };
}

/**
 * PORTE UNIQUE d'autorisation. Aucun appelant ne peut la contourner : elle rend un ÉTAT, et seuls
 * `AUTHORIZED` / `REQUIRES_CONFIRMATION` laissent la suite se produire.
 */
export function authorizeAction(input: AuthorizeInput): AuthorizeResult {
  const effect = ACTION_TIERS[input.kind];
  const account = input.account;
  const audit = {
    kind: input.kind,
    actor: account?.user_id ?? null,
    company: account?.company_id ?? null,
    context_version: account?.context_version ?? null,
  };
  const base = { effect_category: effect, requires_confirmation: false, idempotency_key: null as string | null, audit };

  // ── Palier 1 : navigation client — aucun effet serveur, ouvert à tous ──
  if (effect === "client_navigation") {
    return Object.freeze({ ...base, state: "AUTHORIZED", reason: "Navigation côté client : aucun effet serveur." });
  }

  // ── Palier 4 : effet provider / sensible — DÉSACTIVÉ en local, fail-closed ──
  if (effect === "provider_effect" || effect === "sensitive") {
    if (input.liveEnabled !== true) {
      return Object.freeze({
        ...base,
        state: "LIVE_DISABLED",
        reason: "Cette action déclenche un effet EXTERNE réel. Elle reste désactivée tant que la production n'est pas autorisée.",
        requires_confirmation: true,
      });
    }
  }

  // Au-delà du palier 1, une identité SERVEUR est requise (jamais déclarée par le client).
  if (!account || account.viewer_kind === "anonymous") {
    // Exception assumée : demander de l'aide reste possible sans compte.
    if (input.kind === "create_support_ticket") {
      return Object.freeze({ ...base, state: "REQUIRES_CONFIRMATION", requires_confirmation: true, reason: "Un brouillon de demande sera préparé ; vous décidez de l'envoyer." });
    }
    return Object.freeze({ ...base, state: "BLOCKED_PERMISSION", reason: "Cette action exige un compte authentifié." });
  }

  // Membre suspendu / révoqué : aucune action, jamais.
  if (account.viewer_kind === "suspended" || account.viewer_kind === "revoked") {
    return Object.freeze({ ...base, state: "BLOCKED_PERMISSION", reason: "Votre accès à cette entreprise est suspendu ou révoqué." });
  }

  // État de compte INCONNU (panne de résolution) : on n'agit pas « au cas où ».
  // Un état inconnu n'est pas un état sain — c'est précisément là que l'on s'arrête.
  if (account.viewer_kind === "unknown") {
    return Object.freeze({
      ...base,
      state: "BLOCKED_CONFIGURATION",
      reason: "Je n'arrive pas à établir l'état de votre compte avec certitude. Je préfère ne rien faire plutôt que d'agir sur une supposition.",
    });
  }

  // Permission (résolue SERVEUR).
  const needed = REQUIRED_PERMISSION[input.kind];
  if (needed && !account.permissions.includes(needed)) {
    return Object.freeze({ ...base, state: "BLOCKED_PERMISSION", reason: `Permission requise : ${needed}.` });
  }

  // ── Le diagnostic doit être SOLIDE : jamais d'effet sous confiance faible/inconnue ──
  if (effect !== "read_only") {
    if (!input.diagnosis || !mayTriggerEffect(input.diagnosis)) {
      return Object.freeze({
        ...base,
        state: "BLOCKED_CONFIGURATION",
        reason: "Je ne suis pas assez sûr de la cause pour agir. Je préfère vérifier plutôt que de me tromper.",
      });
    }
  }

  // ── Contexte PÉRIMÉ : une action proposée sur un ancien état n'est plus valable ──
  if (input.proposedAtContextVersion && input.proposedAtContextVersion !== account.context_version) {
    return Object.freeze({
      ...base,
      state: "BLOCKED_CONFIGURATION",
      reason: "Votre contexte a changé depuis la proposition : elle doit être revalidée.",
    });
  }

  // ── Palier 2 : lecture seule ──
  if (effect === "read_only") {
    return Object.freeze({ ...base, state: "AUTHORIZED", reason: "Lecture autorisée (permission vérifiée)." });
  }

  // ── Palier 3 : self-service réversible — confirmation EXPLICITE + idempotence ──
  if (!input.confirmed) {
    return Object.freeze({ ...base, state: "REQUIRES_CONFIRMATION", requires_confirmation: true, reason: "Confirmez pour lancer cette action réversible." });
  }
  if (!input.idempotencyKey) {
    // Sans clé stable, un double-clic exécuterait DEUX fois : on refuse.
    return Object.freeze({ ...base, state: "BLOCKED_CONFIGURATION", reason: "Clé d'idempotence manquante : l'action pourrait être exécutée deux fois." });
  }

  return Object.freeze({
    ...base,
    state: "AUTHORIZED",
    requires_confirmation: true,
    idempotency_key: input.idempotencyKey,
    reason: "Action réversible autorisée, confirmée et idempotente.",
  });
}

/** Idempotence DÉTERMINISTE : deux clics identiques ⇒ la même clé ⇒ un seul effet. */
export function actionIdempotencyKey(parts: {
  kind: CloneChatActionKind; userId: string | null; companyId: string | null; targetId: string | null; contextVersion: string | null;
}): string {
  return ["cc-act", parts.kind, parts.userId ?? "anon", parts.companyId ?? "nocompany", parts.targetId ?? "-", parts.contextVersion ?? "-"].join("|");
}

/** Construit l'action AFFICHABLE (ce que l'utilisateur voit) à partir de la décision serveur. */
export function buildAction(input: {
  id: string; kind: CloneChatActionKind; label: string; description: string;
  href?: string; target_id?: string; decision: AuthorizeResult;
}): CloneChatAction {
  const d = input.decision;
  const enabled = d.state === "AUTHORIZED" || d.state === "REQUIRES_CONFIRMATION";
  return Object.freeze({
    id: input.id,
    label: input.label,
    description: input.description,
    kind: input.kind,
    enabled,
    // Un bouton désactivé DIT POURQUOI. Un refus muet est une trahison de l'utilisateur.
    disabled_reason: enabled ? null : d.reason,
    href: input.href,
    target_id: input.target_id,
    requires_authentication: d.effect_category !== "client_navigation",
    requires_permission: REQUIRED_PERMISSION[input.kind],
    requires_confirmation: d.requires_confirmation,
    effect_category: d.effect_category,
    idempotency_key: d.idempotency_key,
  });
}
