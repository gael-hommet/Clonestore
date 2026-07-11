// src/lib/clonestore/product-technologies/t2/clonetrace-product-tech.ts
// T2 — CloneTrace : traçabilité, timeline, historique, reprise, audit.
// Garde : missions, tâches, validations, blocages, relances, documents, emails, événements,
// changements d'état, versions, raisons des décisions. N'orchestre pas, ne décide pas le
// risque, ne génère pas de contenu. CONSOMME RÉELLEMENT T1 EvidenceTech (preuve de couche).

import { evidenceTech, type EvidenceEntryArtifact } from "@/lib/clonestore/technologies/t1";
import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";

export interface CloneTraceInput {
  readonly subject?: string;      // ex. "mission-42"
  readonly action?: string;       // ex. "plan de mission proposé"
  readonly missionId?: string;
  readonly taskId?: string;
  readonly artifactIds?: readonly string[];
  readonly validationIds?: readonly string[];
  readonly reason?: string;       // raison de la décision/du changement d'état
  readonly previousEventId?: string;
}

export interface CloneTraceEvent {
  readonly artifactKind: "clonetrace_event";
  readonly eventId: string;
  readonly at: string;
  readonly subject: string;
  readonly action: string;
  readonly reason: string | null;
  readonly links: {
    readonly missionId: string | null;
    readonly taskId: string | null;
    readonly artifactIds: readonly string[];
    readonly validationIds: readonly string[];
  };
  readonly resumePointer: { readonly missionId: string | null; readonly lastEventId: string };
  /** Entrée d'audit T1 réelle (EvidenceTech) — la couche T2 consomme la couche T1 par contrat. */
  readonly t1Evidence: EvidenceEntryArtifact | null;
  readonly orchestrates: false;
  readonly decidesRisk: false;
}

let traceSequence = 0;

export const cloneTraceProductTech: ProductTechnologyContract<CloneTraceInput, CloneTraceEvent> =
  defineProductTechnologyContract({
    id: "clonetrace",
    name: "CloneTrace",
    definition: "La couche de traçabilité, timeline, historique, reprise et audit de CloneStore.",
    role: "Retenir ce qui s'est passé, dans quel ordre, pourquoi — et permettre une reprise propre.",
    answersQuestion: "Que s'est-il passé, dans quel ordre, pourquoi, et comment reprendre proprement ?",
    contains: ["missions", "tâches", "validations", "blocages", "relances", "documents", "emails", "événements", "changements d'état", "versions", "raisons des décisions", "pointeur de reprise"],
    doesNotContain: ["orchestration (CloneOS)", "décision de risque (CloneGuard)", "génération de contenu"],
    dependencies: [],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonetrace,
    liveBlockedReason: null,
    requiresValidation: false, // tracer n'est pas un effet — l'audit doit toujours être possible
    commercialClaimAllowed: "Chaque action est tracée (timeline, raisons, reprise) — auditable à tout moment.",
    commercialClaimForbidden: ["archivage légal certifié", "preuve juridique opposable garantie"],
    prepareArtifact: async (input, ctx) => {
      traceSequence += 1;
      const eventId = `trace-${traceSequence}`;
      // Consommation T1 réelle : EvidenceTech prépare l'entrée d'audit bas-niveau.
      const t1 = await evidenceTech.prepare(
        { subject: input?.subject ?? "sujet non précisé", action: input?.action ?? "événement" },
        ctx,
      );
      return {
        kind: "ok",
        artifact: {
          artifactKind: "clonetrace_event",
          eventId,
          at: new Date().toISOString(),
          subject: (input?.subject ?? "sujet non précisé").trim(),
          action: (input?.action ?? "événement").trim(),
          reason: input?.reason?.trim() || null,
          links: {
            missionId: input?.missionId ?? null,
            taskId: input?.taskId ?? null,
            artifactIds: input?.artifactIds ?? [],
            validationIds: input?.validationIds ?? [],
          },
          resumePointer: { missionId: input?.missionId ?? null, lastEventId: input?.previousEventId ?? eventId },
          t1Evidence: (t1.artifact as EvidenceEntryArtifact | null) ?? null,
          orchestrates: false,
          decidesRisk: false,
        },
      };
    },
  });
