// src/lib/clonechat/intelligence/c1-1/parrain-technology-index.ts
// C1.1 — Connaissance T1/T2 DÉRIVÉE des registres réels (statuts vivants), enrichie des
// explications éditoriales C1 (cross-checkées par le command center C1). Distinctions
// tenues : DocumentTech ≠ travail documentaire de Pierre ; VoiceTech/CloneVoice ≠
// CloneCall ; CloneCall safe-local ≠ téléphonie ; CloneOS ≠ Pierre ; CloneLearn =
// propositions ; CloneBrief = faits fournis ; CloneRoom = tout-via-CloneOS.

import { listTechnologyRegistryEntries } from "@/lib/clonestore/technologies/t1";
import { listProductTechnologyRegistryEntries } from "@/lib/clonestore/product-technologies/t2";
import { technologyKnowledgeById, findTechnologyInText } from "../c1/clonechat-technology-knowledge";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import type { ParrainKnowledgeChunk } from "./parrain-types";

export interface ParrainTechnologyEntry {
  readonly id: string;
  readonly layer: "t1" | "t2";
  readonly name: string;
  readonly liveStatus: string; // statut EXACT du registre réel (jamais copié à la main)
  readonly liveBlockedReason: string | null;
  readonly clientExplanation: string;
  readonly internalExplanation: string;
  readonly canClaim: readonly string[];
  readonly cannotClaim: readonly string[];
}

/** Index vivant : statuts lus des registres T1/T2 réels à chaque construction. */
export function buildTechnologyIndex(): readonly ParrainTechnologyEntry[] {
  const t1 = listTechnologyRegistryEntries().map((e) => {
    const k = technologyKnowledgeById(e.id);
    return Object.freeze({
      id: e.id,
      layer: "t1" as const,
      name: k?.name ?? e.id,
      liveStatus: e.status,
      liveBlockedReason: e.contract.liveDependency !== "none" ? (k?.doesNotContain.join(" ; ") ?? "dépendance live non vérifiée") : null,
      clientExplanation: k?.clientExplanation ?? e.contract.purpose,
      internalExplanation: k?.internalExplanation ?? `T1 ${e.id} — statut registre : ${e.status}.`,
      canClaim: k?.canClaim ?? [],
      cannotClaim: k?.cannotClaim ?? [],
    });
  });
  const t2 = listProductTechnologyRegistryEntries().map((e) => {
    const k = technologyKnowledgeById(e.id);
    return Object.freeze({
      id: e.id,
      layer: "t2" as const,
      name: k?.name ?? e.id,
      liveStatus: e.status,
      liveBlockedReason: e.contract.liveBlockedReason ?? null,
      clientExplanation: k?.clientExplanation ?? e.definition,
      internalExplanation: k?.internalExplanation ?? `T2 ${e.id} — statut registre : ${e.status}, mode ${e.contract.mode}.`,
      canClaim: k?.canClaim ?? [],
      cannotClaim: k?.cannotClaim ?? [],
    });
  });
  return Object.freeze([...t1, ...t2]);
}

export function technologyCounts(): { t1: number; t2: number } {
  return { t1: listTechnologyRegistryEntries().length, t2: listProductTechnologyRegistryEntries().length };
}

export function technologyEntryById(id: string): ParrainTechnologyEntry | null {
  return buildTechnologyIndex().find((e) => e.id === id) ?? null;
}

/** Détection d'une technologie dans une question libre (réutilise le matcher C1 vérifié). */
export function technologyFromQuestion(question: string): ParrainTechnologyEntry | null {
  const k = findTechnologyInText(question);
  return k ? technologyEntryById(k.id) : null;
}

/** Distinctions doctrine explicites — servies quand la question confond deux couches. */
export const TECHNOLOGY_DISTINCTIONS: readonly { readonly rx: RegExp; readonly text: string }[] = Object.freeze([
  { rx: /documenttech.*pierre|pierre.*documenttech/i, text: "DocumentTech est la brique générique de préparation ; le travail documentaire RH (contenu, contexte salarié, validation) reste porté par Pierre." },
  { rx: /voicetech.*clonevoice|clonevoice.*voicetech/i, text: "VoiceTech (T1) est le repli d'entrée vocale bas-niveau ; CloneVoice (T2) est le système produit — tous deux sans voix opérationnelle aujourd'hui." },
  { rx: /clonevoice.*clonecall|clonecall.*clonevoice/i, text: "CloneVoice traite l'entrée vocale (texte autoritaire) ; CloneCall est la session de travail « comme un appel » — sans téléphonie réelle." },
  { rx: /clonecall.*(téléphon|telephon)|téléphonie.*clonecall/i, text: "CloneCall fonctionne en safe local : aucun appel téléphonique réel, double verrou tant que provider télécom et cadre légal ne sont pas vérifiés." },
  { rx: /cloneos.*pierre|pierre.*cloneos/i, text: "CloneOS orchestre les missions ; Pierre est l'employé RH — le raisonnement RH vit chez Pierre, jamais dans CloneOS." },
  { rx: /clonetrace.*historique|historique.*clonetrace/i, text: "CloneTrace n'est pas un simple historique : chaque événement porte liens, raison et pointeur de reprise, sur l'évidence T1 réelle." },
  { rx: /cloneadn.*m[ée]moire|m[ée]moire.*cloneadn/i, text: "CloneADN porte le comportement de l'entreprise (ton, circuits) — pas la mémoire brute ; toute évolution est une proposition à valider." },
  { rx: /clonepolicy.*cloneguard|cloneguard.*clonepolicy/i, text: "ClonePolicy transforme vos règles en comportement machine ; CloneGuard classe le risque et décide autoriser/valider/bloquer/refuser." },
  { rx: /clonetrust.*permission|permission.*clonetrust/i, text: "CloneTrust gradue l'autonomie gagnée (plafonnée par la politique) ; les permissions restent la porte d'accès fail-closed." },
  { rx: /cloneroom.*(direct|pair|p2p)/i, text: "CloneRoom coordonne TOUT via CloneOS : aucun échange direct IA↔IA." },
]);

export function distinctionForQuestion(question: string): string | null {
  return TECHNOLOGY_DISTINCTIONS.find((d) => d.rx.test(question))?.text ?? null;
}

/** Chunks technologiques (bornés à la techno visée + distinctions éventuelles). */
export function technologyChunks(question: string): readonly ParrainKnowledgeChunk[] {
  const chunks: ParrainKnowledgeChunk[] = [];
  const entry = technologyFromQuestion(question);
  if (entry) {
    chunks.push(
      makeParrainChunk({
        id: `tech.${entry.id}`,
        sourceId: entry.layer === "t1" ? "src.t1_registry" : "src.t2_registry",
        title: entry.name,
        text: `${entry.name} — statut registre : ${entry.liveStatus}. ${entry.clientExplanation}${entry.liveBlockedReason ? ` Verrou live : ${entry.liveBlockedReason}` : ""}`,
        sourceType: "technology_registry",
        authority: "canonical_registry",
        visibility: "PUBLIC",
        citationLabel: `la technologie ${entry.name}`,
      }),
    );
  }
  const distinction = distinctionForQuestion(question);
  if (distinction) {
    chunks.push(
      makeParrainChunk({
        id: `tech.distinction.${chunks.length}`,
        sourceId: "src.t2_registry",
        title: "Distinction doctrine",
        text: distinction,
        sourceType: "technology_registry",
        authority: "canonical_registry",
        visibility: "PUBLIC",
        citationLabel: "la doctrine technologies",
      }),
    );
  }
  return chunks;
}
