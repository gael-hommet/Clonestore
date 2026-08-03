// src/lib/clonechat/mission/prepare.ts
//
// Préparation d'un PAQUET de mission — UNIQUEMENT lorsque le Readiness Gate l'autorise. Produit un
// brouillon / plan / checklist / informations manquantes / risques / limites / prochaine étape /
// critères observables. NE crée JAMAIS de mission runtime, ne mute aucune donnée RH, ne lance aucune
// automatisation, n'envoie aucun document, ne prétend produire aucun livrable. Idempotent : deux
// préparations de la même demande produisent le MÊME paquet (jamais de double préparation).

import { getRouteEntry } from "@/lib/nav/route-registry";
import { type MissionContract, type MissionStatus } from "./types";

/** Statuts pour lesquels un paquet préparatoire peut être produit. */
const PREPARABLE: ReadonlySet<MissionStatus> = new Set<MissionStatus>(["ready_to_prepare", "requires_confirmation"]);

function planFor(c: MissionContract): string[] {
  const steps: string[] = [];
  switch (c.type) {
    case "informative":
    case "advice":
      steps.push("Reformuler la question en objectif clair.", "Répondre à partir de sources produit/HR canon (jamais inventé).", "Proposer la page réelle utile.");
      break;
    case "analysis":
      steps.push("Cadrer le périmètre et le résultat attendu.", "Lister les données réellement nécessaires (fournies par l'utilisateur).", "Préparer une trame d'analyse (aucune donnée RH réelle modifiée).");
      break;
    case "preparation":
    case "document_draft":
      steps.push("Confirmer l'objectif et le résultat attendu.", "Rassembler les informations et pièces nécessaires (via CloneInspector).", "Préparer un BROUILLON structuré (jamais un document officiel envoyé).", "Soumettre le brouillon à validation humaine.");
      break;
    case "business_action":
      steps.push("Vérifier compte + entreprise + droit Pierre.", "Constituer un PAQUET préparatoire (aucune exécution).", "Exiger une confirmation explicite + une validation humaine.", "Exécution différée : indisponible (runtime non câblé).");
      break;
    default:
      steps.push("Clarifier la demande avant toute préparation.");
  }
  return steps;
}

function deliverableFor(c: MissionContract): string {
  switch (c.type) {
    case "document_draft": return "Brouillon de document (non officiel, à valider par un humain).";
    case "preparation": return "Plan de préparation + checklist (préparatoire).";
    case "analysis": return "Trame d'analyse (aucune donnée réelle modifiée).";
    case "business_action": return "Paquet préparatoire d'action (jamais exécuté).";
    default: return "Réponse ou orientation sûre.";
  }
}

function successCriteriaFor(c: MissionContract): string[] {
  const out = ["L'utilisateur valide que l'objectif préparé correspond à son besoin réel."];
  if (c.type === "document_draft" || c.type === "preparation") out.push("Un humain approuve le brouillon avant toute production officielle.");
  if (c.type === "business_action") out.push("Une confirmation explicite ET une exécution runtime réelle (non disponible ici) seraient requises — le paquet ne prouve aucune exécution.");
  return out;
}

/**
 * Prépare le paquet de mission. Idempotent (même contrat → même paquet). Ne produit un paquet que si
 * le statut est préparable ; sinon renvoie le contrat inchangé. `capabilityAvailable=false` (action
 * métier) → paquet préparatoire mais JAMAIS un statut d'exécution.
 */
export function prepareMissionPackage(contract: MissionContract, opts: { nowMs: number } = { nowMs: contract.updatedAtMs }): MissionContract {
  if (!PREPARABLE.has(contract.status)) return contract; // rien à préparer (clarification/blocked/unavailable/…)
  if (contract.proposedPlan.length > 0) return contract; // déjà préparé (idempotence : pas de double préparation)

  const proposedPlan = planFor(contract);
  const expectedDeliverable = deliverableFor(contract);
  const successCriteria = successCriteriaFor(contract);
  const recommendedRoute = getRouteEntry(contract.recommendedRoute ?? "") ? contract.recommendedRoute : null;

  // Statut final : action métier → reste requires_confirmation (paquet prêt, exécution indisponible) ;
  // sinon → prepared. JAMAIS executed/running/completed.
  const status: MissionStatus = contract.type === "business_action" ? "requires_confirmation" : "prepared";

  return Object.freeze({
    ...contract,
    status,
    proposedPlan: Object.freeze(proposedPlan),
    expectedDeliverable,
    successCriteria: Object.freeze(successCriteria),
    recommendedRoute,
    updatedAtMs: opts.nowMs,
  });
}
