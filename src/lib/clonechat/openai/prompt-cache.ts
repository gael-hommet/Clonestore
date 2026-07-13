// src/lib/clonechat/openai/prompt-cache.ts
// C1.7 §10 — CACHE DE PROMPT VERSIONNÉ (pur, testable).
//
// Le préfixe STABLE (identité CloneChat, vérité produit publique, doctrine, gouvernance, format)
// est identique pour TOUS les visiteurs : il est donc mis en cache et refacturé au tarif « cached ».
// Le suffixe DYNAMIQUE (viewer, contexte entreprise vérifié, extraits, message) ne l'est jamais.
//
// LA RÈGLE DE SÉCURITÉ QUI GOUVERNE TOUT :
//   Une clé de cache PUBLIQUE ne doit JAMAIS dépendre d'un utilisateur, d'une entreprise, ni de
//   données privées — sinon deux tenants pourraient partager un préfixe, ou un préfixe « public »
//   contiendrait de la donnée privée. Ici c'est STRUCTUREL : la clé publique se calcule à partir
//   de la seule VÉRITÉ PUBLIQUE VERSIONNÉE, et rien d'autre ne peut y entrer.

import { createHash } from "node:crypto";

/** Version de la vérité produit publique. La changer INVALIDE tout préfixe périmé. */
export const CLONECHAT_PUBLIC_PROMPT_VERSION = "c1.7-public-1";

export type CacheDomain = "public" | "company" | "conversation";

export interface CacheKeyInput {
  readonly domain: CacheDomain;
  /** Version de la connaissance publique (obligatoire pour tous les domaines). */
  readonly publicVersion: string;
  /** Domaine « company » UNIQUEMENT : entreprise vérifiée SERVEUR + version de son contexte. */
  readonly companyId?: string | null;
  readonly companyContextVersion?: string | null;
  /** Domaine « conversation » UNIQUEMENT. */
  readonly conversationId?: string | null;
}

/** Champs INTERDITS dans un préfixe public — la liste est appliquée, pas seulement documentée. */
const FORBIDDEN_IN_PUBLIC = ["userId", "companyId", "conversationId", "email", "token", "employee"] as const;

export class PublicCachePoisoning extends Error {}

/**
 * Clé de cache. Les DOMAINES sont étanches :
 *   · public       → dépend UNIQUEMENT de la version publique ;
 *   · company      → isolé par entreprise + version de contexte ;
 *   · conversation → isolé par conversation.
 * Aucun identifiant ne peut « fuiter » d'un domaine vers un autre.
 */
export function cacheKey(input: CacheKeyInput): string {
  const h = createHash("sha256");
  h.update(`v=${input.publicVersion}|d=${input.domain}`);

  if (input.domain === "public") {
    // FAIL-CLOSED : la moindre identité passée au domaine public est une ERREUR, pas un avertissement.
    if (input.companyId || input.conversationId) {
      throw new PublicCachePoisoning("Une clé de cache PUBLIQUE ne peut contenir ni entreprise ni conversation.");
    }
    return `cc_pub_${h.digest("hex").slice(0, 32)}`;
  }

  if (input.domain === "company") {
    if (!input.companyId) throw new PublicCachePoisoning("Le domaine « company » exige une entreprise vérifiée serveur.");
    h.update(`|c=${input.companyId}|cv=${input.companyContextVersion ?? "0"}`);
    return `cc_co_${h.digest("hex").slice(0, 32)}`;
  }

  if (!input.conversationId) throw new PublicCachePoisoning("Le domaine « conversation » exige une conversation.");
  h.update(`|conv=${input.conversationId}`);
  return `cc_cv_${h.digest("hex").slice(0, 32)}`;
}

/**
 * Garde d'assemblage : le PRÉFIXE STABLE ne doit contenir aucune donnée dynamique. On refuse tout
 * préfixe qui embarque un horodatage, un identifiant, une adresse — autant de poisons de cache
 * (ils rendraient le préfixe unique par requête, donc jamais réutilisable, et potentiellement privé).
 */
const DYNAMIC_POISON: readonly RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, // horodatage ISO
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // uuid
  /[\w.+-]+@[\w-]+\.[\w.]+/, // e-mail
  /\bsk-[A-Za-z0-9_-]{20,}/, // clé
];

export function assertStablePrefix(prefix: string): void {
  for (const rx of DYNAMIC_POISON) {
    if (rx.test(prefix)) throw new PublicCachePoisoning("Le préfixe STABLE contient une donnée dynamique (horodatage, identifiant, e-mail ou secret).");
  }
  for (const field of FORBIDDEN_IN_PUBLIC) {
    if (new RegExp(`"${field}"\\s*:`).test(prefix)) {
      throw new PublicCachePoisoning(`Le préfixe STABLE contient le champ interdit « ${field} ».`);
    }
  }
}

export interface AssembledPrompt {
  readonly stablePrefix: string;
  readonly dynamicSuffix: string;
  readonly cacheKey: string;
  readonly cacheable: boolean;
}

/**
 * Assemble un prompt en DEUX parties : stable (mis en cache) puis dynamique (jamais).
 * L'ordre est essentiel — un cache de préfixe n'opère que si le début est identique octet pour octet.
 */
export function assemblePrompt(input: {
  readonly stablePrefix: string;
  readonly dynamicSuffix: string;
  readonly domain: CacheDomain;
  readonly publicVersion?: string;
  readonly companyId?: string | null;
  readonly companyContextVersion?: string | null;
  readonly conversationId?: string | null;
}): AssembledPrompt {
  assertStablePrefix(input.stablePrefix); // fail-closed AVANT toute mise en cache
  const key = cacheKey({
    domain: input.domain,
    publicVersion: input.publicVersion ?? CLONECHAT_PUBLIC_PROMPT_VERSION,
    companyId: input.companyId ?? null,
    companyContextVersion: input.companyContextVersion ?? null,
    conversationId: input.conversationId ?? null,
  });
  return Object.freeze({
    stablePrefix: input.stablePrefix,
    dynamicSuffix: input.dynamicSuffix,
    cacheKey: key,
    // Un préfixe trop court n'est pas rentable à mettre en cache : on ne le prétend pas.
    cacheable: input.stablePrefix.length >= 1024,
  });
}
