// src/lib/clonestore/integration/p16c/p16c-clonechat-adapter.ts
// P16C — SURFACE de délégation CloneChat (client-safe). CloneChat classe : explication vs support vs
// travail RH. Le travail RH est DÉLÉGUÉ à Pierre (P16A) puis intégré par P16C ; l'explication ne crée
// AUCUNE mission ; le support n'est pas envoyé à Pierre. La sortie renvoyée au client est BORNÉE et
// SANS CHEMIN INTERNE (jamais de nom de module/chemin de code) ni secret. L'exécution reste derrière la
// route de confirmation existante ; aucune complétion n'est fabriquée ; aucun 2e client OpenAI.

import { runP16CIntegration } from "./p16c-integration-runtime";
import type { P16CGovernanceState, P16CMissionStatus } from "./p16c-types";

export type CloneChatIntentKind = "hr_work" | "support" | "explanation";

interface ToolCallLike { readonly name?: string; readonly arguments?: Record<string, unknown> }

const HR_WORK_TOOLS = new Set(["create_mission", "prepare_mission"]);
const SUPPORT_TOOLS = new Set(["create_support_case", "report_issue"]);
// Repli : impératif RH clair (l'ancrage principal reste le tool-call décidé par le modèle).
const HR_IMPERATIVE = /\b(pr[ée]pare|fais|cr[ée]e|r[ée]dige|lance|planifie|onboarding|offboarding|avenant|contrat|absence|pr[ée]-?paie|licenci|augment|sanction|entretien|d[ée]part|mission)\w*/i;
const QUESTION_CUE = /\?|\b(qu['e]est-ce|comment|pourquoi|explique|c'est quoi|à quoi sert|peux-tu m'expliquer)\b/i;

/** Classe l'intention CloneChat. L'ancrage est le tool-call ; repli heuristique sinon. Pur. */
export function classifyCloneChatIntent(message: string, toolCall?: ToolCallLike | null): CloneChatIntentKind {
  const name = (toolCall?.name ?? "").trim();
  if (HR_WORK_TOOLS.has(name)) return "hr_work";
  if (SUPPORT_TOOLS.has(name)) return "support";
  const msg = message ?? "";
  // Question explicite sans tool d'effet → explication (aucune mission).
  if (QUESTION_CUE.test(msg) && !HR_WORK_TOOLS.has(name)) return "explanation";
  if (HR_IMPERATIVE.test(msg)) return "hr_work";
  return "explanation";
}

// ── Résumé client-safe (aucun chemin interne, aucun secret) ────────────────────────────────────────
export interface P16CClientGovernanceSummary {
  readonly kind: "hr_work";
  readonly createsMission: true;
  readonly effectiveGovernanceState: P16CGovernanceState;
  readonly missionStatus: P16CMissionStatus;
  readonly validations: readonly string[];
  readonly humanOnlyDecisions: readonly string[];
  readonly providerBlockers: readonly string[];
  readonly legalBlockers: readonly string[];
  readonly blockers: readonly string[];
  readonly expectedDeliverables: readonly string[];
  readonly relevantSources: readonly string[];
  readonly nextSafeStep: string;
  readonly disclosure: string;
  /** INVARIANTS client : jamais de complétion fabriquée, jamais d'effet externe. */
  readonly authoritativeCompletion: false;
  readonly externallyExecutable: false;
}

export interface P16CClientExplanation {
  readonly kind: "explanation" | "support";
  readonly createsMission: false;
  readonly note: string;
  readonly disclosure: string | null;
}

export type P16CClientDelegation = P16CClientGovernanceSummary | P16CClientExplanation;

// Sources client-safe (libellés amicaux — JAMAIS de chemin de module/code).
const SOURCE_LABELS: Readonly<Record<string, string>> = {
  capability: "Base de capacités RH canoniques",
  guard: "Gouvernance CloneGuard",
  autonomy: "Moteur d'autonomie/validation",
  plan: "Plan de mission gouverné",
};
function clientSafeSources(): string[] {
  return [SOURCE_LABELS.capability, SOURCE_LABELS.guard, SOURCE_LABELS.autonomy, SOURCE_LABELS.plan];
}

export interface P16CDelegationArgs {
  readonly message: string;
  readonly identity: { readonly companyId: string; readonly actorId: string };
  readonly nowIso: string;
  readonly requesterRole?: string;
  readonly toolCall?: ToolCallLike | null;
  /** Instruction canonique (dérivée serveur) si distincte du message brut. */
  readonly instruction?: string;
}

/**
 * Point d'entrée CloneChat : classe puis, pour du travail RH, calcule le résumé de gouvernance P16C
 * CLIENT-SAFE (via le VRAI contrat Pierre + intégration P16C). Déterministe, tenant scopé serveur.
 * Explication/support → aucune mission. Ne lève jamais (fail-safe → explication).
 */
export async function buildCloneChatDelegation(args: P16CDelegationArgs): Promise<P16CClientDelegation> {
  const intent = classifyCloneChatIntent(args.message, args.toolCall);

  if (intent === "support") {
    return { kind: "support", createsMission: false, note: "Demande de support — aucune mission RH créée.", disclosure: null };
  }
  if (intent === "explanation") {
    return {
      kind: "explanation", createsMission: false,
      note: "Question d'explication — aucune mission créée ; réponse ancrée sur l'état autoritaire.",
      disclosure: "Pierre prépare le travail RH ; toute action sensible passe par une validation humaine, rien n'est envoyé ni signé sans provider actif.",
    };
  }

  // ── Travail RH : déléguer à Pierre (P16A) + intégrer P16C ──
  const instruction = (args.instruction ?? args.message).trim();
  const result = await runP16CIntegration(
    { requestId: `cc-${args.identity.actorId}`, companyId: args.identity.companyId, actorId: args.identity.actorId, instruction, nowIso: args.nowIso },
    { requesterRole: args.requesterRole },
  );

  // Contrat rejeté (tenant/forge) → aucune mission, message honnête (jamais de fuite d'existence).
  if (!result.ok || !result.plan || !result.merged) {
    return { kind: "explanation", createsMission: false, note: "Demande non traitée (périmètre/validation).", disclosure: null };
  }

  const plan = result.plan;
  return {
    kind: "hr_work",
    createsMission: true,
    effectiveGovernanceState: plan.effectiveGovernanceState,
    missionStatus: result.merged.missionStatus,
    validations: plan.validations,
    humanOnlyDecisions: plan.humanOnlyDecisions,
    providerBlockers: plan.providerBlockers,
    legalBlockers: plan.legalBlockers,
    blockers: plan.exactBlockers,
    expectedDeliverables: result.merged.evidenceRefs.filter((r) => r.startsWith("t1.") || r.startsWith("cloneos.")).slice(0, 12),
    relevantSources: clientSafeSources(),
    nextSafeStep: plan.nextSafeStep,
    disclosure: plan.cloneChatExplanation,
    authoritativeCompletion: false,
    externallyExecutable: false,
  };
}
