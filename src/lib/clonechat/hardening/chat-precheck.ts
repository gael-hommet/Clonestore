// src/lib/clonechat/hardening/chat-precheck.ts
//
// Adaptateur ADDITIF pour /api/assistant/chat. Feature-gated, `off` par défaut. En `off` (défaut, y
// compris kill switch) ET en `shadow`, il ne bloque JAMAIS : le comportement historique de la route
// est strictement inchangé (retour immédiat, coût négligeable). En `active` UNIQUEMENT (jamais activé
// en Production dans le BLOC 13), il applique les limites d'entrée canoniques et renvoie une erreur
// structurée SÛRE (jamais un crash). Aucun texte utilisateur ne modifie la politique.

import { resolveHardeningConfig, modeEffect } from "./config";
import { checkInputLimits, type HardeningInput } from "./limits";
import type { HardeningConfig } from "./types";

export type ChatPrecheck =
  | { readonly blocked: false; readonly mode: string }
  | { readonly blocked: true; readonly status: number; readonly payload: { ok: false; code: string; error: string } };

export function hardeningChatPrecheck(input: HardeningInput, config: HardeningConfig = resolveHardeningConfig()): ChatPrecheck {
  const effect = modeEffect(config);
  // off / kill switch / shadow → jamais bloquant. Comportement historique strictement inchangé.
  if (!effect.enforce) return { blocked: false, mode: effect.mode };
  const err = checkInputLimits(input, config.limits, null);
  if (!err) return { blocked: false, mode: effect.mode };
  return { blocked: true, status: err.httpStatus, payload: { ok: false, code: err.code, error: err.message } };
}
