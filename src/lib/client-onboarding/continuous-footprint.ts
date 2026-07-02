// Client Onboarding — Empreinte continue (P9.2, Étape 7, cœur PUR).
//
// Invariant central : une information PROPOSÉE (par Pierre ou importée) n'est
// JAMAIS adoptée silencieusement — elle exige une validation humaine explicite.
// Chaque décision est traçable. Aucune donnée n'est simulée : si la liste est
// vide, l'UI affiche un état vide réel. Déterministe → testable en `node`.

import type {
  ContinuousFootprintEntryContract,
  FootprintProvenance,
} from "@/lib/onboarding-foundations/client-onboarding-contracts";

export type ContinuousDecision = "to_verify" | "accepted" | "refused" | "replaced";

export interface ContinuousEntry extends ContinuousFootprintEntryContract {
  readonly id: string;
  readonly decision: ContinuousDecision;
}

export const CONTINUOUS_EMPTY_MESSAGE = "Aucune information à confirmer pour le moment.";

/** Une proposition non-humaine requiert une validation humaine avant adoption. */
export function requiresValidation(entry: ContinuousFootprintEntryContract): boolean {
  return entry.provenance !== "human";
}

/** Peut-elle être adoptée dans l'empreinte ? Jamais si non validée et requiseValidation. */
export function canAdopt(entry: ContinuousFootprintEntryContract): boolean {
  if (!requiresValidation(entry)) return true;
  return entry.validated === true;
}

/** Accepter tel quel : marque validé + décision « accepted ». */
export function acceptEntry(entry: ContinuousEntry): ContinuousEntry {
  return { ...entry, validated: true, decision: "accepted" };
}

/** Refuser : décision « refused », jamais adopté. */
export function refuseEntry(entry: ContinuousEntry): ContinuousEntry {
  return { ...entry, validated: false, decision: "refused" };
}

/**
 * Modifier puis accepter : la valeur devient humaine (provenance human),
 * validée, décision « replaced » (remplace la proposition d'origine).
 */
export function replaceEntry(entry: ContinuousEntry, newValue: string): ContinuousEntry {
  return {
    ...entry,
    value: newValue,
    provenance: "human" as FootprintProvenance,
    requiresHumanValidation: false,
    validated: true,
    decision: "replaced",
  };
}

/** Entrées encore à traiter (à vérifier). */
export function pendingEntries(entries: readonly ContinuousEntry[]): ContinuousEntry[] {
  return entries.filter((e) => e.decision === "to_verify");
}

export function isEmpty(entries: readonly ContinuousEntry[]): boolean {
  return entries.length === 0;
}

/**
 * Adopte dans l'empreinte uniquement les entrées réellement adoptables
 * (humaines, ou proposées ET validées ET acceptées/remplacées).
 */
export function adoptableEntries(entries: readonly ContinuousEntry[]): ContinuousEntry[] {
  return entries.filter(
    (e) => (e.decision === "accepted" || e.decision === "replaced") && canAdopt(e),
  );
}
