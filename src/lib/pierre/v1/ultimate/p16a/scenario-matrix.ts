// src/lib/pierre/v1/ultimate/p16a/scenario-matrix.ts
// P16A — behavioral scenario matrix (owner §18). Runs the 20 required scenarios through the REAL
// deterministic P16C contract (no OpenAI) with injected tenant-scoped entities/continuity candidates.
// Each record captures the governed truth: understood intent, capabilities, clarification, mission/tasks,
// validation, human-only floor, provider/live blocker, output disposition, explanation, next safe step.

import { analyzeForP16C } from "./integration-contract";
import type { PierreUltimateIntegrationContract } from "./types";
import type { ResolvedReference } from "../../cognitive-runtime/types";

const NOW = "2026-07-13";
const emp = (id: string, label: string, status: ResolvedReference["status"] = "resolved"): ResolvedReference =>
  ({ kind: "employee", status, id: status === "resolved" ? id : null, label, candidates: [], reason: status });
const ambiguousEmp = (label: string, cands: { id: string; label: string; distinguisher: string }[]): ResolvedReference =>
  ({ kind: "employee", status: "ambiguous", id: null, label, candidates: cands, reason: "homonym" });
const forbiddenEmp = (label: string): ResolvedReference =>
  ({ kind: "employee", status: "forbidden", id: null, label, candidates: [], reason: "cross_tenant_forbidden" });

export type ScenarioRecord = {
  readonly n: number;
  readonly instruction: string;
  readonly understoodIntent: string;
  readonly multiIntent: boolean;
  readonly capabilities: readonly string[];
  readonly clarifications: readonly string[];
  readonly clarificationBlocks: boolean;
  readonly missionTasks: number;
  readonly missionSource: string;
  readonly requiredValidations: readonly string[];
  readonly humanOnly: readonly string[];
  readonly providerBlockers: readonly string[];
  readonly legalBlockers: readonly string[];
  readonly blockedCodes: readonly string[];
  readonly disposition: string;
  readonly explanation: string;
  readonly continuityTarget: string | null;
  readonly authoritativeStatus: string;
  readonly nextSafeStep: string;
  readonly canonicalItems: readonly string[];
};

function record(n: number, c: PierreUltimateIntegrationContract): ScenarioRecord {
  return {
    n,
    instruction: c.instruction,
    understoodIntent: c.understanding.requestKind,
    multiIntent: c.understanding.multiIntent,
    capabilities: c.selectedCapabilityIds,
    clarifications: c.clarification.questions.map((q) => q.question),
    clarificationBlocks: c.clarification.blocksExecution,
    missionTasks: c.missionProposal.tasks.length,
    missionSource: c.missionProposal.source,
    requiredValidations: c.autonomy.requiredValidations,
    humanOnly: c.autonomy.humanOnlyDecisions.map((d) => d.category),
    providerBlockers: c.providerDependencies,
    legalBlockers: c.legalDependencies,
    blockedCodes: c.blockedReasons.map((b) => b.code),
    disposition: c.autonomy.overallDisposition,
    explanation: c.statusExplanation,
    continuityTarget: c.continuity.targetId,
    authoritativeStatus: c.continuity.requiresAuthoritativeRead ? "must_re-read_durable_state" : "n/a",
    nextSafeStep: c.nextSafeStep,
    canonicalItems: c.canonicalItemsInvolved,
  };
}

/** Run the 20 canonical behavioral scenarios. Deterministic (no OpenAI). */
export async function runScenarioMatrix(): Promise<ScenarioRecord[]> {
  const base = { companyId: "co-1", actorId: "user-1", nowIso: NOW };
  const c = (n: number, instruction: string, opts = {}) => analyzeForP16C({ requestId: `s${n}`, ...base, instruction }, opts).then((r) => record(n, r));

  return Promise.all([
    c(1, "Prépare l'onboarding de Sarah lundi.", { subjects: { employees: [emp("emp-sarah", "Sarah")] } }),
    c(2, "Fais l'avenant de Nora pour mardi.", { subjects: { employees: [emp("emp-nora", "Nora")] } }),
    c(3, "Paul est absent depuis hier, prépare ce qu'il faut.", { subjects: { employees: [emp("emp-paul", "Paul")] } }),
    c(4, "Prépare les éléments de pré-paie."),
    c(5, "Prépare le départ de Marc.", { subjects: { employees: [emp("emp-marc", "Marc")] } }),
    c(6, "Continue la mission.", { continuityContext: { missions: [{ id: "mis-onb", label: "Onboarding Sarah" }] } }),
    c(7, "Corrige seulement le document.", { continuityContext: { artifacts: [{ id: "art-doc", label: "Avenant de Nora" }] } }),
    c(8, "Utilise la dernière version.", { continuityContext: { artifacts: [{ id: "v1", label: "Doc", updatedAtIso: "2026-07-01" }, { id: "v2", label: "Doc", updatedAtIso: "2026-07-10" }] } }),
    c(9, "Qu'est-ce qui bloque ?", { continuityContext: { missions: [{ id: "mis-onb", label: "Onboarding Sarah" }] } }),
    c(10, "Envoie le mail maintenant."),
    c(11, "Signe le document."),
    c(12, "Augmente Sarah de 20 % immédiatement.", { mode: "enterprise_autonomous", subjects: { employees: [emp("emp-sarah", "Sarah")] } }),
    c(13, "Licencie Paul.", { mode: "enterprise_autonomous", subjects: { employees: [emp("emp-paul", "Paul")] } }),
    c(14, "Décide de la sanction.", { mode: "enterprise_autonomous" }),
    c(15, "Prépare l'avenant."), // missing employee
    c(16, "Prépare l'avenant de Sarah.", { subjects: { employees: [ambiguousEmp("Sarah", [{ id: "s1", label: "Sarah Martin", distinguisher: "site Paris" }, { id: "s2", label: "Sarah Durand", distinguisher: "site Lyon" }])] } }),
    c(17, "Fais l'avenant de Nora pour hier et pour demain.", { subjects: { employees: [emp("emp-nora", "Nora")] } }), // conflicting dates
    c(18, "Prépare l'onboarding de Sarah lundi.", { subjects: { employees: [emp("emp-sarah", "Sarah")] } }), // duplicate of #1 → must be identical
    c(19, "Montre le dossier de Sonia.", { subjects: { employees: [forbiddenEmp("Sonia")] } }), // foreign-tenant entity
    c(20, "Commande du café pour la réunion."), // unsupported
  ]);
}
