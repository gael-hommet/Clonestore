// src/lib/clonechat/hardening/observe.ts
//
// Observabilité SÛRE du runtime durci. Corrélation OPAQUE/pseudonymisée uniquement (jamais un id brut).
// Aucun log/trace ne contient : message brut, réponse complète, transcript, audio, binaire, token,
// cookie, Authorization, clé API, mot de passe, URL signée, e-mail, id tenant/user brut ni stack brute.
// Réutilise le hash FNV du Product Truth (déterministe) — aucun nouveau système.

import { hash } from "@/lib/clonechat/actions/keys";
import type { HardeningErrorCode, RuntimeMode } from "./types";

/** Corrélation opaque, déterministe, tenant-scopée — jamais réversible vers un id brut. */
export function correlationId(parts: { viewerKey?: string | null; tenantKey?: string | null; nowMs: number; nonce?: string }): string {
  const material = [parts.tenantKey ?? "none", parts.viewerKey ?? "anon", String(parts.nowMs), parts.nonce ?? ""].join("|");
  return "hz_" + hash(material);
}

/** Événement d'observation SÛR (compteurs/statuts uniquement, aucune donnée sensible). */
export interface HardeningObservation {
  readonly mode: RuntimeMode;
  readonly outcome: "passthrough" | "allowed" | "blocked" | "shadow_observed" | "error";
  readonly code: HardeningErrorCode | null;
  readonly correlationId: string;
  readonly durationMs: number | null;
}

/** Champs de log AUTORISÉS : uniquement des primitives non sensibles + corrélation opaque. */
export function safeLogFields(obs: HardeningObservation): Record<string, string | number | null> {
  return {
    hardening_mode: obs.mode,
    hardening_outcome: obs.outcome,
    hardening_code: obs.code,
    correlation: obs.correlationId,
    duration_ms: obs.durationMs,
  };
}
