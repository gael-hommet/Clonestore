// src/lib/clonestore/product-technologies/t2/cloneos-product-tech.ts
// T2 — CloneOS : le cœur opératoire invisible de CloneStore. Transforme une demande brute
// en travail structuré : intention → mission → tâches → dépendances → routage employés →
// transfert de contexte → plan de fusion → transitions d'état. LOCAL, PROPOSITIF, GOUVERNÉ.
// CloneOS ne contient PAS : mémoire d'entreprise (CloneADN), décision de risque (CloneGuard),
// historique (CloneTrace), voix (CloneVoice), qualité finale (CloneReview), NI logique RH
// spécifique à Pierre (le raisonnement RH reste dans le moteur V1 — jamais dupliqué).

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import type { IntentKind } from "./product-technology-types";

// ── Aides PURES partagées par la couche (CloneVoice/CloneCall les réutilisent) ──

const INTENT_RULES: readonly { kind: IntentKind; keywords: readonly string[] }[] = [
  { kind: "draft_email", keywords: ["email", "e-mail", "mail", "courrier", "message"] },
  { kind: "prepare_document", keywords: ["document", "attestation", "contrat", "avenant", "courrier type", "rédige", "rédiger"] },
  { kind: "schedule_event", keywords: ["entretien", "rendez-vous", "réunion", "planifie", "planifier", "calendrier"] },
  { kind: "analyze", keywords: ["analyse", "analyser", "rapport", "métrique", "statistique", "roi", "indicateur"] },
  { kind: "follow_up", keywords: ["relance", "relancer", "suivi", "suivre", "rappel"] },
  { kind: "hr_case_preparation", keywords: ["absence", "congé", "onboarding", "offboarding", "disciplinaire", "licenciement", "salarié", "paie"] },
];

/** Classe une demande en intention canonique. Pur, déterministe (aucun LLM ici). */
export function classifyIntentKind(text: string): IntentKind {
  const lower = text.toLowerCase();
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.kind;
  }
  return "generic_mission";
}

const ACTION_SPLITTERS = /(?:\.|;|\n| puis | ensuite | et enfin | et après | d'abord,)/gi;

/** Segmente une demande en actions élémentaires. Pur. */
export function segmentIntoActions(text: string): string[] {
  return text
    .split(ACTION_SPLITTERS)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

const SENSITIVE_HR_TERMS: readonly string[] = [
  "licenci", "disciplinair", "sanction", "rupture", "salair", "rémunérat", "préavis", "faute grave",
  // Anglais + allemand (marché CH) + euphémismes — le sensible ne dépend pas de la langue.
  "terminat", "dismiss", "fire ", "layoff", "severance", "salary", "payroll", "kündig", "entlass",
  "mettre fin au contrat", "solde de tout compte",
];

/** Détection advisory de langage RH sensible (même esprit que T1/P14). Pur. */
export function detectSensitiveHrLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return SENSITIVE_HR_TERMS.some((t) => lower.includes(t));
}

const TASK_DOMAIN_RULES: readonly { domain: string; keywords: readonly string[] }[] = [
  { domain: "hr", keywords: ["salarié", "contrat", "absence", "congé", "onboarding", "offboarding", "entretien", "rh", "paie", "disciplinaire", "licenci"] },
  { domain: "finance", keywords: ["facture", "devis", "comptab", "budget"] },
  { domain: "sales", keywords: ["client", "prospect", "vente", "offre commerciale"] },
];

function detectTaskDomain(text: string): string {
  const lower = text.toLowerCase();
  for (const rule of TASK_DOMAIN_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.domain;
  }
  return "general";
}

// ── Artefact ───────────────────────────────────────────────────────────────────

export interface CloneOSEmployeeDescriptor {
  readonly employeeId: string;
  readonly domains: readonly string[];
}

export interface CloneOSRequestInput {
  readonly request?: string;
  /** Employés IA disponibles (données de l'appelant — AUCUN employé n'est hardcodé ici). */
  readonly availableEmployees?: readonly CloneOSEmployeeDescriptor[];
  readonly context?: string;
}

export interface CloneOSTask {
  readonly taskId: string;
  readonly title: string;
  readonly domain: string;
  readonly dependsOn: readonly string[];
}

export interface CloneOSRoutingProposal {
  readonly taskId: string;
  readonly domain: string;
  /** null = aucun employé déclaré pour ce domaine → affectation humaine requise. */
  readonly proposedEmployeeId: string | null;
  readonly note: string;
}

export interface CloneOSMissionPlan {
  readonly artifactKind: "cloneos_mission_plan";
  readonly intention: { readonly raw: string; readonly normalized: string; readonly intentKind: IntentKind };
  readonly missionCandidate: { readonly title: string; readonly objective: string };
  readonly tasks: readonly CloneOSTask[];
  readonly routing: readonly CloneOSRoutingProposal[];
  readonly contextHandoffPlan: readonly { readonly fromTaskId: string; readonly toTaskId: string; readonly context: string }[];
  readonly resultMergePlan: { readonly strategy: "sequential_merge"; readonly order: readonly string[]; readonly finalOutput: string };
  readonly stateTransitionProposal: { readonly current: "draft"; readonly proposed: "awaiting_governance"; readonly allowed: readonly string[] };
  readonly sensitiveHrLanguageDetected: boolean;
  /** Invariants durs : CloneOS propose, ne fait pas. */
  readonly executed: false;
  readonly decidesHrOutcomes: false;
  readonly governanceRequired: true;
}

export const cloneOSProductTech: ProductTechnologyContract<CloneOSRequestInput, CloneOSMissionPlan> =
  defineProductTechnologyContract({
    id: "cloneos",
    name: "CloneOS",
    definition: "Le cœur opératoire invisible de CloneStore : transforme une demande brute en travail structuré, exécutable, coordonné et suivi.",
    role: "Comprendre l'intention, la transformer en mission, découper en tâches, lier les dépendances, proposer le routage employés, router le contexte, planifier la fusion des résultats et les transitions d'état — puis reprendre les missions.",
    answersQuestion: "Comment transformer une demande en vrai travail organisé ?",
    contains: [
      "compréhension d'intention", "construction de mission", "décomposition en tâches", "dépendances",
      "ordre d'exécution", "choix des employés IA (proposition)", "routage de contexte", "coordination",
      "centralisation des résultats intermédiaires", "plan de fusion", "transitions d'état", "reprise de mission",
    ],
    doesNotContain: [
      "mémoire d'entreprise (CloneADN)", "décision risque/conformité (CloneGuard)", "historique exhaustif (CloneTrace)",
      "voix (CloneVoice)", "qualité stylistique finale (CloneReview)", "logique RH spécifique à Pierre (reste dans le moteur V1)",
    ],
    dependencies: ["cloneadn", "cloneguard", "clonepolicy", "clonetrust", "clonetrace"],
    status: "integration_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.cloneos,
    liveBlockedReason: null,
    requiresValidation: true,
    commercialClaimAllowed: "Transforme une demande en plan de mission structuré (tâches, dépendances, routage proposé), en local, sous gouvernance et validation humaine.",
    commercialClaimForbidden: ["exécution autonome sans validation", "décisions RH automatiques", "remplacement du cerveau RH Pierre"],
    prepareArtifact: (input) => {
      const raw = (input?.request ?? "").trim();
      if (raw.length === 0) {
        return { kind: "blocked", artifact: null, blockedReason: "Demande vide — rien à transformer en mission (fail-closed)." };
      }
      const segments = segmentIntoActions(raw);
      const parts = segments.length > 0 ? segments : [raw];
      const tasks: CloneOSTask[] = parts.map((title, i) => ({
        taskId: `task-${i + 1}`,
        title,
        domain: detectTaskDomain(title),
        dependsOn: i === 0 ? [] : [`task-${i}`], // séquentiel par défaut — l'humain/gouvernance réordonne
      }));
      const employees = input?.availableEmployees ?? [];
      const routing: CloneOSRoutingProposal[] = tasks.map((t) => {
        const direct = employees.find((e) => e.domains.includes(t.domain));
        const generalist = direct ? undefined : employees.find((e) => e.domains.includes("general"));
        const match = direct ?? generalist;
        return {
          taskId: t.taskId,
          domain: t.domain,
          proposedEmployeeId: match ? match.employeeId : null,
          // La note dit la VRAIE provenance du match (spécialiste vs généraliste) — jamais un faux signal.
          note: direct
            ? `Proposition : employé déclaré sur le domaine « ${t.domain} » (décision finale : gouvernance + humain).`
            : generalist
              ? `Proposition : employé généraliste (« general ») — AUCUN spécialiste « ${t.domain} » déclaré ; décision finale : gouvernance + humain.`
              : `Aucun employé IA déclaré pour « ${t.domain} » — affectation humaine requise.`,
        };
      });
      const handoffs = tasks.slice(1).map((t, i) => ({
        fromTaskId: tasks[i].taskId,
        toTaskId: t.taskId,
        context: `Résultat intermédiaire de ${tasks[i].taskId} transmis à ${t.taskId} (centralisé par CloneOS, pas de pair-à-pair).`,
      }));
      return {
        kind: "needs_validation",
        artifact: {
          artifactKind: "cloneos_mission_plan",
          intention: { raw, normalized: raw.replace(/\s+/g, " ").trim(), intentKind: classifyIntentKind(raw) },
          missionCandidate: {
            title: parts[0].slice(0, 80),
            objective: `Réaliser, sous gouvernance : ${raw.slice(0, 200)}`,
          },
          tasks,
          routing,
          contextHandoffPlan: handoffs,
          resultMergePlan: {
            strategy: "sequential_merge",
            order: tasks.map((t) => t.taskId),
            finalOutput: "Livrable final unique et cohérent, fusionné par CloneOS puis relu (CloneReview) et validé par l'humain.",
          },
          stateTransitionProposal: { current: "draft", proposed: "awaiting_governance", allowed: ["awaiting_governance", "cancelled"] },
          sensitiveHrLanguageDetected: detectSensitiveHrLanguage(raw),
          executed: false,
          decidesHrOutcomes: false,
          governanceRequired: true,
        },
      };
    },
  });
