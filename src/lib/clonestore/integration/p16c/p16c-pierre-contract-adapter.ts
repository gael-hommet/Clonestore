// src/lib/clonestore/integration/p16c/p16c-pierre-contract-adapter.ts
// P16C — CONSOMMATION du VRAI contrat P16A (PierreUltimateIntegrationContract). Ce module NE crée AUCUNE
// interprétation RH, AUCUN planificateur, AUCUN 2e cerveau : il VALIDE le contrat (version, tenant, capacités
// réelles, floors human-only non forgés, entités interdites, technologies connues) puis le laisse passer TEL
// QUEL. Toute forge (downgrade d'un floor human-only, entité cross-tenant, capacité/techno inconnue, mauvais
// tenant) est REJETÉE fail-closed. Les blocages provider/legal produits par Pierre sont PRÉSERVÉS, jamais
// abaissés. Pur, déterministe, sans secret.

import { isKnownCapability } from "@/lib/pierre/v1/cognitive-runtime/capability-retrieval";
import { isTechnologyId } from "@/lib/clonestore/technologies/t1";
import { isProductTechnologyId } from "@/lib/clonestore/product-technologies/t2";
import type { PierreUltimateIntegrationContract } from "@/lib/pierre/v1/ultimate/p16a";

export interface P16CContractIdentity {
  readonly companyId: string;
  readonly actorId: string;
}

export interface P16CContractConsumption {
  readonly accepted: boolean;
  readonly rejectedReason: string | null;
  /** RÈGLE DURE : P16C ne réinterprète jamais la RH — toujours false. */
  readonly reinterpretedHr: false;
  readonly issues: readonly string[];
  /** Le contrat validé (identique à l'entrée) — null si rejeté. */
  readonly contract: PierreUltimateIntegrationContract | null;
  // Signaux dérivés (pour la gouvernance) — jamais recalculés depuis la RH.
  readonly humanOnly: boolean;
  readonly forbiddenEntities: readonly string[];
  readonly unknownCapabilities: readonly string[];
  readonly unknownTechnologies: readonly string[];
}

const CONTRACT_VERSION_SUPPORTED = 1 as const;

function reject(reason: string, issues: string[]): P16CContractConsumption {
  return {
    accepted: false, rejectedReason: reason, reinterpretedHr: false, issues,
    contract: null, humanOnly: false, forbiddenEntities: [], unknownCapabilities: [], unknownTechnologies: [],
  };
}

/**
 * Valide + consomme le contrat P16A pour un tenant/acteur RÉSOLU SERVEUR. Fail-closed. Ne modifie pas le
 * contrat (Pierre reste l'autorité RH). `expected` vient TOUJOURS du serveur (jamais du client).
 */
export function consumePierreContract(
  contract: PierreUltimateIntegrationContract | null | undefined,
  expected: P16CContractIdentity,
): P16CContractConsumption {
  const issues: string[] = [];
  if (!contract || typeof contract !== "object") return reject("Contrat P16A absent.", issues);

  // 1) Version — une version non supportée est rejetée (jamais d'interprétation permissive).
  if (contract.version !== CONTRACT_VERSION_SUPPORTED) {
    return reject(`Version de contrat non supportée : ${String((contract as { version?: unknown }).version)}.`, issues);
  }

  // 2) Tenant/acteur — DOIT correspondre au périmètre serveur (isolation dure).
  const expCompany = (expected.companyId ?? "").trim();
  const expActor = (expected.actorId ?? "").trim();
  if (!expCompany || !expActor) return reject("Périmètre serveur incomplet (companyId/actorId requis).", issues);
  if ((contract.companyId ?? "").trim() !== expCompany) {
    return reject("Tenant du contrat ≠ tenant serveur — refus cross-tenant.", issues);
  }
  if ((contract.actorId ?? "").trim() !== expActor) {
    return reject("Acteur du contrat ≠ acteur serveur — refus.", issues);
  }

  // 3) capabilityCount DÉRIVÉ du registre — un contrat qui prétend le contraire est forgé.
  if (contract.capabilityCountDerivedFromRegistry !== true) {
    return reject("capabilityCountDerivedFromRegistry ≠ true — contrat forgé (2e registre suspecté).", issues);
  }

  // 4) Capacités : chaque id sélectionné DOIT exister dans l'UNIQUE registre RH réel.
  const unknownCapabilities = (contract.selectedCapabilityIds ?? []).filter((id) => !isKnownCapability(id));
  if (unknownCapabilities.length > 0) {
    return reject(`Capacité(s) inconnue(s) hors registre RH : ${unknownCapabilities.join(", ")}.`, issues);
  }

  // 5) Floors human-only : un downgrade forgé (décisions human-only présentes MAIS disposition non human_only)
  //    est REJETÉ — P16C n'abaisse jamais un floor produit par Pierre.
  const humanOnlyDecisions = contract.autonomy?.humanOnlyDecisions ?? [];
  const disposition = contract.autonomy?.overallDisposition;
  const humanOnly = disposition === "human_only" || humanOnlyDecisions.length > 0;
  if (humanOnlyDecisions.length > 0 && disposition !== "human_only") {
    return reject("Floor human-only forgé : décisions human-only présentes mais disposition abaissée — refus.", issues);
  }

  // 6) Entités interdites (cross-tenant / hors périmètre) : présence ⇒ blocage permission dur.
  const forbiddenEntities = (contract.understanding?.resolvedEntities ?? [])
    .filter((e) => e.status === "forbidden")
    .map((e) => e.label);
  if (forbiddenEntities.length > 0) {
    return reject(`Entité(s) hors périmètre (cross-tenant) référencée(s) : ${forbiddenEntities.join(", ")} — Pierre n'agit pas.`, issues);
  }

  // 7) Technologies déclarées : chaque techId T1/T2 DOIT exister (aucune techno inventée acceptée).
  const unknownT1 = (contract.t1Needs ?? []).map((n) => n.techId).filter((id) => !isTechnologyId(id));
  const unknownT2 = (contract.t2Needs ?? []).map((n) => n.techId).filter((id) => !isProductTechnologyId(id));
  const unknownTechnologies = [...unknownT1, ...unknownT2];
  if (unknownTechnologies.length > 0) {
    return reject(`Technologie(s) déclarée(s) inconnue(s) : ${unknownTechnologies.join(", ")}.`, issues);
  }

  return {
    accepted: true,
    rejectedReason: null,
    reinterpretedHr: false,
    issues,
    contract,
    humanOnly,
    forbiddenEntities,
    unknownCapabilities,
    unknownTechnologies,
  };
}
