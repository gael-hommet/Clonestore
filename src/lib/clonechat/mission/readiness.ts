// src/lib/clonechat/mission/readiness.ts
//
// Readiness Gate DÉTERMINISTE : décide si une demande est assez précise / correspond à une capacité
// réelle / peut être préparée / nécessite clarification / information / permission / confirmation /
// revue humaine / est non supportée / interdite / dépend d'un runtime indisponible. Le modèle ne
// peut jamais déclarer la mission prête, ajouter une capacité, inventer une permission, retirer une
// confirmation, choisir le tenant, diminuer le risque, ni inventer une mission créée/exécutée.

import type { CloneChatContext } from "@/lib/clonechat/context";
import type { MissionType, MissionInputKey, ReadinessResult } from "./types";

export interface ReadinessInput {
  readonly type: MissionType;
  readonly missingInputs: readonly MissionInputKey[];
  readonly context: CloneChatContext;
  readonly securityRefusal: boolean; // injection / contournement de gouvernance détecté en amont
}

/** Évalue la préparabilité. Pur, déterministe. */
export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const { type, missingInputs, context, securityRefusal } = input;
  const base = { missingInputs, requiresConfirmation: false, requiresHumanReview: false };

  // 1) Sécurité : un contournement/une injection est INTERDIT (jamais préparé/exécuté).
  if (securityRefusal) {
    return { ...base, decision: "forbidden", status: "blocked", reason: "Demande refusée : contournement de gouvernance ou injection." };
  }
  // 2) Non supportée.
  if (type === "unsupported") {
    return { ...base, decision: "unsupported", status: "unavailable", reason: "Cette demande n'est pas supportée par CloneChat." };
  }
  // 3) Ambiguë.
  if (type === "ambiguous") {
    return { ...base, decision: "needs_clarification", status: "needs_clarification", reason: "La demande est ambiguë : une précision est nécessaire." };
  }
  // 4) Sensible / revue humaine obligatoire.
  if (type === "sensitive" || type === "human_review") {
    return { ...base, decision: "needs_human_review", status: "requires_human_review", requiresHumanReview: true, reason: "Demande sensible : une revue humaine est requise avant toute préparation d'exécution." };
  }
  // 5) Informations manquantes.
  if (missingInputs.length > 0) {
    const objMissing = missingInputs.includes("objective") || missingInputs.includes("expected_result");
    return { ...base, decision: objMissing ? "insufficient_detail" : "needs_information", status: "collecting_information", reason: `Informations nécessaires manquantes : ${missingInputs.join(", ")}.` };
  }
  // 6) Action métier : jamais exécutée ici. Prérequis réels d'abord ; sinon confirmation + runtime indisponible.
  if (type === "business_action") {
    if (!context.viewer.authenticated || !context.tenant.resolved) {
      return { ...base, decision: "needs_permission", status: "blocked", reason: "Une action métier nécessite un compte et une entreprise active." };
    }
    if (!context.pierre.granted) {
      return { ...base, decision: "needs_permission", status: "blocked", reason: "Une action métier nécessite un droit Pierre actif." };
    }
    // Compte + entreprise + Pierre OK : on peut préparer un PAQUET, jamais exécuter (runtime indisponible).
    return { ...base, decision: "needs_confirmation", status: "requires_confirmation", requiresConfirmation: true, reason: "Action métier : un paquet préparatoire peut être produit ; l'exécution reste indisponible (validation humaine + confirmation requises)." };
  }
  // 7) Préparation conversationnelle (informative/advice/analysis/preparation/document_draft) : préparable.
  return { ...base, decision: "can_prepare", status: "ready_to_prepare", reason: "La demande est suffisamment définie pour préparer un brouillon/plan sûr." };
}
