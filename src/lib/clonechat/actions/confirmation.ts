// src/lib/clonechat/actions/confirmation.ts
//
// Confirmation CONTRÔLÉE et LIÉE exactement à l'action, aux arguments normalisés, au viewer et au
// tenant. Explicite, limitée dans le temps, non réutilisable. Invalidée si le plan change. Le temps
// est INJECTÉ (testable). Aucun « oui » ambigu ne peut confirmer une autre action ou une action
// modifiée.

import { hash } from "./keys";
import { CLONECHAT_CONFIRMATION_VERSION, type ConfirmationToken, type CloneActionPlan } from "./types";

export const DEFAULT_CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Jeton attendu pour un plan (déterministe, dérivé du planHash). */
function expectedToken(planHash: string): string {
  return hash(`${CLONECHAT_CONFIRMATION_VERSION}|${planHash}`);
}

/** Émet une confirmation liée au plan. `nowMs` est injecté (jamais Date.now). */
export function mintConfirmation(plan: CloneActionPlan, opts: { nowMs: number; ttlMs?: number }): ConfirmationToken {
  const ttl = opts.ttlMs ?? DEFAULT_CONFIRMATION_TTL_MS;
  return Object.freeze({
    version: CLONECHAT_CONFIRMATION_VERSION,
    token: expectedToken(plan.planHash),
    actionId: plan.definition?.id ?? plan.request.actionId,
    actionVersion: plan.definition?.version ?? "0",
    argsHash: plan.planHash, // le planHash encode déjà argsHash+viewer+tenant
    viewerKey: plan.authorization.viewerKey,
    tenantKey: plan.authorization.tenantKey,
    planHash: plan.planHash,
    issuedAtMs: opts.nowMs,
    expiresAtMs: opts.nowMs + ttl,
  });
}

/** Suivi d'usage unique des confirmations (in-memory, par session). */
export interface ConfirmationRegistry {
  isUsed(token: string): boolean;
  markUsed(token: string): void;
}
export function createConfirmationRegistry(): ConfirmationRegistry {
  const used = new Set<string>();
  return { isUsed: (t) => used.has(t), markUsed: (t) => { used.add(t); } };
}

export type ConfirmationVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };

/**
 * Vérifie une confirmation contre le plan COURANT. Refuse si absente, non liée (action/args/viewer/
 * tenant différents → planHash différent), altérée, expirée ou déjà utilisée. Marque l'usage si OK.
 */
export function verifyConfirmation(
  confirmation: ConfirmationToken | undefined,
  plan: CloneActionPlan,
  opts: { nowMs: number; registry: ConfirmationRegistry },
): ConfirmationVerdict {
  if (!confirmation) return { ok: false, code: "CONFIRMATION_MISSING", reason: "Confirmation requise et absente." };
  if (confirmation.planHash !== plan.planHash) return { ok: false, code: "CONFIRMATION_MISMATCH", reason: "La confirmation ne correspond pas à ce plan (action, arguments, viewer ou tenant différents)." };
  if (confirmation.token !== expectedToken(plan.planHash)) return { ok: false, code: "CONFIRMATION_MISMATCH", reason: "Jeton de confirmation invalide." };
  if (confirmation.actionId !== (plan.definition?.id ?? plan.request.actionId)) return { ok: false, code: "CONFIRMATION_MISMATCH", reason: "Confirmation liée à une autre action." };
  if (opts.nowMs > confirmation.expiresAtMs) return { ok: false, code: "CONFIRMATION_EXPIRED", reason: "Confirmation expirée." };
  if (opts.registry.isUsed(confirmation.token)) return { ok: false, code: "CONFIRMATION_REUSED", reason: "Confirmation déjà utilisée." };
  opts.registry.markUsed(confirmation.token);
  return { ok: true };
}
