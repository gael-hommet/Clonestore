// src/lib/clonestore/product-technologies/t2/product-technology-orchestrator.ts
// T2 — ORCHESTRATEUR inter-technologies : les pipelines produit canoniques.
// Demande brute : ADN → CloneOS → Policy → Trust → Guard → Review → Trace → Continuum →
// Signals (→ Brief). Appel : CloneCall (compose Voice/OS/Guard/Trace/Continuum/Signals/Brief).
// Salle : CloneRoom (compose OS/Guard/Trace) → Brief. AUCUN effet live possible : chaque
// étape est un contrat local ; chaque étape est AUDITÉE ; la gouvernance n'est jamais sautée.

import { isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";
import type { ProductTechnologyContext, ProductTechnologyId } from "./product-technology-types";
import type { ProductTechnologyContract, ProductTechnologyAuditEntry } from "./product-technology-contract";
import { createProductTechnologyAuditLog } from "./product-technology-contract";
import type { ProductTechnologyResult } from "./product-technology-result";
import { ALL_PRODUCT_TECHNOLOGY_CONTRACTS, listProductTechnologyRegistryEntries } from "./product-technology-registry";
import { getProductTechnologyFallbackText } from "./product-technology-fallbacks";
import { cloneOSProductTech, type CloneOSMissionPlan, type CloneOSRequestInput } from "./cloneos-product-tech";
import { cloneADNProductTech, type CloneADNProfileArtifact, type CloneADNInput } from "./cloneadn-product-tech";
import { cloneGuardProductTech, type CloneGuardDecision } from "./cloneguard-product-tech";
import { clonePolicyProductTech, type ClonePolicyDecision, type ClonePolicyRule } from "./clonepolicy-product-tech";
import { cloneTrustProductTech, type CloneTrustDecision } from "./clonetrust-product-tech";
import { cloneReviewProductTech, type CloneReviewReport } from "./clonereview-product-tech";
import { cloneTraceProductTech, type CloneTraceEvent } from "./clonetrace-product-tech";
import { cloneContinuumProductTech, type CloneContinuumState } from "./clonecontinuum-product-tech";
import { cloneSignalsProductTech, type CloneSignalsArtifact } from "./clonesignals-product-tech";
import { cloneBriefProductTech, type CloneBriefArtifact, type CloneBriefInput } from "./clonebrief-product-tech";
import { cloneCallProductTech, type CloneCallInput, type CloneCallSessionArtifact } from "./clonecall-product-tech";
import { cloneRoomProductTech, type CloneRoomInput, type CloneRoomCoordinationArtifact } from "./cloneroom-product-tech";
import { evaluateProductTechnologyCommandCenter, type ProductTechnologyCommandCenterReport } from "./product-technology-command-center";

export interface CloneOSRunResult {
  readonly kind: "governed_mission_proposal";
  readonly adnProfile: CloneADNProfileArtifact | null;
  readonly missionPlan: CloneOSMissionPlan | null;
  readonly policyDecision: ClonePolicyDecision | null;
  readonly trustDecision: CloneTrustDecision | null;
  readonly guardDecision: CloneGuardDecision | null;
  readonly review: CloneReviewReport | null;
  readonly traceEvent: CloneTraceEvent | null;
  readonly continuumState: CloneContinuumState | null;
  readonly signalCandidates: CloneSignalsArtifact | null;
  readonly gated: boolean;             // true si Guard a exigé validation/bloqué/refusé
  readonly blockedByGovernance: boolean;
  readonly executedLive: false;
  readonly humanValidationRequired: true;
  readonly auditEntries: readonly ProductTechnologyAuditEntry[];
}

export interface CloneCallRunResult {
  readonly session: CloneCallSessionArtifact | null;
  readonly result: ProductTechnologyResult;
  readonly executedLive: false;
  readonly auditEntries: readonly ProductTechnologyAuditEntry[];
}

export interface CloneRoomRunResult {
  readonly coordination: CloneRoomCoordinationArtifact | null;
  readonly roomBrief: CloneBriefArtifact | null;
  readonly result: ProductTechnologyResult;
  readonly executedLive: false;
  readonly auditEntries: readonly ProductTechnologyAuditEntry[];
}

export interface ProductTechnologyOrchestrator {
  runCloneOSRequest(input: CloneOSRequestInput & { adn?: CloneADNInput; policyRules?: readonly ClonePolicyRule[] }, ctx: ProductTechnologyContext): Promise<CloneOSRunResult>;
  runCloneCallSession(input: CloneCallInput, ctx: ProductTechnologyContext): Promise<CloneCallRunResult>;
  runCloneRoomThread(input: CloneRoomInput, ctx: ProductTechnologyContext): Promise<CloneRoomRunResult>;
  generateCloneBrief(input: CloneBriefInput, ctx: ProductTechnologyContext): Promise<ProductTechnologyResult<CloneBriefArtifact>>;
  evaluateProductTechnologyReadiness(): Promise<ProductTechnologyCommandCenterReport>;
  listProductTechnologies(): readonly { id: ProductTechnologyId; name: string; status: string; mode: string; safeFallback: string }[];
  getProductTechnology(id: string): ProductTechnologyContract | undefined;
  /** Journal global de l'instance — filtré par société si `companyId` est fourni. */
  listAuditEntries(companyId?: string): readonly ProductTechnologyAuditEntry[];
}

// Canal « aval » d'un plan selon l'intention (fail-closed : un email finira à l'externe →
// les règles de canal externes s'appliquent dès la proposition).
const CHANNEL_BY_INTENT: Readonly<Record<string, string>> = { draft_email: "external_email" };

export function createProductTechnologyOrchestrator(): ProductTechnologyOrchestrator {
  const auditLog = createProductTechnologyAuditLog();

  /**
   * Exécute une étape contractuelle et l'AUDITE systématiquement (même bloquée/en erreur),
   * dans le journal PROPRE AU RUN (isolation tenant + concurrence) ET le journal global.
   */
  async function step<In, Out>(
    contract: ProductTechnologyContract<In, Out>,
    input: In,
    ctx: ProductTechnologyContext,
    runLog: ReturnType<typeof createProductTechnologyAuditLog>,
  ): Promise<ProductTechnologyResult<Out>> {
    const result = await contract.prepare(input, ctx);
    const entry = contract.audit(result, ctx);
    runLog.record(entry);
    auditLog.record(entry);
    return result;
  }

  const orchestrator: ProductTechnologyOrchestrator = {
    // ── Pipeline canonique : demande brute → proposition de mission gouvernée ──
    async runCloneOSRequest(input, ctx) {
      const runLog = createProductTechnologyAuditLog(); // journal PROPRE AU RUN (tenant + concurrence)

      // 1) CloneADN : contexte de style d'entreprise.
      const adn = await step(cloneADNProductTech, input.adn ?? {}, ctx, runLog);
      // 2) CloneOS : plan de mission.
      const os = await step(cloneOSProductTech, { request: input.request, availableEmployees: input.availableEmployees, context: input.context }, ctx, runLog);
      const plan = os.artifact;
      const intentKind = plan?.intention.intentKind ?? "generic_mission";
      const downstreamChannel = CHANNEL_BY_INTENT[intentKind] ?? "internal";
      // 3) ClonePolicy : règles d'entreprise (canal dérivé de l'intention, pas une constante).
      const policy = await step(clonePolicyProductTech, {
        rules: input.policyRules,
        action: { taskType: intentKind, channel: downstreamChannel, requesterRole: ctx.requesterRole },
      }, ctx, runLog);
      // 4) CloneGuard : classification + porte (AVANT tout usage du plan).
      const guard = await step(cloneGuardProductTech, {
        action: { kind: "mission_proposal", description: input.request ?? "", channel: downstreamChannel },
      }, ctx, runLog);
      // 5) CloneTrust : autonomie effective (plafonnée par la politique, jamais au-dessus de Guard).
      const trust = await step(cloneTrustProductTech, {
        taskType: intentKind,
        riskLevel: guard.artifact?.riskLevel ?? "sensitive",
        requesterRole: ctx.requesterRole,
        policyCap: policy.artifact?.autonomyCap,
      }, ctx, runLog);

      const guardDecision = guard.artifact?.decision ?? "require_validation";
      const policyDecision = policy.artifact?.decision ?? "require_validation";
      // FAIL-CLOSED : une étape de gouvernance en échec (artefact null) FERME la porte —
      // elle ne disparaît jamais silencieusement.
      const blockedByGovernance =
        guardDecision === "block" || guardDecision === "refuse" ||
        policyDecision === "block" || policy.artifact === null || guard.artifact === null;

      // 6) CloneReview : relecture de l'objectif proposé (si non bloqué).
      const review = blockedByGovernance || !plan
        ? null
        : await step(cloneReviewProductTech, { draft: plan.missionCandidate.objective, sensitive: plan.sensitiveHrLanguageDetected }, ctx, runLog);
      // 7) CloneTrace : tout est tracé, y compris les blocages.
      const trace = await step(cloneTraceProductTech, {
        subject: plan ? `mission-${plan.missionCandidate.title.slice(0, 40)}` : "demande-bloquée",
        action: blockedByGovernance ? "Proposition bloquée par la gouvernance" : "Proposition de mission gouvernée créée",
        reason: guard.artifact?.explanation,
      }, ctx, runLog);
      // 8) CloneContinuum : prochain état.
      const continuum = await step(cloneContinuumProductTech, {
        missionId: trace.artifact?.eventId ?? "mission-inconnue",
        currentState: "active",
        event: blockedByGovernance ? undefined : "validation_requested",
      }, ctx, runLog);
      // 9) CloneSignals : candidats de relance.
      const signals = await step(cloneSignalsProductTech, {
        missionId: trace.artifact?.eventId,
        waitingValidationSinceHours: blockedByGovernance ? undefined : 48,
      }, ctx, runLog);

      return {
        kind: "governed_mission_proposal",
        adnProfile: adn.artifact,
        // Un run bloqué par la gouvernance NE LIVRE PAS le plan (la trace en garde la mémoire) —
        // l'usage du plan exige un run non bloqué, pas l'ignorance d'un drapeau.
        missionPlan: blockedByGovernance ? null : plan,
        policyDecision: policy.artifact,
        trustDecision: trust.artifact,
        guardDecision: guard.artifact,
        review: review?.artifact ?? null,
        traceEvent: trace.artifact,
        continuumState: continuum.artifact,
        signalCandidates: signals.artifact,
        // gated reflète TOUTES les portes (Guard ET Policy), pas seulement Guard.
        gated: guardDecision !== "allow_prepare" || policyDecision !== "allow_prepare",
        blockedByGovernance,
        executedLive: false,
        humanValidationRequired: true,
        auditEntries: runLog.list(),
      };
    },

    // ── Pipeline appel : CloneCall compose Voice/OS/Guard/Policy/Trust/Trace/Continuum/Signals/Brief ──
    async runCloneCallSession(input, ctx) {
      const runLog = createProductTechnologyAuditLog();
      const result = await step(cloneCallProductTech, input, ctx, runLog);
      return {
        session: result.artifact,
        result: result as ProductTechnologyResult,
        executedLive: false,
        auditEntries: runLog.list(), // UNIQUEMENT ce run — jamais le journal partagé (isolation tenant)
      };
    },

    // ── Pipeline salle : CloneRoom (OS/Guard/Policy/Trust/Trace) puis Brief de salle ──
    async runCloneRoomThread(input, ctx) {
      const runLog = createProductTechnologyAuditLog();
      const result = await step(cloneRoomProductTech, input, ctx, runLog);
      const coordination = result.artifact;
      const brief = coordination
        ? await step(cloneBriefProductTech, {
            when: "evening",
            missions: coordination.missionCandidates.map((m) => ({ title: m.missionCandidate.title, state: "prepared" as const })),
            decisionsNeeded: coordination.missionCandidates.length > 0
              ? [{ title: "Valider les missions proposées par la salle", state: "waiting" as const }]
              : [],
          }, ctx, runLog)
        : null;
      return {
        coordination,
        roomBrief: brief?.artifact ?? null,
        result: result as ProductTechnologyResult,
        executedLive: false,
        auditEntries: runLog.list(), // UNIQUEMENT ce run — isolation tenant
      };
    },

    async generateCloneBrief(input, ctx) {
      return step(cloneBriefProductTech, input, ctx, createProductTechnologyAuditLog());
    },

    async evaluateProductTechnologyReadiness() {
      return evaluateProductTechnologyCommandCenter();
    },

    listProductTechnologies() {
      return listProductTechnologyRegistryEntries().map((e) => ({
        id: e.id, name: e.contract.name, status: e.status, mode: e.contract.mode, safeFallback: e.safeFallback,
      }));
    },

    getProductTechnology(id) {
      return (ALL_PRODUCT_TECHNOLOGY_CONTRACTS as Record<string, ProductTechnologyContract>)[id];
    },

    // Journal global : FILTRÉ par société quand un périmètre est fourni (jamais de fuite
    // inter-tenants par défaut d'argument sur une instance partagée).
    listAuditEntries(companyId) {
      const all = auditLog.list();
      return companyId === undefined ? all : all.filter((e) => e.companyId === companyId);
    },
  };

  // Invariant de construction : l'exécution live est impossible (dérivé du plancher P10 réel).
  if (isLiveExecutionAllowed()) {
    throw new Error("Invariant T2 violé : l'exécution live ne peut pas être permise (production OFF).");
  }
  return orchestrator;
}

// ── Exports de commodité (orchestrateur partagé — mêmes garanties) ─────────────

let sharedOrchestrator: ProductTechnologyOrchestrator | null = null;
function shared(): ProductTechnologyOrchestrator {
  if (sharedOrchestrator === null) sharedOrchestrator = createProductTechnologyOrchestrator();
  return sharedOrchestrator;
}

export function runCloneOSRequest(
  input: CloneOSRequestInput & { adn?: CloneADNInput; policyRules?: readonly ClonePolicyRule[] },
  ctx: ProductTechnologyContext,
): Promise<CloneOSRunResult> { return shared().runCloneOSRequest(input, ctx); }

export function runCloneCallSession(input: CloneCallInput, ctx: ProductTechnologyContext): Promise<CloneCallRunResult> {
  return shared().runCloneCallSession(input, ctx);
}

export function runCloneRoomThread(input: CloneRoomInput, ctx: ProductTechnologyContext): Promise<CloneRoomRunResult> {
  return shared().runCloneRoomThread(input, ctx);
}

export function generateCloneBrief(input: CloneBriefInput, ctx: ProductTechnologyContext): Promise<ProductTechnologyResult<CloneBriefArtifact>> {
  return shared().generateCloneBrief(input, ctx);
}

export function evaluateProductTechnologyReadiness(): Promise<ProductTechnologyCommandCenterReport> {
  return shared().evaluateProductTechnologyReadiness();
}

export function listProductTechnologies(): readonly { id: ProductTechnologyId; name: string; status: string; mode: string; safeFallback: string }[] {
  return shared().listProductTechnologies();
}

export function getProductTechnology(id: string): ProductTechnologyContract | undefined {
  return shared().getProductTechnology(id);
}

export { getProductTechnologyFallbackText };
