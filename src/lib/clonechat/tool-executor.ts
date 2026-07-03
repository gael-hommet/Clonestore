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
  /** Registre d'idempotence de SESSION (client) : garde rapide contre le double-clic. */
  alreadyExecuted(actionId: string): boolean;
  markExecuted(actionId: string): void;
  /** Idempotence DURABLE cross-session (serveur) : réserve avant exécution. 'new' ⇒
   *  exécuter ; sinon ⇒ doublon. Optionnel (repli session-only si absent). */
  claimDurable?(kind: string, key: string): Promise<{ fingerprint: string; status: "new" | "duplicate" | "in_flight" }>;
  settleDurable?(fingerprint: string, ok: boolean): Promise<void>;
}

/** Clé stable d'une action (pour l'idempotence durable). null = pas de garde durable. */
function keyForAction(action: CloneChatProposedAction): string | null {
  const p = action.payload as Record<string, unknown> | undefined;
  switch (action.kind) {
    case "create_mission": return String(p?.instruction ?? "").trim() || null;
    case "decide_validation": return p?.validationId ? `${p.validationId}:${p.decision}:${p.version}` : null;
    case "cancel_mission": return p?.missionId ? String(p.missionId) : null;
    case "create_support_case": return String(p?.summary ?? "").trim() || null;
    default: return null;
  }
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

  // Garde d'idempotence : (1) session client (double-clic) ; (2) DURABLE cross-session
  // (serveur) — un reload ou un autre appareil qui reconfirme la MÊME action logique est
  // refusé comme doublon. La garde durable est optionnelle (repli session-only).
  const DUP: Partial<Record<string, string>> = {
    create_mission: "Cette mission a déjà été confiée à Pierre.",
    decide_validation: "Cette validation a déjà été traitée.",
    cancel_mission: "Cette mission a déjà été annulée.",
    create_support_case: "Un cas de support a déjà été ouvert.",
  };
  if (deps.alreadyExecuted(action.id)) return { kind: "duplicate", message: DUP[action.kind] ?? "Action déjà effectuée." };
  const key = keyForAction(action);
  let fingerprint: string | null = null;
  if (deps.claimDurable && key) {
    const c = await deps.claimDurable(action.kind, key);
    if (c.status !== "new") return { kind: "duplicate", message: DUP[action.kind] ?? "Action déjà effectuée." };
    fingerprint = c.fingerprint;
  }
  const settle = async (ok: boolean) => { if (fingerprint && deps.settleDurable) await deps.settleDurable(fingerprint, ok); };

  if (action.kind === "create_mission") {
    const instruction = String((action.payload as { instruction?: string } | undefined)?.instruction ?? "").trim();
    if (!instruction) { await settle(false); return { kind: "refused", reason: "empty_instruction" }; }
    const result = await deps.submitMission(instruction, fingerprint ?? action.id);
    if (!result.ok) { await settle(false); return { kind: "failed", message: result.error ?? "mission_not_created" }; }
    deps.markExecuted(action.id); await settle(true);
    const missionId = result.missionId ?? null;
    const href = missionId ? `/agents/pierre/use?view=missions&mission=${encodeURIComponent(missionId)}` : "/agents/pierre/use";
    return { kind: "executed", missionId, href };
  }

  if (action.kind === "decide_validation") {
    if (!deps.decideValidation) { await settle(false); return { kind: "refused", reason: "decide_unavailable" }; }
    const p = action.payload as { validationId?: string; decision?: "approve" | "reject" | "request_changes"; version?: number };
    if (!p?.validationId || p.version == null || !p.decision) { await settle(false); return { kind: "refused", reason: "invalid_validation_payload" }; }
    const r = await deps.decideValidation(p.validationId, p.decision, p.version);
    if (!r.ok) { await settle(false); return { kind: "failed", message: r.error ?? "decision_not_saved" }; }
    deps.markExecuted(action.id); await settle(true);
    const label = p.decision === "reject" ? "rejetée" : p.decision === "request_changes" ? "renvoyée pour changements" : "approuvée";
    return { kind: "executed", missionId: null, href: "/agents/pierre/use?view=validations", message: `Décision enregistrée : validation ${label}.` };
  }

  if (action.kind === "cancel_mission") {
    if (!deps.cancelMission) { await settle(false); return { kind: "refused", reason: "cancel_unavailable" }; }
    const p = action.payload as { missionId?: string };
    if (!p?.missionId) { await settle(false); return { kind: "refused", reason: "invalid_mission_payload" }; }
    const r = await deps.cancelMission(p.missionId);
    if (!r.ok) { await settle(false); return { kind: "failed", message: r.error ?? "cancel_failed" }; }
    deps.markExecuted(action.id); await settle(true);
    return { kind: "executed", missionId: p.missionId, href: `/agents/pierre/use?view=missions&mission=${encodeURIComponent(p.missionId)}`, message: "Mission annulée." };
  }

  if (action.kind === "create_support_case") {
    if (!deps.createSupportCase) { await settle(false); return { kind: "refused", reason: "support_unavailable" }; }
    const summary = String((action.payload as { summary?: string } | undefined)?.summary ?? "").trim();
    if (!summary) { await settle(false); return { kind: "refused", reason: "empty_summary" }; }
    const r = await deps.createSupportCase(summary);
    if (!r.ok) { await settle(false); return { kind: "failed", message: r.error ?? "support_case_failed" }; }
    deps.markExecuted(action.id); await settle(true);
    return { kind: "executed", missionId: null, href: "/profile/messages", message: "Cas de support ouvert. Notre équipe pourra le suivre." };
  }

  await settle(false);
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
