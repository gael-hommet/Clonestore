// src/lib/clonechat/tool-executor.ts
// P9.4 — Exécuteur d'action GOUVERNÉ (pur, testable). Une proposition d'outil déjà
// VALIDÉE (allowlist + permission + mode + confirmation du sensible) est traduite ici
// en EFFET RÉEL via un contrat V1 injecté. Deux garanties :
//  - IDEMPOTENCE : une même proposition (même action.id) n'exécute jamais deux fois
//    (protège contre un double-clic de confirmation) ;
//  - HONNÊTETÉ : on ne prétend un succès que si le contrat V1 le confirme réellement.
// Aucun appel réseau ici : la dépendance `submitMission` est injectée (réel en prod,
// simulé en test). Le modèle ne touche jamais cet exécuteur : il ne fait que proposer.

import type { CloneChatProposedAction } from "./types";

export interface MissionSubmitResult {
  readonly ok: boolean;
  readonly missionId?: string;
  readonly error?: string;
}
export interface SimpleResult { readonly ok: boolean; readonly id?: string; readonly error?: string; }

export interface ExecutionDeps {
  /** Contrat V1 réel de création de mission (injecté). `idempotencyKey` stable/propal. */
  submitMission(instruction: string, idempotencyKey: string): Promise<MissionSubmitResult>;
  /** Décision de validation RÉELLE (approve/reject/request_changes) — version optimiste. */
  decideValidation?(validationId: string, decision: "approve" | "reject" | "request_changes", version: number): Promise<SimpleResult>;
  /** Annulation de mission RÉELLE. */
  cancelMission?(missionId: string): Promise<SimpleResult>;
  /** Ouverture d'un cas de support DURABLE (tenant-safe). */
  createSupportCase?(summary: string): Promise<SimpleResult>;
  /** Registre d'idempotence : cette proposition a-t-elle déjà été exécutée ? */
  alreadyExecuted(actionId: string): boolean;
  markExecuted(actionId: string): void;
}

export type ExecutionOutcome =
  | { readonly kind: "navigate"; readonly href: string }
  | { readonly kind: "executed"; readonly missionId: string | null; readonly href: string; readonly message?: string }
  | { readonly kind: "duplicate"; readonly message: string }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "failed"; readonly message: string };

/**
 * Exécute une action gouvernée. Ne suppose JAMAIS que la confirmation a eu lieu :
 * `confirmed` est l'intention EXPLICITE de l'humain (clic « Confirmer »). Une action
 * sensible non confirmée est refusée. L'idempotence est vérifiée avant tout effet, et
 * marquée seulement après un succès confirmé côté serveur.
 */
export async function executeGovernedAction(
  action: CloneChatProposedAction,
  deps: ExecutionDeps,
  confirmed = false,
): Promise<ExecutionOutcome> {
  if (!action.allowed) {
    return { kind: "refused", reason: action.reason ?? "action_not_allowed" };
  }

  // Actions de navigation / ouverture : pas d'effet d'écriture, pas d'idempotence requise.
  if (action.kind === "navigate" || action.kind.startsWith("open_")) {
    return { kind: "navigate", href: action.href ?? "/" };
  }

  // Actions à effet sensible : confirmation explicite de l'humain obligatoire.
  if (action.requiresConfirmation && !confirmed) {
    return { kind: "refused", reason: "confirmation_required" };
  }

  if (action.kind === "create_mission") {
    // Idempotence : une proposition déjà exécutée ne réexécute pas.
    if (deps.alreadyExecuted(action.id)) {
      return { kind: "duplicate", message: "Cette mission a déjà été confiée à Pierre." };
    }
    const instruction = String((action.payload as { instruction?: string } | undefined)?.instruction ?? "").trim();
    if (!instruction) return { kind: "refused", reason: "empty_instruction" };

    const result = await deps.submitMission(instruction, action.id);
    if (!result.ok) return { kind: "failed", message: result.error ?? "mission_not_created" };

    // Succès CONFIRMÉ par le serveur → on marque l'idempotence.
    deps.markExecuted(action.id);
    const missionId = result.missionId ?? null;
    const href = missionId
      ? `/agents/pierre/use?view=missions&mission=${encodeURIComponent(missionId)}`
      : "/agents/pierre/use";
    return { kind: "executed", missionId, href };
  }

  if (action.kind === "decide_validation") {
    if (!deps.decideValidation) return { kind: "refused", reason: "decide_unavailable" };
    if (deps.alreadyExecuted(action.id)) return { kind: "duplicate", message: "Cette validation a déjà été traitée." };
    const p = action.payload as { validationId?: string; decision?: "approve" | "reject" | "request_changes"; version?: number };
    if (!p?.validationId || p.version == null || !p.decision) return { kind: "refused", reason: "invalid_validation_payload" };
    const r = await deps.decideValidation(p.validationId, p.decision, p.version);
    if (!r.ok) return { kind: "failed", message: r.error ?? "decision_not_saved" };
    deps.markExecuted(action.id);
    const label = p.decision === "reject" ? "rejetée" : p.decision === "request_changes" ? "renvoyée pour changements" : "approuvée";
    return { kind: "executed", missionId: null, href: "/agents/pierre/use?view=validations", message: `Décision enregistrée : validation ${label}.` };
  }

  if (action.kind === "cancel_mission") {
    if (!deps.cancelMission) return { kind: "refused", reason: "cancel_unavailable" };
    if (deps.alreadyExecuted(action.id)) return { kind: "duplicate", message: "Cette mission a déjà été annulée." };
    const p = action.payload as { missionId?: string };
    if (!p?.missionId) return { kind: "refused", reason: "invalid_mission_payload" };
    const r = await deps.cancelMission(p.missionId);
    if (!r.ok) return { kind: "failed", message: r.error ?? "cancel_failed" };
    deps.markExecuted(action.id);
    return { kind: "executed", missionId: p.missionId, href: `/agents/pierre/use?view=missions&mission=${encodeURIComponent(p.missionId)}`, message: "Mission annulée." };
  }

  if (action.kind === "create_support_case") {
    if (!deps.createSupportCase) return { kind: "refused", reason: "support_unavailable" };
    if (deps.alreadyExecuted(action.id)) return { kind: "duplicate", message: "Un cas de support a déjà été ouvert." };
    const summary = String((action.payload as { summary?: string } | undefined)?.summary ?? "").trim();
    if (!summary) return { kind: "refused", reason: "empty_summary" };
    const r = await deps.createSupportCase(summary);
    if (!r.ok) return { kind: "failed", message: r.error ?? "support_case_failed" };
    deps.markExecuted(action.id);
    return { kind: "executed", missionId: null, href: "/profile/messages", message: "Cas de support ouvert. Notre équipe pourra le suivre." };
  }

  return { kind: "refused", reason: `unsupported_kind:${action.kind}` };
}

/** Crée un registre d'idempotence en mémoire (par session client). */
export function createIdempotencyLedger(): Pick<ExecutionDeps, "alreadyExecuted" | "markExecuted"> {
  const done = new Set<string>();
  return {
    alreadyExecuted: (id) => done.has(id),
    markExecuted: (id) => { done.add(id); },
  };
}
