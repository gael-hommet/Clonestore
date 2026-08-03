// src/lib/clonechat/mission/intake.ts
//
// Recueil DÉTERMINISTE d'une demande de mission : classification du type, collecte des entrées
// RÉELLEMENT nécessaires (jamais plus), détection des manquants, puis Readiness Gate → contrat de
// mission au bon statut. Ne recueille aucun secret. Redige la demande originale. Temps INJECTÉ.

import { redactText } from "@/lib/clonechat/care";
import { truthVersionHash } from "@/lib/clonechat/product-truth/types";
import { getRouteEntry } from "@/lib/nav/route-registry";
import type { CloneChatContext } from "@/lib/clonechat/context";
import type { CloneChatDiagnosis } from "@/lib/clonechat/diagnosis";
import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import { evaluateReadiness } from "./readiness";
import {
  CLONECHAT_MISSION_VERSION, type MissionContract, type MissionType, type MissionInputKey,
  type MissionAssumption, type MissionStatus,
} from "./types";

export const DEFAULT_MISSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function norm(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(new RegExp("[̀-ͯ]", "g"), "").replace(/\s+/g, " ").trim();
}

// ── Classification déterministe ────────────────────────────────────────────────
// NB : stems SANS \b final (un \b après « licenci » empêcherait « licenciement »/« licencier »).
const RE_MUTATION = /\b(envoie|envoyez|signe|signez|licenci|rompre|rupture|recrut|embauch|verse|supprime|modifie|mets?\s+a\s+jour|mets?\s+en\s+place|execute|lance|declenche)/;
const RE_SENSITIVE = /\b(licenci|rupture\s+conventionnelle|inaptitude|harcelement|disciplinaire|contentieux|prud|discrimination|sanction|faute\s+grave)/;
const RE_DOC = /\b(avenant|contrat|attestation|courrier|bulletin|fiche\s+de\s+paie|document|lettre)\b/;
const RE_PREP = /\b(prepare|preparer|organise|organiser|planifie|monte|construis|cadre)\b/;
const RE_ANALYSIS = /\b(analyse|analyser|compare|comparer|evalue|evaluer|audit|verifie|controle|calcule)\b/;
const RE_ADVICE = /\b(conseil|recommand|que\s+faire|comment\s+(gerer|traiter|proceder)|est-?ce\s+que\s+je\s+peux|dois-?je)\b/;
const RE_INFORMATIVE = /^(c'?est\s+quoi|qu'?est-?ce|combien|quel|quelle|quels|quelles|quand|ou\b|explique|quelles?\s+regles?|quel\s+delai)/;
const RE_UNSUPPORTED_AGENT = /\b(alex|clara|emma|noah)\b/; // autres employés IA non pris en charge par ce flux Pierre

function classifyMissionType(message: string): MissionType {
  const m = norm(message);
  if (m.length < 4) return "ambiguous";
  const words = m.split(" ").filter((w) => w.length > 2);
  if (RE_UNSUPPORTED_AGENT.test(m) && !/\bpierre\b/.test(m)) return "unsupported";
  if (RE_SENSITIVE.test(m)) return "sensitive";
  if (RE_MUTATION.test(m)) return "business_action";
  if (RE_DOC.test(m) && (RE_PREP.test(m) || RE_DOC.test(m))) return "document_draft";
  if (RE_PREP.test(m)) return "preparation";
  if (RE_ANALYSIS.test(m)) return "analysis";
  if (RE_INFORMATIVE.test(m)) return "informative";
  if (RE_ADVICE.test(m)) return "advice";
  if (words.length < 3) return "ambiguous";
  return "informative";
}

const REQUIRED_BY_TYPE: Record<MissionType, readonly MissionInputKey[]> = {
  informative: ["objective"],
  advice: ["objective"],
  analysis: ["objective", "expected_result"],
  preparation: ["objective", "expected_result"],
  document_draft: ["objective", "expected_result"],
  business_action: ["objective", "expected_result", "company", "agent"],
  sensitive: ["objective"],
  unsupported: [],
  ambiguous: [],
  human_review: ["objective"],
};

export interface MissionIntakeInput {
  readonly message: string;
  readonly context: CloneChatContext;
  readonly diagnosis?: CloneChatDiagnosis | null;
  readonly securityRefusal?: boolean;
  readonly providedInputs?: Readonly<Partial<Record<MissionInputKey, string>>>;
  readonly inspectedAttachmentIds?: readonly string[];
  readonly inspectorAssumptions?: readonly MissionAssumption[]; // observations inferred/unknown (jamais des faits)
  readonly nowMs: number;
  readonly ttlMs?: number;
  readonly idSeed?: string;
}

function collectInputs(input: MissionIntakeInput): Partial<Record<MissionInputKey, string>> {
  const ctx = input.context;
  const out: Partial<Record<MissionInputKey, string>> = { ...(input.providedInputs ?? {}) };
  const objective = redactText(input.message ?? "").trim();
  if (objective && !out.objective) out.objective = objective.slice(0, 300);
  if (!out.agent && /\bpierre\b/i.test(input.message ?? "")) out.agent = "pierre";
  if (!out.company && ctx.tenant.resolved) out.company = "current"; // jamais le companyId brut : référence scopée
  return out;
}

/** Recueille et construit le contrat de mission au bon statut (jamais exécuté). */
export function intakeMission(input: MissionIntakeInput): MissionContract {
  const ctx = input.context;
  const viewerKey = ctx.viewer.authenticated && ctx.viewer.userId ? `user:${ctx.viewer.userId}` : "anon";
  const tenantKey = ctx.tenant.resolved && ctx.tenant.companyId ? `co:${ctx.tenant.companyId}` : "none";
  const securityRefusal = input.securityRefusal === true || input.diagnosis?.kind === "permission_denied";

  const type = classifyMissionType(input.message);
  const validatedInputs = collectInputs(input);
  const required = REQUIRED_BY_TYPE[type];
  const missingInputs = required.filter((k) => !validatedInputs[k]);

  const readiness = evaluateReadiness({ type, missingInputs, context: ctx, securityRefusal });

  // Prérequis / permissions réels.
  const prerequisites: CloneChatPrerequisite[] = [...ctx.missingPrerequisites];
  const requiredPermissions: CloneChatPrerequisite[] = type === "business_action" ? ["authentication", "active_company", "pierre_entitlement"] : [];

  // Risques (jamais inventés au-delà du type).
  const risks: string[] = [];
  if (type === "sensitive") risks.push("sujet RH sensible : validation humaine et cadre légal requis");
  if (type === "business_action") risks.push("effet potentiel sur des données réelles : exécution jamais automatique");

  // Capacité RÉELLE : une action métier n'a pas d'adaptateur d'exécution disponible (prepare_pierre_mission indisponible).
  const capabilityAvailable = type !== "business_action" && type !== "unsupported";
  const limitation = type === "business_action"
    ? "Exécution runtime indisponible (prepare_pierre_mission non disponible) : paquet préparatoire uniquement, jamais exécuté."
    : type === "unsupported" ? "Demande non supportée par CloneChat." : null;

  // Hypothèses : les observations inferred/unknown de l'inspecteur restent des HYPOTHÈSES, jamais des faits.
  const assumptions: MissionAssumption[] = [...(input.inspectorAssumptions ?? [])];

  const objectiveNorm = validatedInputs.objective ?? null;
  const fingerprintMaterial = [type, objectiveNorm ?? "", viewerKey, tenantKey, validatedInputs.agent ?? "", CLONECHAT_MISSION_VERSION].join("|");
  const fingerprint = `mf_${truthVersionHash(fingerprintMaterial)}`;
  const idempotencyKey = `mission_${fingerprint}`;
  const missionId = `${input.idSeed ?? "m"}_${fingerprint}`;

  const status: MissionStatus = readiness.status;
  const recommendedRoute = getRouteEntry(input.diagnosis?.recommendedRoute ?? "") ? input.diagnosis!.recommendedRoute : (getRouteEntry("/agents/pierre/use") ? "/agents/pierre/use" : null);

  return Object.freeze({
    version: CLONECHAT_MISSION_VERSION,
    missionId, type, status,
    normalizedObjective: objectiveNorm,
    originalRequestRedacted: redactText(input.message ?? "").slice(0, 500),
    tenantKey, viewerKey,
    requestedAgent: validatedInputs.agent ?? null,
    validatedInputs: Object.freeze(validatedInputs),
    missingInputs: Object.freeze(missingInputs),
    inspectedAttachments: Object.freeze([...(input.inspectedAttachmentIds ?? [])]),
    assumptions: Object.freeze(assumptions),
    risks: Object.freeze(risks),
    requiredPermissions: Object.freeze(requiredPermissions),
    requiresConfirmation: readiness.requiresConfirmation,
    prerequisites: Object.freeze(prerequisites),
    capabilityAvailable,
    limitation,
    proposedPlan: Object.freeze([]), // rempli par prepareMissionPackage uniquement si autorisé
    expectedDeliverable: null,
    successCriteria: Object.freeze([]),
    recommendedRoute,
    escalation: readiness.requiresHumanReview ? "Revue humaine requise (sujet sensible)." : securityRefusal ? "Demande refusée par la gouvernance." : null,
    provenance: `mission-intake ${CLONECHAT_MISSION_VERSION} ; readiness=${readiness.decision} ; type=${type}`,
    idempotencyKey,
    fingerprint,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
    expiresAtMs: input.nowMs + (input.ttlMs ?? DEFAULT_MISSION_TTL_MS),
  });
}

export { classifyMissionType, REQUIRED_BY_TYPE };
