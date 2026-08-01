// src/lib/clonechat/actions/keys.ts
//
// Clés déterministes (hash FNV réutilisé du Product Truth Engine) : normalisation d'arguments,
// clés viewer/tenant SÛRES, hash de plan et clé d'idempotence. Aucune PII brute, aucun secret.

import { truthVersionHash } from "@/lib/clonechat/product-truth/types";
import type { CloneChatViewer } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";

export function hash(input: string): string {
  return truthVersionHash(input);
}

/** Normalisation stable des arguments (clés triées) → chaîne déterministe. */
export function normalizeArgs(args: Readonly<Record<string, unknown>>): string {
  const keys = Object.keys(args ?? {}).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = (args as Record<string, unknown>)[k];
  return JSON.stringify(ordered);
}

export function argsHashOf(args: Readonly<Record<string, unknown>>): string {
  return hash(normalizeArgs(args));
}

/** Clé viewer SÛRE : jamais un secret. Anonyme n'a pas d'identifiant fabriqué. */
export function viewerKeyOf(viewer: CloneChatViewer): string {
  return viewer.kind === "user" ? `user:${viewer.userId}` : "anon";
}

/** Clé tenant strictement scopée : companyId réel si résolu, sinon "none" (jamais inter-tenant). */
export function tenantKeyOf(tenant: TenantResolution | null): string {
  return tenant && tenant.ok === true ? `co:${tenant.companyId}` : "none";
}

/** Hash de plan : lie action + version + arguments + viewer + tenant. Un changement invalide tout. */
export function planHashOf(actionId: string, actionVersion: string, argsHash: string, viewerKey: string, tenantKey: string): string {
  return hash(["plan", actionId, actionVersion, argsHash, viewerKey, tenantKey].join("|"));
}

/** Clé d'idempotence scopée (action + args + viewer + tenant + version). */
export function idempotencyKeyOf(planHash: string): string {
  return `act_${planHash}`;
}
