// src/lib/clonestore/technologies/t1/technology-fallbacks.ts
// T1 — Fallbacks sûrs. CHAQUE technologie a une dégradation sûre : si elle n'est pas live,
// elle prépare (ou refuse) et l'HUMAIN complète. Aucune techno ne bloque un employé IA :
// elle dégrade. Module PUR.

import { isTechnologyId, type TechnologyId } from "./technology-types";

export const TECHNOLOGY_FALLBACKS: Readonly<Record<TechnologyId, string>> = Object.freeze({
  document: "Document préparé localement — relecture et validation humaines obligatoires (aucune garantie légale).",
  mail: "Brouillon préparé — l'humain envoie manuellement (aucun envoi live).",
  calendar: "Événement préparé — l'humain copie/valide (aucune création d'événement live).",
  signature: "Document préparé — signature manuelle/externe (aucune revendication de signature live).",
  voice: "L'entrée texte reste la source de vérité (aucun provider vocal).",
  notification: "Rappels dans le cockpit uniquement (aucun push live).",
  connector: "Connecteur indisponible — export/import manuel.",
  memory: "Opération mémoire préparée dans le périmètre société — les stores durables existants restent la source.",
  evidence: "Trace d'audit locale toujours disponible (aucun provider externe requis).",
  workflow: "Le moteur de missions V1 existant reste la source (aucun 2e cerveau RH).",
  analytics: "Métriques brutes uniquement (aucune promesse de ROI garanti).",
  file: "Revue manuelle du fichier requise (aucune hypothèse de parsing).",
  export: "Téléchargement/export manuel (aucun transfert live).",
  permission: "Refus fail-closed — RLS + requireCompanyUser restent la frontière serveur.",
  integration_bus: "Coordination par contrats uniquement — toute techno indisponible dégrade en fallback.",
});

export const UNKNOWN_TECHNOLOGY_FALLBACK = "Technologie inconnue — refus fail-closed.";

/** Fallback sûr d'une technologie (fail-closed si l'id est inconnu). Pur. */
export function getTechnologyFallbackText(technologyId: string): string {
  return isTechnologyId(technologyId) ? TECHNOLOGY_FALLBACKS[technologyId] : UNKNOWN_TECHNOLOGY_FALLBACK;
}

/** Toutes les technologies ont-elles un fallback non vide ? Pur. */
export function allTechnologiesHaveSafeFallback(): boolean {
  return Object.values(TECHNOLOGY_FALLBACKS).every((f) => typeof f === "string" && f.trim().length > 0);
}
