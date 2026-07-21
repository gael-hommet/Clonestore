// src/lib/clonechat/server/cloneos-turn.ts
// P19 — CLONEOS SUR LE VRAI CHEMIN CLONECHAT. Deux responsabilités, toutes deux serveur :
//
// 1. `deriveStructuralStatus` — le STATUT STRUCTUREL du tour (answer / clarification_required /
//    proposal_created / mission_created / action_prepared / validation_required / executed / blocked /
//    failed / provider_unavailable). Le client ne déduit plus jamais l'état d'une phrase libre :
//    le statut est calculé depuis les FAITS du tour (honesty canonique, proposition persistée, plan CloneOS).
//
// 2. `buildCloneOsTurn` — pour une demande de travail (proposition create_mission), le VRAI orchestrateur
//    canonique (segmentation multi-actions → gouvernance strictest-wins par action → routage → trace)
//    s'exécute avec le PAYS SERVEUR (pierre_rt_companies.registration_country via getRuntimeDb — PGlite en
//    E2E, Postgres en prod ; jamais le texte du message). Client-safe : résumé sans chemin interne.
//    L'exécution reste derrière /api/assistant/execute → runtime mission V1 (aucun second moteur).

import { orchestrate, type CloneOsPlan } from "../../clonestore/cloneos/canonical/cloneos-orchestrator";
import { getRuntimeDb } from "../../pierre/v1/db";

export type ChatStructuralStatus =
  | "answer" | "clarification_required" | "proposal_created" | "mission_created"
  | "action_prepared" | "validation_required" | "executed" | "blocked" | "failed" | "provider_unavailable";

export type StructuralStatusInput = {
  readonly honesty: string;                       // enum canonique du rendu (answered/clarification_required/unknown/blocked/escalated)
  readonly proposalKind: string | null;           // proposition persistée par le serveur (référence), sinon null
  readonly cloneos: CloneOsTurnSummary | null;    // plan CloneOS du tour, si demande de travail
  readonly providerUnavailable?: boolean;         // OpenAI/budget indisponible ce tour
  readonly turnFailed?: boolean;                  // erreur interne du tour
};

/** Statut structurel du tour — dérivé de faits, jamais d'une phrase. Pure. */
export function deriveStructuralStatus(i: StructuralStatusInput): ChatStructuralStatus {
  if (i.turnFailed) return "failed";
  if (i.providerUnavailable) return "provider_unavailable";
  if (i.honesty === "blocked" || i.cloneos?.blocked) return "blocked";
  if (i.honesty === "clarification_required") return "clarification_required";
  if (i.cloneos?.requiresValidation) return "validation_required";
  if (i.proposalKind === "create_mission" && i.cloneos) return "action_prepared"; // plan gouverné, rien d'exécuté
  if (i.proposalKind) return "proposal_created";
  // "mission_created"/"executed" n'apparaissent JAMAIS ici : seuls /execute et le runtime V1 les produisent.
  return "answer";
}

export type CloneOsTurnSummary = {
  readonly version: "cloneos-turn-1";
  readonly legalCountry: string | null;           // pays SERVEUR (jamais le texte)
  readonly actions: number;                        // segmentation multi-actions
  readonly tasks: ReadonlyArray<{ action: string; decision: string; autonomyGranted: string; jurisdictional: boolean }>;
  readonly requiresValidation: boolean;
  readonly blocked: boolean;
  readonly traceEventCount: number;
  readonly executed: false;                        // structurel : CloneOS ne fait que PLANIFIER ici
};

/** Pays légal du tenant depuis le runtime V1 (RLS-scopé par id). Null si inconnu (fail-closed en aval). */
export async function resolveServerCountryForCompany(companyId: string): Promise<string | null> {
  try {
    const db = await getRuntimeDb();
    const { rows } = await db.query<{ registration_country: string | null }>(
      `select registration_country from pierre_rt_companies where id = $1 limit 1`, [companyId]);
    return rows[0]?.registration_country ?? null;
  } catch { return null; }
}

/** Le VRAI plan CloneOS du tour (client-safe). Best-effort : null ne fait jamais échouer le tour. */
export async function buildCloneOsTurn(params: {
  message: string; instruction: string; companyId: string; userId: string; nowIso: string; correlationId: string;
}): Promise<CloneOsTurnSummary | null> {
  try {
    const legalCountry = await resolveServerCountryForCompany(params.companyId);
    const plan: CloneOsPlan = orchestrate({
      company_id: params.companyId, user_id: params.userId, legalCountry,
      mode: "normal", instruction: params.instruction,
      employees: [{ id: "pierre", name: "Pierre", capabilities: ["hr", "document", "review"], countrySupport: "all" }],
      nowIso: params.nowIso, correlationId: params.correlationId,
    });
    return {
      version: "cloneos-turn-1",
      legalCountry,
      actions: plan.actions.length,
      tasks: plan.tasks.map((t) => ({ action: t.action, decision: t.governance.decision, autonomyGranted: t.governance.autonomyGranted, jurisdictional: t.jurisdictional })),
      requiresValidation: plan.requiresValidation,
      blocked: plan.blocked,
      traceEventCount: plan.traceEvents.length,
      executed: false,
    };
  } catch { return null; }
}
