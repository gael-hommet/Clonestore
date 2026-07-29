// Analytics — authentification QA serveur-uniquement pour la classification `test` en Production.
//
// PROBLÈME DE MESURE (fail-open interdit) : en Production, l'en-tête public `x-clonestore-test`
// ne doit JAMAIS suffire à classer un visiteur en trafic `test`. Un en-tête public non authentifié
// laisserait n'importe quel client masquer son trafic réel et évider/polluer des métriques
// commerciales append-only. `classifyTraffic` ignore donc `x-clonestore-test` en Production.
//
// SOLUTION : la seule façon d'obtenir une classification `test` en Production est de présenter un
// secret serveur (`CLONESTORE_ANALYTICS_QA_TOKEN`) via l'en-tête privé `x-clonestore-qa-token`,
// comparé en temps constant. Toute absence/erreur de configuration échoue de manière fermée
// (retourne false → `external`, jamais `test`).
//
// SURFACE : ce module importe `node:crypto` → il est intrinsèquement serveur et ne doit jamais être
// importé par un Client Component (Next.js refuserait de le bundler, ce que le build vérifie). Le
// secret n'est lu qu'ici depuis `process.env` côté serveur : jamais exposé via NEXT_PUBLIC_*,
// jamais journalisé, jamais renvoyé dans une réponse, jamais écrit dans un événement. Cette fonction
// ne renvoie qu'un booléen — elle ne restitue jamais le token.
//
// PÉRIMÈTRE STRICT : un token QA valide ne produit QUE `traffic_class=test`. Il ne permet jamais de
// falsifier une vérité serveur (source=server, reservation_created, payment_succeeded…), de choisir
// son trust_level / environment / visitor_id / session_id, de contourner la validation de schéma ni
// le rate limiting — tous ces contrôles vivent en amont et hors de la classification (voir route.ts).

import { timingSafeEqual } from "node:crypto";

/** Longueur minimale exigée du secret configuré. Un secret plus court est refusé (fail-closed) :
 *  une configuration faible ne doit jamais ouvrir la classification `test` en Production. */
export const QA_TOKEN_MIN_LENGTH = 32;

/**
 * Comparaison de token résistante au timing. Fail-closed sur tous les cas dégradés :
 *  - `provided` absent/vide            → false
 *  - `configured` absent/vide          → false
 *  - `configured` < QA_TOKEN_MIN_LENGTH → false (secret mal configuré = refus)
 *  - longueurs de buffers différentes   → false AVANT `timingSafeEqual` (qui exige des tailles égales)
 *
 * Ne journalise ni ne renvoie jamais aucune portion des tokens ; ne lève jamais d'exception.
 */
export function constantTimeTokenEqual(
  provided: string | null | undefined,
  configured: string | null | undefined,
): boolean {
  if (!provided || !configured) return false;
  if (configured.length < QA_TOKEN_MIN_LENGTH) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const configuredBuffer = Buffer.from(configured, "utf8");
  // `timingSafeEqual` lève si les longueurs diffèrent : on garde-fou en amont. Cette comparaison de
  // longueur fuit uniquement la taille (jamais le contenu), ce qui est acceptable et attendu.
  if (providedBuffer.length !== configuredBuffer.length) return false;

  return timingSafeEqual(providedBuffer, configuredBuffer);
}

export interface ProductionQaRequestInput {
  /** Environnement analytique résolu côté serveur (jamais dérivé d'un signal client). */
  environment: "production" | "preview" | "development" | "test";
  /** Valeur brute de l'en-tête privé reçu (`x-clonestore-qa-token`), ou null si absent. */
  providedToken: string | null | undefined;
  /** Secret serveur (`process.env.CLONESTORE_ANALYTICS_QA_TOKEN`), ou undefined si non configuré. */
  configuredToken: string | null | undefined;
}

/**
 * Vrai UNIQUEMENT si les trois conditions sont réunies :
 *  1. l'environnement analytique résolu vaut réellement `production` ;
 *  2. un secret QA suffisamment long est configuré côté serveur ;
 *  3. l'en-tête privé reçu correspond exactement au secret (comparaison temps constant).
 *
 * Hors Production, retourne toujours false : la doctrine `x-clonestore-test` des environnements
 * non-prod est gérée séparément par `classifyTraffic` (jamais par ce chemin authentifié). Toute
 * absence/erreur de configuration échoue de manière fermée — retourne false, jamais d'exception.
 */
export function isAuthenticatedProductionQaRequest(input: ProductionQaRequestInput): boolean {
  if (input.environment !== "production") return false;
  return constantTimeTokenEqual(input.providedToken, input.configuredToken);
}
