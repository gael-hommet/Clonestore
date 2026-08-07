// src/lib/clonechat/hardening/limits.ts
//
// Vérification DÉTERMINISTE des limites d'entrée. Toute limite dépassée produit une erreur structurée
// SÛRE (jamais un crash, jamais une attente infinie). N'invente aucune limite pour une capacité
// inexistante : seuls le corps, le message, l'historique et les pièces jointes (réellement présents
// dans la route servie) sont bornés, plus la sortie.

import type { HardeningErrorCode, InputLimits, SafeError } from "./types";
import { makeSafeError } from "./errors";

export interface HardeningInput {
  readonly bodyBytes?: number | null;
  readonly message?: string | null;
  readonly history?: ReadonlyArray<{ readonly text?: string | null }> | null;
  readonly attachments?: ReadonlyArray<{ readonly bytes?: number | null }> | null;
}

/** Retourne un SafeError au PREMIER dépassement, ou null si toutes les limites sont respectées. */
export function checkInputLimits(input: HardeningInput, limits: InputLimits, correlationId: string | null = null): SafeError | null {
  const fail = (code: HardeningErrorCode): SafeError => makeSafeError(code, correlationId);

  if (typeof input.bodyBytes === "number" && input.bodyBytes > limits.maxBodyBytes) return fail("payload_too_large");

  const message = input.message ?? "";
  if (message.length > limits.maxMessageChars) return fail("message_too_long");

  const history = input.history ?? [];
  if (history.length > limits.maxHistoryMessages) return fail("history_too_long");
  let historyChars = 0;
  for (const h of history) { historyChars += (h?.text ?? "").length; if (historyChars > limits.maxHistoryChars) return fail("history_too_long"); }

  const attachments = input.attachments ?? [];
  if (attachments.length > limits.maxAttachments) return fail("too_many_attachments");
  let totalBytes = 0;
  for (const a of attachments) {
    const bytes = typeof a?.bytes === "number" && Number.isFinite(a.bytes) ? a.bytes : 0;
    if (bytes > limits.maxAttachmentBytes) return fail("attachment_too_large");
    totalBytes += bytes;
    if (totalBytes > limits.maxTotalAttachmentBytes) return fail("attachment_too_large");
  }
  return null;
}

/**
 * Borne la sortie. Ne renvoie JAMAIS une chaîne plus longue que la limite : soit elle est acceptée,
 * soit tronquée honnêtement (avec `truncated:true`). Aucune sortie non bornée ne peut fuir.
 */
export function enforceOutputLimit(output: string, limits: InputLimits): { text: string; truncated: boolean } {
  if (output.length <= limits.maxOutputChars) return { text: output, truncated: false };
  return { text: output.slice(0, limits.maxOutputChars), truncated: true };
}
