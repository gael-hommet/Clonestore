// src/lib/clonechat/hardening/chat-precheck.ts
//
// Adaptateur ADDITIF pour /api/assistant/chat. Feature-gated, `off` par défaut. En off/shadow/kill
// switch → jamais bloquant (comportement historique inchangé). En `active` UNIQUEMENT → applique les
// limites d'entrée canoniques ET le nombre BRUT de pièces jointes (vérifié AVANT tout slice) et renvoie
// une erreur structurée SÛRE. Aucun texte utilisateur ne modifie la politique.

import { hardeningConfig, modeEffect } from "./config";
import { checkInputLimits, type HardeningInput } from "./limits";
import { makeSafeError } from "./errors";
import type { HardeningConfig } from "./types";

export interface ChatPrecheckInput extends HardeningInput {
  /** Nombre BRUT de pièces jointes reçues (AVANT tout slice côté route). */
  readonly rawAttachmentCount?: number;
}

export type ChatPrecheck =
  | { readonly blocked: false; readonly mode: string }
  | { readonly blocked: true; readonly status: number; readonly payload: { ok: false; code: string; error: string } };

export function hardeningChatPrecheck(input: ChatPrecheckInput, config: HardeningConfig = hardeningConfig()): ChatPrecheck {
  const effect = modeEffect(config);
  if (!effect.enforce) return { blocked: false, mode: effect.mode };

  // Nombre BRUT de pièces jointes AVANT slice : un excès ne doit pas être silencieusement tronqué.
  if (typeof input.rawAttachmentCount === "number" && input.rawAttachmentCount > config.limits.maxAttachments) {
    const e = makeSafeError("too_many_attachments");
    return { blocked: true, status: e.httpStatus, payload: { ok: false, code: e.code, error: e.message } };
  }
  const err = checkInputLimits(input, config.limits, null);
  if (!err) return { blocked: false, mode: effect.mode };
  return { blocked: true, status: err.httpStatus, payload: { ok: false, code: err.code, error: err.message } };
}
