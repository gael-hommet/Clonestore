// src/lib/pierre/v1/ultimate/p16a/integration-contract.ts
// P16A — THE P16C INTEGRATION CONTRACT (owner §14). `buildPierreUltimateContract` is a PURE mapper that
// assembles the already-computed pieces (interpretation, clarification, enriched capabilities, final-
// decision floor, continuity intent, optional REUSED runtime plan) into one typed, bounded, tenant-
// neutral, secret-free contract for P16C. `analyzeForP16C` is the async orchestrator that computes those
// pieces from the REAL cognitive runtime (deterministic by default — no OpenAI in tests). This layer
// PLANS nothing itself and WIRES no technology: it only DECLARES the T1/T2/CloneChat needs, the provider/
// legal blockers, and the next safe step. The mission plan, when present, comes from the existing
// generateCognitivePlan → compileMissionPlan (reused, not re-implemented).

import { interpretRequest, type InterpretOptions } from "../../cognitive-runtime/request-interpreter";
import { computeClarifications, type ClarificationQuestion } from "../../cognitive-runtime/clarification-engine";
import type { PierreRequestInterpretation } from "../../cognitive-runtime/types";
import type { GeneratedPlan } from "../../cognitive-runtime/plan-generator";
import type { AutonomyMode } from "../../autonomy";
import { retrieveForRequest, pierreCapabilityCount } from "./capability-adapter";
import { classifyFinalDecisionFloor, type FinalDecisionFloor } from "./sensitive-floor";
import { classifyContinuityIntent, type ContinuityContext } from "./continuity-intent";
import { metaForItem } from "./canonical-items";
import type {
  PierreUltimateIntegrationContract, P16ASelectedCapability, P16ADisposition,
  P16AMissionTask, P16AT1Need, P16AT2Need, P16ABlockedReason,
} from "./types";

// Client-safe disclosure — aligned with the P9 contract's disclosure (country-legal auto-execution is NOT
// available; sensitive acts pass human validation; prepared ≠ sent/signed). Never claims live capability.
export const P16A_DISCLOSURE =
  "Pierre prépare le travail RH et transforme vos demandes en missions gouvernées ; toute action sensible passe par une validation humaine et rien n'est envoyé ni signé sans provider actif. L'exécution légale automatique par pays n'est PAS disponible aujourd'hui (0 règle pays vérifiée par un juriste).";

// ── canonical item mapping (domain / cue → which of the 12 Ultimate items a request exercises) ──────
const DOMAIN_TO_ITEM: Readonly<Record<string, string>> = {
  onboarding: "pierre.onboarding_offboarding",
  offboarding: "pierre.onboarding_offboarding",
  contract: "pierre.document_depth",
  employee360: "pierre.dossier_360",
  absence: "pierre.absences_prepayroll",
  payroll: "pierre.absences_prepayroll",
  performance: "pierre.interview_perf_training",
  training: "pierre.interview_perf_training",
  career: "pierre.interview_perf_training",
  relations: "pierre.employee_relations_sensitive",
  disciplinary: "pierre.employee_relations_sensitive",
  proactive: "pierre.proactive_followup",
  reporting: "pierre.monthly_value_report",
  policy: "pierre.hr_helpdesk_quality",
  org: "pierre.mission_depth",
};

// T1 ids whose LIVE capability is blocked (mirrors the real T1 registry liveBlockedReason; a P16A test
// cross-checks this map against the actual T1 technology registry so it can never silently drift).
const T1_LIVE_BLOCKED: Readonly<Record<string, string>> = {
  mail: "Envoi email live bloqué — domaine/provider externe non vérifié.",
  calendar: "Provider calendrier live indisponible.",
  signature: "Signature live bloquée (Yousign P8.7.4) — fallback préparé.",
  voice: "Provider vocal indisponible — l'entrée texte reste autoritaire.",
  notification: "Push temps réel indisponible — rappels cockpit uniquement.",
  connector: "Connecteurs SIRH/paie/Slack externes non vérifiés.",
};
const T1_NEED_REASON: Readonly<Record<string, string>> = {
  document: "Rendu/gabarits documentaires (préparation, jamais garantie légale).",
  export: "Export documentaire (téléchargement manuel, aucun transfert live).",
  workflow: "Orchestration de workflow gouverné (le moteur de missions V1 reste la source).",
  notification: "Relances/rappels gouvernés.",
  memory: "Mémoire durable au périmètre société.",
  evidence: "Trace/preuve d'audit réutilisable.",
  analytics: "Rapport de valeur/ROI (estimations, jamais garanti).",
  calendar: "Préparation d'événements/entretiens.",
  mail: "Rédaction d'emails (envoi sous validation, jamais autonome).",
  signature: "Paquet de signature préparé (circuit manuel/externe).",
  connector: "Sourcing externe (SIRH/convention) — jamais inventer le droit.",
  voice: "Entrée vocale → mission (roadmap).",
  file: "Ingestion de fichiers (revue manuelle requise).",
  permission: "Décision de permission/scope fail-closed.",
  integration_bus: "Bus techno consommable multi-employés.",
};
const T2_NEED_REASON: Readonly<Record<string, string>> = {
  cloneadn: "ADN société (ton/contexte autorisé) pour ancrer les documents.",
  clonebrief: "Brief de mission/communication structuré.",
  clonereview: "Relecture/qualité du livrable.",
  clonecontinuum: "Continuité de mission durable.",
  cloneguard: "Gate de qualité/risque RH.",
  clonelearn: "Trames formation/compétences.",
  clonepolicy: "Politique/vigilance applicable.",
  clonesignals: "Signaux proactifs → relances.",
  clonetrace: "Traçabilité/preuve.",
};

const DISPO_RANK: Readonly<Record<P16ADisposition, number>> = {
  read_explain: 0, execute_local: 1, propose: 2, prepare: 3,
  validation_required: 4, provider_blocked: 5, human_only: 6, refused_unsupported: 7,
};
const RANK_TO_DISPO: readonly P16ADisposition[] = [
  "read_explain", "execute_local", "propose", "prepare", "validation_required", "provider_blocked", "human_only", "refused_unsupported",
];

const INFO_KINDS = new Set(["INFORMATION", "ANALYSIS", "MONITORING", "OPTIMIZATION"]);
const MUST_NOT_CLAIM_PAYROLL = /\b(paie\s+compl|\bdsn\b|bulletin\s+de\s+paie|fiche\s+de\s+paie|logiciel\s+de\s+paie|moteur\s+de\s+paie)\b/i;

// Multi-intent: ≥2 distinct action families present in one utterance ("fais l'avenant … ET préviens …").
const INTENT_FAMILIES: readonly RegExp[] = [
  /\b(prepar|fais|cree|redige|redig|avenant|contrat|attestation|document|lettre)\w*/i,
  /\b(previen|prevenir|informe|notifi|envoie|communiqu)\w*/i,
  /\b(planifi|programme|convoqu|rdv|rendez-vous|entretien|calendrier)\w*/i,
  /\b(signe|signature|signer)\w*/i,
  /\b(relanc|rappel|suivi|suivre)\w*/i,
];
function detectMultiIntent(instruction: string): boolean {
  const t = instruction.normalize("NFD").replace(/[̀-ͯ]/g, ""); // accent-fold so "préviens" matches
  const hits = INTENT_FAMILIES.filter((re) => re.test(t)).length;
  return hits >= 2;
}

function uniq<T>(xs: readonly T[]): T[] { return [...new Set(xs)]; }

// Instruction cues → canonical item (covers items with no direct domain mapping, e.g. sector adaptation).
const CUE_TO_ITEM: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(convention collective|secteur|branche|sectoriel)\b/i, "pierre.sector_adaptation"],
  [/\b(pr[ée]-?paie|paie|bulletin|dsn|[ée]l[ée]ments variables)\b/i, "pierre.absences_prepayroll"],
  [/\b(roi|valeur|rapport (?:du )?mois|rapport mensuel)\b/i, "pierre.monthly_value_report"],
  [/\b(dossier|360)\b/i, "pierre.dossier_360"],
  [/\b(entretien|performance|formation|comp[ée]tence)\b/i, "pierre.interview_perf_training"],
  [/\b(onboarding|int[ée]gration|d[ée]part|offboarding)\b/i, "pierre.onboarding_offboarding"],
];

function itemsInvolved(instruction: string, caps: readonly P16ASelectedCapability[], interpretation: PierreRequestInterpretation, floor: FinalDecisionFloor): string[] {
  const items = new Set<string>();
  for (const c of caps) {
    const it = DOMAIN_TO_ITEM[c.domain];
    if (it) items.add(it);
  }
  for (const [re, id] of CUE_TO_ITEM) if (re.test(instruction)) items.add(id);
  if (interpretation.requestKind === "OPERATION") items.add("pierre.mission_depth");
  if (INFO_KINDS.has(interpretation.requestKind)) items.add("pierre.hr_helpdesk_quality");
  if (floor.humanOnly) { items.add("pierre.employee_relations_sensitive"); items.add("pierre.hr_quality_control"); }
  if (items.size === 0) items.add("pierre.hr_helpdesk_quality");
  return [...items];
}

export type BuildContractInput = {
  readonly requestId: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly instruction: string;
  readonly nowIso: string;
  readonly interpretation: PierreRequestInterpretation;
  readonly clarificationQuestions: readonly ClarificationQuestion[];
  readonly clarificationBlocks: boolean;
  readonly selectedCapabilities: readonly P16ASelectedCapability[];
  readonly floor: FinalDecisionFloor;
  readonly continuity: ReturnType<typeof classifyContinuityIntent>;
  readonly plan?: GeneratedPlan | null;
  readonly mode: AutonomyMode;
};

/** Pure assembler: pre-computed pieces → the P16C integration contract. Deterministic, bounded, secret-free. */
export function buildPierreUltimateContract(input: BuildContractInput): PierreUltimateIntegrationContract {
  const { interpretation, selectedCapabilities: caps, floor, continuity, plan } = input;

  const multiIntent = detectMultiIntent(input.instruction) || interpretation.requestKind === "MULTI_OBJECTIVE";
  const mustNotClaimPayroll = MUST_NOT_CLAIM_PAYROLL.test(input.instruction);

  // Permission floor: an entity the actor may not access (cross-tenant / forbidden) is a HARD block —
  // Pierre must never act on it (owner §19: no company/employee data leaks across tenants).
  const allSubjects = [
    ...interpretation.subjects.employees, ...interpretation.subjects.managers, ...interpretation.subjects.teams,
    ...interpretation.subjects.sites, ...interpretation.subjects.contracts, ...interpretation.subjects.documents,
  ];
  const forbiddenEntities = allSubjects.filter((e) => e.status === "forbidden");

  // ── overall disposition (honest headline) ────────────────────────────────────────────────────────
  let overall: P16ADisposition;
  const isInfo = INFO_KINDS.has(interpretation.requestKind);
  if (floor.humanOnly) {
    overall = "human_only";
  } else if (caps.length === 0 && !continuity.isContinuation && interpretation.requestKind === "OPERATION") {
    overall = "refused_unsupported";
  } else {
    const ranks = caps.map((c) => DISPO_RANK[c.disposition]);
    const maxRank = ranks.length ? Math.max(...ranks) : (isInfo ? 0 : 3);
    overall = RANK_TO_DISPO[maxRank];
    if (input.clarificationBlocks && (overall === "execute_local" || overall === "read_explain")) overall = "prepare";
    if (mustNotClaimPayroll && DISPO_RANK[overall] < DISPO_RANK["prepare"]) overall = "prepare";
  }
  // A forbidden entity clamps the disposition to at least validation_required (a permitted human must act).
  if (forbiddenEntities.length > 0 && overall !== "human_only" && DISPO_RANK[overall] < DISPO_RANK["validation_required"]) {
    overall = "validation_required";
  }

  // ── mission proposal (reused plan if provided, else capability outline) ───────────────────────────
  let tasks: P16AMissionTask[];
  let source: "reused_runtime_plan" | "capability_derived_outline" | "none";
  let executableNow: boolean;
  let blockers: string[];
  if (plan) {
    const govByStep = new Map(plan.stepGovernance.map((g) => [g.stepKey, g] as const));
    tasks = plan.planInput.steps.map((s) => {
      const g = govByStep.get(s.step_key);
      return { key: s.step_key, label: s.action_key, dependsOn: [...s.depends_on ?? []], mode: g?.mode ?? "CONFIRMATION_REQUIRED", requiresApproval: g?.requiresApproval ?? true };
    });
    source = "reused_runtime_plan";
    executableNow = plan.executableNowAutonomously && !input.clarificationBlocks && !floor.humanOnly;
    blockers = [...plan.blockers];
  } else if (caps.length > 0) {
    tasks = caps.slice(0, 8).map((c, i) => ({
      key: `outline.${i + 1}.${c.id}`,
      label: `Préparer: ${c.label}`,
      dependsOn: i > 0 ? [`outline.1.${caps[0].id}`] : [],
      mode: c.disposition === "human_only" ? "HUMAN_DECISION_REQUIRED" : c.disposition === "execute_local" ? "AUTONOMOUS" : "CONFIRMATION_REQUIRED",
      requiresApproval: c.disposition !== "execute_local" && c.disposition !== "read_explain",
    }));
    source = "capability_derived_outline";
    executableNow = false; // an outline is NOT an executable plan — only the real compiler produces one
    blockers = input.clarificationBlocks ? ["missing_information"] : [];
  } else {
    tasks = [];
    source = "none";
    executableNow = false;
    blockers = overall === "refused_unsupported" ? ["unsupported_request"] : [];
  }

  const deliverables = uniq(caps.flatMap((c) => c.expectedArtifacts)).slice(0, 12);
  const completionCriteria = [
    "Tous les livrables préparés et relus.",
    ...(floor.humanOnly ? ["Décision(s) sensible(s) tranchée(s) par un humain (jamais par Pierre)."] : []),
    ...(overall === "provider_blocked" ? ["Action live débloquée par un provider actif (P16C/externe)."] : []),
    ...(input.clarificationBlocks ? ["Informations manquantes obligatoires fournies."] : []),
  ];

  // ── validations / human-only ──────────────────────────────────────────────────────────────────────
  const requiredValidations = uniq([
    ...caps.filter((c) => c.disposition === "validation_required" || c.disposition === "human_only" || c.disposition === "provider_blocked" || c.disposition === "prepare")
      .map((c) => `Validation humaine avant effet: ${c.label}`),
    ...floor.decisions.map((d) => `Décision humaine requise: ${d.category}`),
  ]).slice(0, 12);

  // ── canonical items + tech needs ───────────────────────────────────────────────────────────────────
  const canonicalItemsInvolved = itemsInvolved(input.instruction, caps, interpretation, floor);
  const t1Ids = uniq(canonicalItemsInvolved.flatMap((id) => metaForItem(id)?.t1Needs ?? []));
  const t2Ids = uniq(canonicalItemsInvolved.flatMap((id) => metaForItem(id)?.t2Needs ?? []));
  const t1Needs: P16AT1Need[] = t1Ids.map((techId) => ({
    techId,
    reason: T1_NEED_REASON[techId] ?? "Technologie T1 requise pour la livraison.",
    liveBlocked: techId in T1_LIVE_BLOCKED,
    blockedReason: T1_LIVE_BLOCKED[techId] ?? null,
  }));
  const t2Needs: P16AT2Need[] = t2Ids.map((techId) => ({ techId, reason: T2_NEED_REASON[techId] ?? "Product-technology T2 requise pour la livraison." }));

  // ── provider / legal / blocked reasons ─────────────────────────────────────────────────────────────
  const providerDependencies = uniq([
    ...caps.flatMap((c) => c.providers),
    ...t1Needs.filter((n) => n.liveBlocked).map((n) => n.blockedReason ?? n.techId),
  ]);
  const legalDependencies = uniq([
    ...caps.flatMap((c) => c.countryRuleFamilies),
    ...canonicalItemsInvolved.map((id) => metaForItem(id)?.externalDependency).filter((x): x is string => !!x && /l[ée]gal|droit|paie|sirh/i.test(x)),
    ...(floor.categories.includes("legal_conclusion") ? ["Revue juridique humaine qualifiée requise."] : []),
  ]);

  const blockedReasons: P16ABlockedReason[] = [];
  if (floor.humanOnly) blockedReasons.push({ code: "human_only_final_decision", detail: floor.decisions.map((d) => d.category).join(", ") });
  for (const p of providerDependencies) blockedReasons.push({ code: "provider_blocked", detail: p });
  if (legalDependencies.length) blockedReasons.push({ code: "legal_blocked", detail: legalDependencies.join("; ") });
  if (input.clarificationBlocks) blockedReasons.push({ code: "missing_information", detail: input.clarificationQuestions.filter((q) => q.blocksExecution).map((q) => q.field).join(", ") || "champ obligatoire manquant" });
  if (mustNotClaimPayroll) blockedReasons.push({ code: "must_not_claim_payroll_engine", detail: "Pré-paie préparée uniquement — jamais un moteur de paie/DSN." });
  if (forbiddenEntities.length > 0) blockedReasons.push({ code: "permission_forbidden_entity", detail: `Entité hors périmètre (cross-tenant) : ${forbiddenEntities.map((e) => e.label).join(", ")} — Pierre n'agit pas.` });
  if (overall === "refused_unsupported") blockedReasons.push({ code: "unsupported_request", detail: "Aucune capacité RH ne correspond à la demande." });

  // ── context / document-evidence requirements ────────────────────────────────────────────────────────
  const contextRequirements = uniq([
    ...interpretation.missingInformation.map((m) => m.question),
    ...(caps.length ? ["Contexte société autorisé (dossier, politique, ton) requis — jamais fabriqué."] : []),
    ...uniq(caps.flatMap((c) => c.requiredInputs)).slice(0, 8),
  ]).slice(0, 14);
  const documentEvidenceRequirements = uniq([
    ...deliverables.map((d) => `Artefact: ${d}`),
    ...(continuity.isCorrection ? ["Lignée documentaire (version/source) de l'artefact corrigé — admise honnêtement si absente."] : []),
  ]).slice(0, 14);

  // ── explanation / next safe step ────────────────────────────────────────────────────────────────────
  const nextSafeStep = continuity.isContinuation
    ? "Re-lire l'état durable autoritaire de la mission/artefact avant toute action (jamais depuis le texte du chat)."
    : NEXT_STEP_BY_DISPO[overall];

  const statusExplanation = buildStatusExplanation(overall, floor, providerDependencies.length, legalDependencies.length, input.clarificationBlocks);

  const authoritativeReferences = uniq([
    "hr-canon/capability-registry (HR_CAPABILITIES)",
    "hr-canon/capability-closure (CLOSED_HR_CAPABILITIES)",
    "cloneguard.evaluateGuard",
    "autonomy.decideValidation",
    ...(plan ? ["runtime-plan-compiler.compileMissionPlan", plan.compiled.plan_fingerprint].filter(Boolean) as string[] : []),
  ]);

  return {
    version: 1,
    requestId: input.requestId,
    companyId: input.companyId,
    actorId: input.actorId,
    instruction: input.instruction,
    nowIso: input.nowIso,
    understanding: {
      normalizedObjective: interpretation.normalizedObjective,
      requestKind: interpretation.requestKind,
      desiredOutcomes: interpretation.desiredOutcomes,
      relevantDomains: interpretation.relevantDomains,
      confidence: interpretation.confidence,
      resolvedDates: interpretation.dates,
      resolvedEntities: [...interpretation.subjects.employees, ...interpretation.subjects.managers, ...interpretation.subjects.teams, ...interpretation.subjects.sites, ...interpretation.subjects.contracts, ...interpretation.subjects.documents],
      multiIntent,
    },
    clarification: { questions: input.clarificationQuestions, blocksExecution: input.clarificationBlocks },
    selectedCapabilityIds: caps.map((c) => c.id),
    selectedCapabilities: caps,
    capabilityCount: pierreCapabilityCount(), // DERIVED from the real registry length, never hardcoded
    capabilityCountDerivedFromRegistry: true,
    missionProposal: { objective: plan?.objective ?? interpretation.normalizedObjective, tasks, deliverables, completionCriteria, executableNow, blockers, source },
    autonomy: { overallDisposition: overall, requiredValidations, humanOnlyDecisions: floor.decisions, guardLevel: floor.guardLevel },
    continuity,
    contextRequirements,
    documentEvidenceRequirements,
    providerDependencies,
    legalDependencies,
    blockedReasons,
    t1Needs,
    t2Needs,
    cloneChatExplanation: { summary: statusExplanation, disclosure: P16A_DISCLOSURE, safeToShowUser: true },
    authoritativeReferences,
    canonicalItemsInvolved,
    statusExplanation,
    nextSafeStep,
  };
}

const NEXT_STEP_BY_DISPO: Readonly<Record<P16ADisposition, string>> = {
  human_only: "Préparer une synthèse factuelle + options et escalader la décision finale à un humain.",
  provider_blocked: "Préparer localement ; l'action live nécessite un provider actif (P16C/externe).",
  validation_required: "Préparer la proposition gouvernée et demander la validation humaine avant tout effet.",
  prepare: "Préparer le brouillon/artefact pour relecture humaine.",
  propose: "Proposer l'action gouvernée pour confirmation.",
  execute_local: "Exécuter sous le mode d'autonomie courant, avec trace.",
  read_explain: "Répondre avec une synthèse ancrée sur la canon RH (aucun effet).",
  refused_unsupported: "Décliner honnêtement et proposer une reformulation.",
};

function buildStatusExplanation(overall: P16ADisposition, floor: FinalDecisionFloor, providers: number, legal: number, missingInfo: boolean): string {
  const parts: string[] = [];
  if (overall === "refused_unsupported") return "Demande non supportée — aucune capacité RH correspondante ; Pierre décline honnêtement.";
  if (floor.humanOnly) parts.push(`Décision sensible (${floor.decisions.map((d) => d.category).join(", ")}) réservée à un humain — Pierre prépare uniquement.`);
  if (missingInfo) parts.push("Informations obligatoires manquantes — clarification requise avant exécution.");
  if (providers > 0) parts.push("Une ou plusieurs actions nécessitent un provider live (bloqué).");
  if (legal > 0) parts.push("Dépendance légale/pays — jamais de garantie de conformité ; revue humaine requise.");
  if (parts.length === 0) parts.push("Pierre peut préparer/exécuter le travail sous gouvernance, sous validation où requis.");
  return parts.join(" ");
}

// ── async orchestrator (deterministic default — no OpenAI) ────────────────────────────────────────────
export type AnalyzeForP16COptions = {
  readonly mode?: AutonomyMode;
  readonly enabled?: boolean;                 // LLM planner override (default: deterministic)
  readonly interpret?: InterpretOptions["interpret"];
  readonly subjects?: InterpretOptions["subjects"];
  readonly continuityContext?: ContinuityContext;
  readonly plan?: GeneratedPlan | null;
  readonly capabilityLimit?: number;
};

/**
 * Full P16C contract from a raw HR request, computed over the REAL runtime. Deterministic unless
 * `enabled`/`interpret` inject the LLM. Tenant-neutral: entities/continuity candidates are INJECTED.
 */
export async function analyzeForP16C(
  args: { requestId: string; companyId: string; actorId: string; instruction: string; nowIso: string },
  opts: AnalyzeForP16COptions = {},
): Promise<PierreUltimateIntegrationContract> {
  const interpretation = await interpretRequest(
    { requestId: args.requestId, companyId: args.companyId, actorId: args.actorId, instruction: args.instruction },
    { nowIso: args.nowIso, enabled: opts.enabled ?? false, interpret: opts.interpret, subjects: opts.subjects },
  );
  const clar = computeClarifications({
    entities: [...interpretation.subjects.employees, ...interpretation.subjects.managers, ...interpretation.subjects.teams, ...interpretation.subjects.sites, ...interpretation.subjects.contracts, ...interpretation.subjects.documents, ...interpretation.subjects.missions, ...interpretation.subjects.cases],
    dates: interpretation.dates, amounts: interpretation.amounts, ambiguities: [], missingInformation: interpretation.missingInformation,
  });
  const selectedCapabilities = retrieveForRequest(args.instruction, { limit: opts.capabilityLimit });
  const floor = classifyFinalDecisionFloor(args.instruction);
  const continuity = classifyContinuityIntent(args.instruction, opts.continuityContext ?? {});

  return buildPierreUltimateContract({
    requestId: args.requestId, companyId: args.companyId, actorId: args.actorId,
    instruction: args.instruction, nowIso: args.nowIso,
    interpretation, clarificationQuestions: clar.questions, clarificationBlocks: clar.blocksExecution,
    selectedCapabilities, floor, continuity, plan: opts.plan ?? null, mode: opts.mode ?? "normal",
  });
}
