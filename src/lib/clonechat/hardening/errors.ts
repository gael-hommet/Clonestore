// src/lib/clonechat/hardening/errors.ts
//
// Taxonomie d'erreurs SÛRE et stable. Le client ne reçoit JAMAIS : stack brute, secret, token, cookie,
// clé API, SQL, chemin interne, prompt système, payload provider brut, ni donnée d'un autre tenant.
// Chaque code a un message générique fixe et un code HTTP cohérent. `toSafeError` mappe n'importe quelle
// exception (typée ou brute) vers un SafeError sans jamais divulguer son contenu.

import { redactText } from "@/lib/clonechat/care";
import type { HardeningErrorCode, SafeError } from "./types";

const HTTP_STATUS: Record<HardeningErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  tenant_required: 403,
  forbidden: 403,
  payload_too_large: 413,
  message_too_long: 413,
  history_too_long: 413,
  too_many_attachments: 413,
  attachment_too_large: 413,
  output_too_large: 500, // sortie tronquée/rejetée côté serveur : erreur serveur sûre
  rate_limited: 429,
  concurrency_limited: 429,
  timeout: 504,
  provider_unavailable: 503,
  circuit_open: 503,
  cancelled: 499, // Client Closed Request (convention)
  dependency_failure: 502,
  config_invalid: 500,
  runtime_disabled: 503,
  internal_safe_error: 500,
};

// Messages GÉNÉRIQUES, stables, non sensibles. Jamais dérivés d'une exception ou d'un input.
const SAFE_MESSAGE: Record<HardeningErrorCode, string> = {
  invalid_request: "Requête invalide.",
  unauthorized: "Authentification requise.",
  tenant_required: "Un espace entreprise est requis pour cette demande.",
  forbidden: "Action non autorisée.",
  payload_too_large: "Requête trop volumineuse.",
  message_too_long: "Message trop long.",
  history_too_long: "Historique de conversation trop volumineux.",
  too_many_attachments: "Trop de pièces jointes.",
  attachment_too_large: "Pièce jointe trop volumineuse.",
  output_too_large: "Réponse indisponible pour le moment.",
  rate_limited: "Trop de requêtes. Merci de réessayer dans un instant.",
  concurrency_limited: "Service momentanément saturé. Merci de réessayer.",
  timeout: "Le traitement a pris trop de temps. Merci de réessayer.",
  provider_unavailable: "Service temporairement indisponible.",
  circuit_open: "Service temporairement indisponible.",
  cancelled: "Requête annulée.",
  dependency_failure: "Service temporairement indisponible.",
  config_invalid: "Service momentanément indisponible.",
  runtime_disabled: "Service momentanément indisponible.",
  internal_safe_error: "Une erreur est survenue. Merci de réessayer.",
};

/** Classe d'erreur interne typée. Son `message` interne n'est JAMAIS renvoyé tel quel au client. */
export class HardeningError extends Error {
  readonly code: HardeningErrorCode;
  constructor(code: HardeningErrorCode, internalMessage?: string) {
    super(internalMessage ?? code);
    this.name = "HardeningError";
    this.code = code;
  }
}

export function httpStatusFor(code: HardeningErrorCode): number {
  return HTTP_STATUS[code] ?? 500;
}

export function safeMessageFor(code: HardeningErrorCode): string {
  return SAFE_MESSAGE[code] ?? SAFE_MESSAGE.internal_safe_error;
}

/** Construit un SafeError à partir d'un code connu. Le message est TOUJOURS le message générique. */
export function makeSafeError(code: HardeningErrorCode, correlationId: string | null = null): SafeError {
  return { ok: false, code, httpStatus: httpStatusFor(code), message: safeMessageFor(code), correlationId };
}

/**
 * Mappe n'importe quelle valeur levée vers un SafeError. Ne divulgue jamais le contenu de l'exception.
 * Une HardeningError conserve son code ; tout le reste devient `internal_safe_error`. Défense en
 * profondeur : le message renvoyé est le message générique du code (jamais err.message), et il est en
 * plus passé par redactText au cas où un message générique serait un jour paramétré par erreur.
 */
export function toSafeError(err: unknown, correlationId: string | null = null): SafeError {
  const code: HardeningErrorCode = err instanceof HardeningError ? err.code : "internal_safe_error";
  const base = makeSafeError(code, correlationId);
  return { ...base, message: redactText(base.message) };
}
