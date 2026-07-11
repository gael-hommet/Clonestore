// src/lib/clonechat/intelligence/c1-1/parrain-pierre-delegation.ts
// C1.1 — Délégation Pierre : CloneChat ne devient JAMAIS un second cerveau RH.
// Pour un travail RH exécutable : aucune planification RH indépendante ici — l'instruction
// autorisée part vers le contrat d'intelligence EXISTANT de Pierre (pipeline P9.4.2 :
// proposition persistée → confirmation humaine → exécution serveur exactly-once).
// L'état autoritaire est RE-LU côté serveur ; l'achèvement n'est jamais fabriqué.

import { retrieveCapabilities } from "./parrain-pierre-index";
import type { ParrainViewerContext } from "./parrain-types";

export const PIERRE_REQUEST_KINDS = ["explanation", "account_lookup", "support", "hr_work", "hr_decision_human_only"] as const;
export type PierreRequestKind = (typeof PIERRE_REQUEST_KINDS)[number];

export interface ParrainPierreDelegationResult {
  readonly delegated: boolean;
  readonly requestKind: PierreRequestKind;
  readonly pierreRequestId: string | null;
  readonly missionId: string | null;
  readonly status: "proposed" | "clarification" | "blocked" | "not_delegated" | "status_read";
  readonly clarification: string | null;
  readonly validationRequired: boolean;
  readonly proposedActions: readonly { readonly proposalId: string; readonly kind: string; readonly label: string }[];
  readonly authoritativeSource: string;
  readonly executed: false; // la délégation ne peut JAMAIS déclarer une exécution
  readonly blockedReason: string | null;
  readonly citations: readonly string[];
  readonly nextStep: string;
}

/** Port vers le pipeline gouverné EXISTANT (proposal-builder + V1 loopback, read-only). */
export interface PierreDelegationPort {
  /** Construit et PERSISTE une proposition via le pipeline P9.4.2 réel (idempotent). */
  proposeMission(input: {
    readonly instruction: string;
    readonly companyId: string;
    readonly userId: string;
    readonly conversationId: string | null;
    readonly at: string;
  }): Promise<{ readonly proposalId: string; readonly kind: string; readonly label: string } | null>;
  /** Relit l'état AUTORITAIRE d'une mission (serveur, tenant-scopé). */
  readMissionStatus(companyId: string, missionId: string): Promise<{ readonly missionId: string; readonly status: string } | null>;
}

// ── Classification conversationnelle (jamais un plan RH) ─────────────────────
const HR_WORK_RX = /pr[ée]pare|cr[ée]e|r[ée]dige|lance|organise|planifie|g[ée]n[èe]re|fais\s|met(s)?\s+en\s+place|continue\s+la\s+mission|corrige|relance|envoie une relance|analyse .* (puis|et) cr[ée]e/i;
const LOOKUP_RX = /o[ùu] en est|statut de|montre|liste|combien de missions|quelles validations|voir (mes|les)|pourquoi (cette|la) mission est bloqu[ée]e/i;
const SUPPORT_RX = /bug|marche pas|ne fonctionne|erreur|probl[èe]me|plante|cass[ée]/i;
const HUMAN_ONLY_DECISION_RX = /d[ée]cide (de |du |le )?licenci|valide (le|la) sanction|prononce (une|la) sanction|licencie[- ]?(le|la)|signe (l['e]|le) (avenant|contrat) pour moi|d[ée]cide seul/i;

export function classifyPierreRequest(question: string): PierreRequestKind {
  if (HUMAN_ONLY_DECISION_RX.test(question)) return "hr_decision_human_only";
  if (SUPPORT_RX.test(question)) return "support";
  if (LOOKUP_RX.test(question)) return "account_lookup";
  if (HR_WORK_RX.test(question)) {
    // Confirmation par le canon : un travail RH plausible touche au moins une capacité.
    const caps = retrieveCapabilities(question, { limit: 3 });
    if (caps.some((c) => c.humanOnly && /d[ée]cide|sanction|licenci/.test(question.toLowerCase()))) return "hr_decision_human_only";
    return "hr_work";
  }
  return "explanation";
}

const NOT_DELEGATED = (kind: PierreRequestKind, nextStep: string): ParrainPierreDelegationResult =>
  Object.freeze({
    delegated: false,
    requestKind: kind,
    pierreRequestId: null,
    missionId: null,
    status: "not_delegated" as const,
    clarification: null,
    validationRequired: false,
    proposedActions: [],
    authoritativeSource: "none",
    executed: false as const,
    blockedReason: null,
    citations: [],
    nextStep,
  });

/**
 * Délégation réelle : SEUL le kind hr_work part vers Pierre. Les décisions sensibles
 * finales restent humaines (blocked + explication). Une instruction trop vague reçoit
 * UNE clarification. Jamais d'achèvement fabriqué : executed=false, l'exécution ne
 * passe que par la confirmation existante (/api/assistant/execute).
 */
export async function delegateToPierre(
  port: PierreDelegationPort,
  viewer: ParrainViewerContext,
  question: string,
  conversationId: string | null,
  at: string,
): Promise<ParrainPierreDelegationResult> {
  const kind = classifyPierreRequest(question);

  if (kind === "explanation") return NOT_DELEGATED(kind, "Répondre depuis la connaissance canonique.");
  if (kind === "account_lookup") return NOT_DELEGATED(kind, "Lire le contexte de compte borné (lecture seule).");
  if (kind === "support") return NOT_DELEGATED(kind, "Traiter via le runtime support.");

  if (kind === "hr_decision_human_only") {
    return Object.freeze({
      ...NOT_DELEGATED(kind, "Expliquer la préparation possible — la décision finale reste humaine."),
      status: "blocked" as const,
      blockedReason:
        "Décision sensible finale (disciplinaire/salariale/signature) : plancher dur — Pierre prépare le dossier, l'humain décide. Jamais automatisé.",
      validationRequired: true,
    });
  }

  // hr_work — délégation réelle via le contrat existant.
  if (viewer.mode === "public" || !viewer.companyId || !viewer.userId) {
    return Object.freeze({
      ...NOT_DELEGATED(kind, "Inviter à se connecter pour que Pierre travaille sur l'entreprise."),
      status: "blocked" as const,
      blockedReason: "Le travail RH exige une entreprise authentifiée (résolue côté serveur).",
    });
  }
  if (question.trim().length < 12) {
    return Object.freeze({
      ...NOT_DELEGATED(kind, "Obtenir la précision manquante puis déléguer."),
      status: "clarification" as const,
      clarification: "Pouvez-vous préciser pour quel salarié / quel document / quelle échéance ?",
      validationRequired: true,
    });
  }
  try {
    const proposal = await port.proposeMission({
      instruction: question,
      companyId: viewer.companyId,
      userId: viewer.userId,
      conversationId,
      at,
    });
    if (!proposal) {
      return Object.freeze({
        ...NOT_DELEGATED(kind, "Reformuler la demande — la proposition n'a pas pu être construite."),
        status: "clarification" as const,
        clarification: "Je n'ai pas pu transformer cette demande en mission sûre. Pouvez-vous préciser l'objectif (document, salarié, échéance) ?",
        validationRequired: true,
      });
    }
    return Object.freeze({
      delegated: true,
      requestKind: kind,
      pierreRequestId: proposal.proposalId,
      missionId: null, // la mission n'existe qu'APRÈS confirmation humaine + exécution serveur
      status: "proposed" as const,
      clarification: null,
      validationRequired: true,
      proposedActions: [{ proposalId: proposal.proposalId, kind: proposal.kind, label: proposal.label }],
      authoritativeSource: "proposition persistée serveur (pipeline P9.4.2 — confirmation humaine requise)",
      executed: false as const,
      blockedReason: null,
      citations: [],
      nextStep: "Confirmer la proposition pour que Pierre exécute sous gouvernance (idempotent, exactly-once).",
    });
  } catch {
    return Object.freeze({
      ...NOT_DELEGATED(kind, "Réessayer — le contrat Pierre n'a pas répondu."),
      status: "blocked" as const,
      blockedReason: "Le contrat Pierre est momentanément indisponible — rien n'a été créé.",
    });
  }
}

/** Relecture d'état autoritaire (jamais de complétion fabriquée). */
export async function readAuthoritativeMissionStatus(
  port: PierreDelegationPort,
  viewer: ParrainViewerContext,
  missionId: string,
): Promise<ParrainPierreDelegationResult> {
  if (!viewer.companyId) {
    return Object.freeze({ ...NOT_DELEGATED("account_lookup", "Se connecter."), status: "blocked" as const, blockedReason: "Entreprise requise." });
  }
  const state = await port.readMissionStatus(viewer.companyId, missionId).catch(() => null);
  return Object.freeze({
    delegated: false,
    requestKind: "account_lookup" as const,
    pierreRequestId: null,
    missionId: state?.missionId ?? null,
    status: "status_read" as const,
    clarification: state ? null : "Mission introuvable dans votre entreprise.",
    validationRequired: false,
    proposedActions: [],
    authoritativeSource: state ? "état V1 relu côté serveur" : "aucune donnée",
    executed: false as const,
    blockedReason: null,
    citations: [],
    nextStep: state ? `Statut réel : ${state.status}.` : "Vérifier l'identifiant de mission.",
  });
}
