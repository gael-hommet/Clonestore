// src/lib/clonestore/product-technologies/t2/clonecall-product-tech.ts
// T2 — CloneCall : « appeler son employé IA ». SAFE LOCAL UNIQUEMENT :
// AUCUNE téléphonie live, AUCUN provider audio, AUCUN appel sortant réel, AUCUN enregistrement.
// La session d'appel est locale, sur transcript TEXTE (via CloneVoice — jamais contourné) ;
// elle produit : préparation + script + sections + intentions + actions + candidat de mission
// CloneOS + décision CloneGuard + événement CloneTrace + état CloneContinuum + candidats
// CloneSignals + brief CloneBrief. Le chemin sortant/live est marqué live_blocked.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import { cloneVoiceProductTech, type CloneVoiceIntentArtifact } from "./clonevoice-product-tech";
import { cloneOSProductTech, type CloneOSMissionPlan, type CloneOSEmployeeDescriptor } from "./cloneos-product-tech";
import { cloneGuardProductTech, type CloneGuardDecision } from "./cloneguard-product-tech";
import { clonePolicyProductTech, type ClonePolicyDecision, type ClonePolicyRule } from "./clonepolicy-product-tech";
import { cloneTrustProductTech, type CloneTrustDecision } from "./clonetrust-product-tech";
import { cloneTraceProductTech, type CloneTraceEvent } from "./clonetrace-product-tech";
import { cloneContinuumProductTech, type CloneContinuumState } from "./clonecontinuum-product-tech";
import { cloneSignalsProductTech, type CloneSignalsArtifact } from "./clonesignals-product-tech";
import { cloneBriefProductTech, type CloneBriefArtifact } from "./clonebrief-product-tech";
import type { IntentKind } from "./product-technology-types";

export interface CloneCallInput {
  readonly employeeCalledId?: string;
  readonly objective?: string;
  /** Transcript TEXTE de l'appel (fallback autoritaire — aucun audio traité en T2). */
  readonly transcriptText?: string;
  readonly availableEmployees?: readonly CloneOSEmployeeDescriptor[];
  /** Règles d'entreprise (ClonePolicy) appliquées à la suite d'appel. */
  readonly policyRules?: readonly ClonePolicyRule[];
  /** Tout appel sortant/live est refusé en T2. */
  readonly outbound?: boolean;
  readonly dialNumber?: string;
}

export interface CloneCallSessionArtifact {
  readonly artifactKind: "clonecall_session";
  readonly sessionId: string;
  readonly employeeCalledId: string;
  readonly objective: string;
  readonly preparation: { readonly points: readonly string[] };
  readonly script: { readonly opening: string; readonly questions: readonly string[]; readonly closing: string };
  readonly transcript: { readonly source: "text_fallback"; readonly sections: readonly { readonly title: string; readonly content: string }[] };
  readonly voice: CloneVoiceIntentArtifact | null;
  readonly extractedIntents: readonly { readonly text: string; readonly intentKind: IntentKind }[];
  readonly extractedActions: readonly string[];
  readonly missionCandidate: CloneOSMissionPlan | null;
  readonly guardDecision: CloneGuardDecision | null;
  readonly policyDecision: ClonePolicyDecision | null;
  readonly trustDecision: CloneTrustDecision | null;
  readonly traceEvent: CloneTraceEvent | null;
  readonly continuumState: CloneContinuumState | null;
  readonly signalCandidates: CloneSignalsArtifact | null;
  readonly callBrief: CloneBriefArtifact | null;
  /** Invariants durs : rien de live, jamais. */
  readonly outboundLivePathBlocked: true;
  readonly liveCallMade: false;
  readonly audioRecorded: false;
  readonly telephonyProvider: "none";
}

let callSequence = 0;

// Coercition fail-closed : pour un drapeau booléen d'appel sortant, AUCUNE valeur string
// légitime n'existe → toute string non vide (y compris "oui"/"vrai"), nombre ≠ 0 ou true bloque.
const truthyish = (v: unknown): boolean =>
  v === true || (typeof v === "number" && v !== 0) ||
  (typeof v === "string" && v.trim().length > 0);
// Toute valeur SIGNIFICATIVE (string non vide, nombre, tableau, objet) sur une clé de
// numérotation est une intention de téléphonie live — fail-closed.
const hasDialTarget = (v: unknown): boolean =>
  v !== undefined && v !== null && v !== false && !(typeof v === "string" && v.trim().length === 0);

export const cloneCallProductTech: ProductTechnologyContract<CloneCallInput, CloneCallSessionArtifact> =
  defineProductTechnologyContract({
    id: "clonecall",
    name: "CloneCall",
    definition: "L'expérience d'appel de son employé IA : transformer un appel en travail structuré — en SAFE LOCAL (aucune téléphonie live, aucun audio réel, aucun appel sortant).",
    role: "Créer une session d'appel locale (objectif, préparation, script, transcript texte), en extraire intentions/actions, et enchaîner mission CloneOS + porte CloneGuard + trace + continuité + relances + brief.",
    answersQuestion: "Comment un appel à son employé IA devient-il du vrai travail structuré ?",
    contains: [
      "session d'appel avec un employé IA", "objectif d'appel", "préparation d'appel", "script d'appel",
      "transcript texte (fallback live-call)", "résumé structuré", "extraction d'actions",
      "candidat de mission CloneOS", "événement CloneTrace", "décision CloneGuard",
      "continuité CloneContinuum", "réveils CloneSignals", "brief CloneBrief",
    ],
    doesNotContain: ["appels téléphoniques réels", "enregistrement audio réel", "provider de téléphonie live", "appels sortants live", "contournement de CloneVoice/CloneGuard/CloneTrace"],
    dependencies: ["clonevoice", "cloneos", "cloneguard", "clonetrace", "clonecontinuum", "clonesignals", "clonebrief", "cloneadn"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonecall,
    liveBlockedReason: "Téléphonie live et appels sortants BLOQUÉS — aucun provider télécom/audio vérifié, cadre légal non validé ; le chemin sortant live ne s'ouvrira qu'après vérification externe.",
    requiresValidation: true,
    commercialClaimAllowed: "Appelez votre employé IA en session locale : l'appel (transcript texte) devient préparation, mission proposée, suivi et brief — sous validation humaine.",
    commercialClaimForbidden: ["téléphonie live", "appels sortants réels", "voix live opérationnelle", "l'employé IA vous appelle au téléphone"],
    prepareArtifact: async (input, ctx) => {
      // Chemin sortant/live : REFUSÉ (en plus de la garde générique anti-live).
      // Coercition fail-closed : outbound:"true"/1, dialNumber/phoneNumber string OU number, callNow…
      const record = (input ?? {}) as Record<string, unknown>;
      if (
        truthyish(record.outbound) || truthyish(record.callNow) || truthyish(record.dialOut) ||
        hasDialTarget(record.dialNumber) || hasDialTarget(record.phoneNumber) || hasDialTarget(record.telephone)
      ) {
        return {
          kind: "blocked",
          artifact: null,
          blockedReason: "Appel sortant/téléphonie live demandé — live_blocked en T2 (aucun provider télécom vérifié, cadre légal non validé).",
        };
      }
      const employeeCalledId = (input?.employeeCalledId ?? "").trim();
      if (employeeCalledId.length === 0) {
        return { kind: "blocked", artifact: null, blockedReason: "employeeCalledId requis — un appel vise un employé IA précis (fail-closed)." };
      }
      callSequence += 1;
      const sessionId = `call-${callSequence}`;
      const objective = (input?.objective ?? "objectif non précisé").trim();
      const transcript = (input?.transcriptText ?? "").trim();

      // 1) CloneVoice traite le transcript texte (JAMAIS contourné ; aucun audio).
      const voiceResult = await cloneVoiceProductTech.prepare({ transcriptText: transcript }, ctx);
      const voice = (voiceResult.artifact as CloneVoiceIntentArtifact | null) ?? null;
      const intents = voice?.intents ?? [];
      const extractedActions = intents.map((i) => `Action proposée (${i.intentKind}) : ${i.text}`);

      // 2) CloneOS : candidat de mission à partir de l'appel (objectif + intentions).
      const requestText = [objective !== "objectif non précisé" ? objective : "", voice?.cleanedTranscript ?? ""].filter(Boolean).join(". ");
      const osResult = requestText.length > 0
        ? await cloneOSProductTech.prepare({ request: requestText, availableEmployees: input?.availableEmployees, context: `Appel ${sessionId} avec ${employeeCalledId}` }, ctx)
        : null;
      const missionCandidate = (osResult?.artifact as CloneOSMissionPlan | null) ?? null;

      // 3) CloneGuard : porte de gouvernance sur la suite d'appel.
      const guardResult = await cloneGuardProductTech.prepare(
        { action: { kind: "call_followup_preparation", description: `${objective}. ${voice?.cleanedTranscript ?? ""}`, channel: "internal" } },
        ctx,
      );
      const guardDecision = (guardResult.artifact as CloneGuardDecision | null) ?? null;

      // 3bis) ClonePolicy : les règles d'entreprise s'appliquent aussi aux suites d'appel.
      const policyResult = await clonePolicyProductTech.prepare(
        {
          rules: input?.policyRules,
          action: { taskType: missionCandidate?.intention.intentKind ?? "generic_mission", channel: "internal", requesterRole: ctx.requesterRole },
        },
        ctx,
      );
      const policyDecision = (policyResult.artifact as ClonePolicyDecision | null) ?? null;

      // 3ter) CloneTrust : autonomie effective (risque Guard + plafond Policy) — jamais contournée.
      const trustResult = await cloneTrustProductTech.prepare(
        {
          taskType: missionCandidate?.intention.intentKind ?? "generic_mission",
          riskLevel: guardDecision?.riskLevel ?? "sensitive",
          requesterRole: ctx.requesterRole,
          policyCap: policyDecision?.autonomyCap,
        },
        ctx,
      );
      const trustDecision = (trustResult.artifact as CloneTrustDecision | null) ?? null;

      // 4) CloneTrace : l'appel est tracé.
      const traceResult = await cloneTraceProductTech.prepare(
        { subject: sessionId, action: `Session d'appel locale avec ${employeeCalledId}`, missionId: sessionId, reason: objective },
        ctx,
      );
      const traceEvent = (traceResult.artifact as CloneTraceEvent | null) ?? null;

      // 5) CloneContinuum : la suite d'appel attend la validation humaine.
      const continuumResult = await cloneContinuumProductTech.prepare(
        { missionId: sessionId, currentState: "active", event: "validation_requested" },
        ctx,
      );
      const continuumState = (continuumResult.artifact as CloneContinuumState | null) ?? null;

      // 6) CloneSignals : candidats de relance post-appel (armement humain).
      const signalsResult = await cloneSignalsProductTech.prepare(
        { missionId: sessionId, businessConditions: [{ condition: "relance post-appel à planifier", met: true }] },
        ctx,
      );
      const signalCandidates = (signalsResult.artifact as CloneSignalsArtifact | null) ?? null;

      // 7) CloneBrief : brief d'après-appel (faits fournis uniquement).
      const briefResult = await cloneBriefProductTech.prepare(
        {
          when: "evening",
          missions: [{ title: `Appel ${sessionId} — ${objective}`, state: "prepared" }],
          waitingValidations: missionCandidate ? [{ title: "Mission issue de l'appel à valider", state: "waiting" }] : [],
          decisionsNeeded: [{ title: "Valider (ou non) les actions extraites de l'appel", state: "waiting" }],
        },
        ctx,
      );
      const callBrief = (briefResult.artifact as CloneBriefArtifact | null) ?? null;

      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "clonecall_session",
          sessionId,
          employeeCalledId,
          objective,
          preparation: {
            points: [
              `Objectif : ${objective}`,
              "Rappeler le contexte de l'entreprise (profil CloneADN).",
              "Confirmer les actions extraites avant toute exécution.",
            ],
          },
          script: {
            opening: `Bonjour, ici votre employé IA « ${employeeCalledId} ». De quoi avez-vous besoin ?`,
            questions: ["Quel est l'objectif prioritaire ?", "Quelle échéance ?", "Qui doit valider ?"],
            closing: "Je prépare tout cela et vous le soumets pour validation — rien ne part sans vous.",
          },
          transcript: {
            source: "text_fallback",
            sections: transcript.length > 0
              ? [{ title: "Transcript fourni (texte)", content: transcript }]
              : [{ title: "Transcript absent", content: "Aucun transcript fourni — fournir le texte (aucun provider vocal en T2)." }],
          },
          voice,
          extractedIntents: intents,
          extractedActions,
          missionCandidate,
          guardDecision,
          policyDecision,
          trustDecision,
          traceEvent,
          continuumState,
          signalCandidates,
          callBrief,
          outboundLivePathBlocked: true,
          liveCallMade: false,
          audioRecorded: false,
          telephonyProvider: "none",
        },
      };
    },
  });
