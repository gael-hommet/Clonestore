// src/lib/pierre/access.ts
// C1.4 — CONTRAT D'ACCÈS PIERRE TYPÉ (union discriminée).
//
// AVANT : la fonction renvoyait `{ ok, error }`. Un objet est TOUJOURS truthy, donc un
// consommateur écrivant `if (!access) { refuser }` ne refusait JAMAIS rien
// (cf. src/app/api/assistant/chat/route.ts — corrigé en C1.4). La forme typée ci-dessous
// rend ce mauvais usage impossible à ignorer : il n'existe plus de booléen implicite.
//
// RÈGLES :
//   · seuls `active` et `trialing` accordent le droit opérationnel Pierre ;
//   · toute autre valeur (cancelled/unpaid/incomplete/expired/refunded/inconnue) = NO_ENTITLEMENT ;
//   · un échec de requête n'est JAMAIS confondu avec une absence de droit → LOOKUP_FAILED ;
//   · le droit provient UNIQUEMENT de l'enregistrement `orders` côté serveur ;
//     il n'est jamais lu du corps de requête (aucune forge client possible) ;
//   · `error` est un CODE SÛR et stable — jamais le message brut de la base
//     (les routes qui renvoient `access.error` au client ne fuitent donc plus le schéma).

import type { SupabaseClient } from "@supabase/supabase-js";

/** Statuts de commande qui accordent l'accès opérationnel à Pierre (l'essai compte). */
export const PIERRE_ACTIVE_STATUSES = ["active", "trialing"] as const;
export type PierreEntitlementStatus = (typeof PIERRE_ACTIVE_STATUSES)[number];

/** Code d'erreur SÛR renvoyable au client (jamais le message brut du provider). */
export const PIERRE_ACCESS_LOOKUP_FAILED = "PIERRE_ACCESS_LOOKUP_FAILED" as const;

export type PierreAccessResult =
  | { readonly ok: true; readonly status: PierreEntitlementStatus; readonly orderId: string; readonly error: null }
  | { readonly ok: false; readonly reason: "NO_ENTITLEMENT"; readonly error: null }
  | { readonly ok: false; readonly reason: "LOOKUP_FAILED"; readonly error: typeof PIERRE_ACCESS_LOOKUP_FAILED };

/** Garde typée : rend le mauvais usage (truthiness d'objet) difficile. */
export function isPierreAccessGranted(result: PierreAccessResult): result is Extract<PierreAccessResult, { ok: true }> {
  return result.ok === true;
}

/** Le droit Pierre est-il *inconnu* (panne de vérification) plutôt qu'absent ? */
export function isPierreAccessLookupFailed(result: PierreAccessResult): boolean {
  return result.ok === false && result.reason === "LOOKUP_FAILED";
}

function normalizeStatus(raw: unknown): PierreEntitlementStatus | null {
  return (PIERRE_ACTIVE_STATUSES as readonly string[]).includes(String(raw))
    ? (String(raw) as PierreEntitlementStatus)
    : null;
}

/**
 * Résout le droit Pierre d'un utilisateur depuis l'enregistrement `orders` (serveur).
 * Ne throw jamais : toute panne → LOOKUP_FAILED (fail-closed pour l'opérationnel).
 */
export async function hasPierreAccess(supabase: SupabaseClient, userId: string): Promise<PierreAccessResult> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id,status")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .in("status", PIERRE_ACTIVE_STATUSES as unknown as string[])
      .maybeSingle();

    // Panne / erreur de requête : JAMAIS interprétée comme « pas de droit ».
    if (error) return { ok: false, reason: "LOOKUP_FAILED", error: PIERRE_ACCESS_LOOKUP_FAILED };

    // Aucune commande active/trialing → pas de droit (état normal, pas une erreur).
    if (!data) return { ok: false, reason: "NO_ENTITLEMENT", error: null };

    // Défense en profondeur : le statut est RE-VALIDÉ côté serveur (jamais présumé).
    const status = normalizeStatus((data as { status?: unknown }).status);
    if (!status) return { ok: false, reason: "NO_ENTITLEMENT", error: null };

    const orderId = String((data as { id?: unknown }).id ?? "");
    if (!orderId) return { ok: false, reason: "NO_ENTITLEMENT", error: null };

    return { ok: true, status, orderId, error: null };
  } catch {
    return { ok: false, reason: "LOOKUP_FAILED", error: PIERRE_ACCESS_LOOKUP_FAILED };
  }
}
