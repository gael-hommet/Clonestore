// src/lib/clonestore/product-technologies/t2/clonevoice-product-tech.ts
// T2 — CloneVoice : la couche d'entrée vocale naturelle. ARCHITECTURE-READY, PAS de voix live :
// aucun provider vocal, aucun enregistrement audio réel — LE TEXTE RESTE LA SOURCE DE VÉRITÉ.
// Fait (sur transcript TEXTE fourni) : nettoyage du langage parlé, détection d'intention
// principale, segmentation multi-actions, contexte oral minimal. Ne fait PAS : orchestration,
// risque, mémoire d'entreprise, qualité métier, timeline. CONSOMME T1 VoiceTech (fallback canonique).

import { voiceTech, type VoiceFallbackArtifact } from "@/lib/clonestore/technologies/t1";
import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import { classifyIntentKind, segmentIntoActions } from "./cloneos-product-tech";
import type { IntentKind } from "./product-technology-types";

export interface CloneVoiceInput {
  /** Transcript TEXTE fourni par l'humain — la seule entrée autoritaire en T2. */
  readonly transcriptText?: string;
  /** Référence audio éventuelle — JAMAIS traitée en T2 (aucun provider). */
  readonly audioRef?: string;
}

export interface CloneVoiceIntentArtifact {
  readonly artifactKind: "clonevoice_intent";
  readonly source: "text_fallback";
  readonly textAuthoritative: true;
  readonly liveVoice: false;
  readonly audioProcessed: false;
  readonly rawTranscript: string;
  readonly cleanedTranscript: string;
  readonly segments: readonly string[];
  readonly intents: readonly { readonly text: string; readonly intentKind: IntentKind }[];
  readonly mainIntentKind: IntentKind;
  readonly oralContext: string;
  /** Fallback canonique T1 (VoiceTech) — la couche T2 consomme la couche T1 par contrat. */
  readonly t1VoiceFallback: VoiceFallbackArtifact | null;
}

const ORAL_FILLERS = /\b(euh+|heu+|hum+|bah|ben|hein|voilà voilà|du coup|en fait|genre|tu vois|comment dire)\b/gi;

/** Nettoie un transcript parlé (tics de langage, espaces). Pur. */
export function cleanOralTranscript(text: string): string {
  return text.replace(ORAL_FILLERS, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

export const cloneVoiceProductTech: ProductTechnologyContract<CloneVoiceInput, CloneVoiceIntentArtifact> =
  defineProductTechnologyContract({
    id: "clonevoice",
    name: "CloneVoice",
    definition: "La couche d'entrée vocale naturelle de CloneStore — architecture prête, voix live NON opérationnelle (aucun provider vérifié).",
    role: "Permettre au client de parler naturellement au système : nettoyage du parlé, intention principale, segmentation multi-actions, contexte oral minimal — sur transcript texte.",
    answersQuestion: "Comment le client peut-il parler naturellement au système ?",
    contains: ["architecture de capture audio (contrat)", "contrat de transcription", "nettoyage du langage parlé", "détection d'intention principale", "segmentation multi-actions", "contexte oral minimal"],
    doesNotContain: ["orchestration (CloneOS)", "décision de risque (CloneGuard)", "mémoire d'entreprise (CloneADN)", "qualité métier (CloneReview)", "timeline complète (CloneTrace)"],
    dependencies: [],
    status: "architecture_ready",
    mode: "live_disabled",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonevoice,
    liveBlockedReason: "Aucun provider vocal vérifié — voix live bloquée ; le chemin texte reste autoritaire (le chemin voix s'ouvrira seulement après vérification externe d'un provider).",
    requiresValidation: true,
    commercialClaimAllowed: "Architecture vocale prête : le client dicte/fournit un transcript texte, le système le structure en intentions et actions — sous validation humaine.",
    commercialClaimForbidden: ["voix live opérationnelle", "téléphonie live", "reconnaissance vocale en production", "enregistrement audio réel"],
    prepareArtifact: async (input, ctx) => {
      const transcript = (input?.transcriptText ?? "").trim();
      // Consommation T1 réelle : le fallback canonique « le texte reste autoritaire ».
      const t1 = await voiceTech.prepare({ audioRef: input?.audioRef ?? "" }, ctx);
      const t1Fallback = (t1.artifact as VoiceFallbackArtifact | null) ?? null;

      // Audio sans transcript : AUCUN provider — dégradation sûre, l'humain fournit le texte.
      if (transcript.length === 0) {
        return {
          kind: "fallback",
          artifact: {
            artifactKind: "clonevoice_intent",
            source: "text_fallback",
            textAuthoritative: true,
            liveVoice: false,
            audioProcessed: false,
            rawTranscript: "",
            cleanedTranscript: "",
            segments: [],
            intents: [],
            mainIntentKind: "generic_mission",
            oralContext: "Aucun transcript fourni — aucun provider vocal ne peut transcrire l'audio en T2 ; fournir le texte.",
            t1VoiceFallback: t1Fallback,
          },
          fallbackNote: PRODUCT_TECHNOLOGY_FALLBACKS.clonevoice,
        };
      }

      const cleaned = cleanOralTranscript(transcript);
      const segments = segmentIntoActions(cleaned);
      const parts = segments.length > 0 ? segments : [cleaned];
      const intents = parts.map((text) => ({ text, intentKind: classifyIntentKind(text) }));
      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "clonevoice_intent",
          source: "text_fallback",
          textAuthoritative: true,
          liveVoice: false,
          audioProcessed: false,
          rawTranscript: transcript,
          cleanedTranscript: cleaned,
          segments: parts,
          intents,
          mainIntentKind: classifyIntentKind(cleaned),
          oralContext: `Transcript ${transcript.length} caractères, ${parts.length} action(s) détectée(s) — l'humain confirme l'interprétation.`,
          t1VoiceFallback: t1Fallback,
        },
      };
    },
  });
