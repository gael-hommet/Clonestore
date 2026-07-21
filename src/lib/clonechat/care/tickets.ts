// src/lib/clonechat/care/tickets.ts
// C1.8 §12 — ESCALADE ET TICKETS.
//
// Savoir s'arrêter fait partie du support. Un ticket est un BROUILLON tant que l'utilisateur n'a
// pas explicitement demandé son envoi — et ce qu'il contient est RÉDIGÉ de façon déterministe :
// pas de vidage brut de la conversation, pas de salaire, pas de secret, pas de donnée médicale.

import { redactSensitive, type CloneChatDiagnosis } from "./contracts";
import { HUMAN_REQUIRED_INTENTS, type SupportIntent } from "./diagnosis";

export type TicketCategory =
  | "account" | "billing" | "access" | "ui_bug" | "technical_bug" | "mission_blocked"
  | "email" | "document" | "setup" | "product_question" | "security" | "privacy"
  | "commercial" | "other";

export type TicketPriority = "low" | "normal" | "high" | "critical";
export type TicketStatus = "draft" | "ready_for_submission" | "submitted" | "acknowledged" | "resolved" | "closed";

export interface CloneChatSupportTicket {
  readonly id: string;
  readonly user_id: string | null;
  readonly company_id: string | null;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly route: string | null;
  readonly page_id: string | null;
  readonly employee_slug: string | null;
  readonly related_mission_id: string | null;
  readonly related_task_id: string | null;
  readonly redacted_summary: string;
  readonly diagnosis_attempted: readonly string[];
  readonly known_issue_matches: readonly string[];
  readonly actions_attempted: readonly string[];
  readonly error_codes: readonly string[];
  readonly screenshot_reference: string | null;
  readonly confidence: string;
  readonly expected_human_action: string;
  readonly status: TicketStatus;
}

/** Catégories qui EXIGENT un humain — la liste est appliquée, pas seulement documentée. */
export const ESCALATION_CATEGORIES: ReadonlySet<TicketCategory> = new Set<TicketCategory>([
  "security", "privacy",
]);

/** Un sujet exige-t-il un humain ? (sécurité, vie privée, litige, incertitude grave) */
export function requiresHuman(input: {
  intent: SupportIntent;
  diagnosis: CloneChatDiagnosis | null;
  repeatedFailures?: number;
}): { required: boolean; reason: string | null } {
  if (HUMAN_REQUIRED_INTENTS.has(input.intent)) {
    return { required: true, reason: "Sujet sécurité, vie privée ou demande explicite d'un humain." };
  }
  if (input.diagnosis?.escalation_required) {
    return { required: true, reason: input.diagnosis.reason };
  }
  // Un support qui échoue en boucle doit passer la main : s'entêter serait le vrai échec.
  if ((input.repeatedFailures ?? 0) >= 2) {
    return { required: true, reason: "Plusieurs tentatives de résolution ont échoué : un humain doit reprendre." };
  }
  return { required: false, reason: null };
}

const CATEGORY_BY_AREA: Readonly<Record<string, TicketCategory>> = Object.freeze({
  account: "account", billing: "billing", employee_access: "access", setup: "setup",
  mission: "mission_blocked", email: "email", document: "document",
  ui: "ui_bug", technical: "technical_bug", security: "security", unknown: "other",
});

/**
 * Prépare un BROUILLON de ticket. Il n'est JAMAIS soumis ici : `status: "draft"`.
 * Le résumé est RÉDIGÉ (e-mails, IBAN, cartes, salaires, secrets masqués) et borné.
 */
export function draftTicket(input: {
  id: string;
  message: string;
  intent: SupportIntent;
  diagnosis: CloneChatDiagnosis | null;
  userId: string | null;
  companyId: string | null;
  route: string | null;
  pageId: string | null;
  knownIssueIds?: readonly string[];
  actionsAttempted?: readonly string[];
  errorCodes?: readonly string[];
  screenshotReference?: string | null;
}): CloneChatSupportTicket {
  const area = input.diagnosis?.area ?? "unknown";
  const category = CATEGORY_BY_AREA[area] ?? "other";

  const escalation = requiresHuman({ intent: input.intent, diagnosis: input.diagnosis });
  const priority: TicketPriority =
    category === "security" ? "critical"
    : category === "privacy" ? "high"
    : input.diagnosis?.status === "blocked" ? "normal"
    : "low";

  // RÉDACTION : jamais le fil brut, jamais une donnée sensible en clair.
  const summary = redactSensitive((input.message ?? "").trim()).slice(0, 500);

  return Object.freeze({
    id: input.id,
    user_id: input.userId,
    company_id: input.companyId,
    category,
    priority,
    route: input.route,
    page_id: input.pageId,
    employee_slug: null,
    related_mission_id: null,
    related_task_id: null,
    redacted_summary: summary,
    diagnosis_attempted: Object.freeze(input.diagnosis ? [`${input.diagnosis.area}: ${input.diagnosis.reason}`] : []),
    known_issue_matches: Object.freeze([...(input.knownIssueIds ?? [])]),
    actions_attempted: Object.freeze([...(input.actionsAttempted ?? [])]),
    error_codes: Object.freeze([...(input.errorCodes ?? [])]),
    screenshot_reference: input.screenshotReference ?? null,
    confidence: input.diagnosis?.confidence ?? "unknown",
    expected_human_action: escalation.reason ?? "Vérifier et répondre à l'utilisateur.",
    status: "draft", // ← BROUILLON. Rien n'est soumis sans geste explicite.
  });
}

/** Passage à l'envoi : uniquement sur geste EXPLICITE de l'utilisateur. */
export function markReadyForSubmission(t: CloneChatSupportTicket, userConfirmed: boolean): CloneChatSupportTicket {
  if (!userConfirmed) return t; // aucun envoi implicite, jamais
  return Object.freeze({ ...t, status: "ready_for_submission" as TicketStatus });
}

/** Déduplication : deux fois le même problème ⇒ un seul ticket. */
export function ticketFingerprint(t: CloneChatSupportTicket): string {
  return [t.category, t.company_id ?? "-", t.route ?? "-", t.known_issue_matches.join(",") || t.redacted_summary.slice(0, 60)].join("|");
}

export function isDuplicate(t: CloneChatSupportTicket, existing: readonly CloneChatSupportTicket[]): boolean {
  const fp = ticketFingerprint(t);
  return existing.some((e) => ticketFingerprint(e) === fp && e.status !== "closed" && e.status !== "resolved");
}
