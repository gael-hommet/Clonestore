// src/lib/clonechat/durable/proposal-expiry.ts
// P16D — EXPIRATION d'une proposition (= d'une approbation humaine). Pur, déterministe.
//
// Une proposition persistée EST l'approbation que l'humain confirmera : le client ne renvoie
// qu'un `proposalId`, le serveur recharge et reconstruit la commande. Sans borne temporelle,
// une proposition confirmée restait exécutable INDÉFINIMENT — un onglet laissé ouvert des
// semaines, ou un `proposalId` rejoué plus tard, ré-autorisait l'action alors que le contexte
// (rôle, entreprise, effectif, entitlement) avait pu changer entre-temps.
//
// Doctrine P16D : « approbation EXPIRÉE → AUTORISÉ » doit ÉCHOUER FERMÉ. La borne est dérivée
// de `created_at`, qui est IMMUABLE : l'expiration est donc une fonction pure de la proposition
// et reste STABLE d'une reprise à l'autre (elle peut entrer dans l'identité canonique de la
// commande sans jamais casser l'idempotence d'un rejeu légitime).
//
// Aucune migration : `clonechat_proposals.created_at` existe déjà.

/** Durée de vie d'une proposition. Au-delà, la confirmation n'autorise plus rien. */
export const PROPOSAL_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type ProposalFreshness =
  | { readonly state: "fresh"; readonly expiresAt: string }
  | { readonly state: "expired"; readonly expiresAt: string }
  | { readonly state: "unknown" }; // created_at absent/illisible ⇒ AUCUNE preuve de fraîcheur

/** Instant d'expiration (ISO) dérivé de `created_at`. `null` si la date est illisible. */
export function proposalExpiresAt(createdAt: string | null | undefined, ttlMs: number = PROPOSAL_TTL_MS): string | null {
  if (!createdAt) return null;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return null;
  return new Date(t + ttlMs).toISOString();
}

/**
 * Fraîcheur d'une proposition. FAIL-CLOSED : une date de création absente ou illisible ne
 * vaut PAS une preuve de fraîcheur — elle rend l'état `unknown`, que l'appelant DOIT refuser
 * au même titre qu'une expiration (une preuve absente n'est jamais une preuve positive).
 */
export function proposalFreshness(
  createdAt: string | null | undefined,
  now: Date = new Date(),
  ttlMs: number = PROPOSAL_TTL_MS,
): ProposalFreshness {
  const expiresAt = proposalExpiresAt(createdAt, ttlMs);
  if (!expiresAt) return { state: "unknown" };
  return Date.parse(expiresAt) > now.getTime() ? { state: "fresh", expiresAt } : { state: "expired", expiresAt };
}

/** Vrai SEULEMENT si la proposition est prouvée fraîche. `unknown` ⇒ false (fail-closed). */
export function isProposalExecutable(
  createdAt: string | null | undefined,
  now: Date = new Date(),
  ttlMs: number = PROPOSAL_TTL_MS,
): boolean {
  return proposalFreshness(createdAt, now, ttlMs).state === "fresh";
}
