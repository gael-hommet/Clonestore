// src/lib/clonechat/actions/adapters.ts
//
// Adaptateurs d'EXÉCUTION — uniquement des effets SÛRS et non destructifs. Aucun n'exécute de
// mutation métier (Pierre/RH/paiement/signature) : ces actions ne sont pas dans le registre ou sont
// déclarées non disponibles. Un adaptateur ne prétend JAMAIS un succès sans preuve OBSERVABLE.
// Le modèle ne peut pas inventer d'adaptateur : seuls les ids enregistrés ici sont appelables.

import { getRouteEntry } from "@/lib/nav/route-registry";
import { buildTicketDraft, submitTicket, type SupportTicketProvider, type SupportTicketDraft, type TicketDeduper } from "@/lib/clonechat/care";
import type { StructuredActionError } from "./types";

export interface AdapterCancelSignal {
  cancelled: boolean;
}

export interface AdapterDeps {
  /** Provider support abstrait (pour submit_ticket). Absent ⇒ adaptateur indisponible. */
  readonly supportProvider?: SupportTicketProvider;
  /** Deduper d'idempotence de tickets (anti-double soumission). */
  readonly ticketDeduper?: TicketDeduper;
  /** La confirmation explicite a-t-elle été validée par CloneGuard ? (submit_ticket) */
  readonly confirmed?: boolean;
  readonly cancelSignal?: AdapterCancelSignal;
}

export interface AdapterOutcome {
  readonly status: "succeeded" | "failed" | "cancelled";
  readonly observable: string | null; // condition observable RÉELLEMENT satisfaite
  readonly output: Readonly<Record<string, unknown>> | null;
  readonly error: StructuredActionError | null;
}

export type ActionAdapter = (args: Readonly<Record<string, unknown>>, deps: AdapterDeps) => Promise<AdapterOutcome>;

function fail(code: string, message: string): AdapterOutcome {
  return { status: "failed", observable: null, output: null, error: { code, message } };
}
function cancelled(): AdapterOutcome {
  return { status: "cancelled", observable: null, output: null, error: null };
}
function isCancelled(deps: AdapterDeps): boolean {
  return deps.cancelSignal?.cancelled === true;
}

const ADAPTERS: Readonly<Record<string, ActionAdapter>> = {
  // Navigation : la route a déjà été validée réelle par CloneGuard ; on la RE-vérifie (défense).
  navigate: async (args) => {
    const route = String(args.route ?? "");
    if (!getRouteEntry(route)) return fail("ROUTE_NOT_FOUND", "Route inexistante.");
    return { status: "succeeded", observable: `Navigation préparée vers une route réelle : ${route}`, output: { route, navigate: true }, error: null };
  },

  recommend_route: async (args) => {
    const route = String(args.route ?? "");
    const entry = getRouteEntry(route);
    if (!entry) return fail("ROUTE_NOT_FOUND", "Route inexistante.");
    return { status: "succeeded", observable: `Route réelle recommandée : ${route}`, output: { route, label: entry.label }, error: null };
  },

  // Préparation d'un brouillon de ticket (aucun envoi). Preuve observable : clé d'idempotence présente.
  prepare_ticket: async (args) => {
    const draft = buildTicketDraft({
      summary: String(args.summary ?? "Demande de support"),
      category: (typeof args.category === "string" ? args.category : "other") as SupportTicketDraft["category"],
      priority: (typeof args.priority === "string" ? args.priority : "normal") as SupportTicketDraft["priority"],
      affectedRoute: typeof args.affectedRoute === "string" && getRouteEntry(args.affectedRoute) ? (args.affectedRoute as string) : null,
      errorCodes: Array.isArray(args.errorCodes) ? (args.errorCodes as string[]) : [],
      attemptedSteps: Array.isArray(args.attemptedSteps) ? (args.attemptedSteps as string[]) : [],
      expectedResult: String(args.expectedResult ?? "La demande aboutit."),
      observedResult: String(args.observedResult ?? "Blocage rencontré."),
      evidence: Array.isArray(args.evidence) ? (args.evidence as string[]) : [],
      tenantRef: null,
    });
    return { status: "succeeded", observable: `Brouillon de ticket préparé (idempotencyKey=${draft.idempotencyKey}).`, output: { draft }, error: null };
  },

  // Soumission d'un ticket via provider abstrait — UNIQUEMENT après confirmation (garantie par Guard).
  submit_ticket: async (args, deps) => {
    if (!deps.supportProvider) return fail("ADAPTER_UNAVAILABLE", "Aucun provider support disponible.");
    if (isCancelled(deps)) return cancelled(); // annulation pendant l'exécution (avant l'effet)
    const draft = args.ticket as SupportTicketDraft;
    const outcome = await submitTicket(deps.supportProvider, draft, { confirmed: deps.confirmed === true, deduper: deps.ticketDeduper });
    if (!outcome.ok) {
      if (outcome.error === "duplicate") return { status: "failed", observable: null, output: { duplicate: true }, error: { code: "DUPLICATE", message: "Ticket déjà soumis." } };
      if (outcome.error === "provider_unavailable") return fail("PROVIDER_UNAVAILABLE", "Le provider support est indisponible.");
      if (outcome.error === "not_confirmed") return fail("CONFIRMATION_REQUIRED", "Confirmation requise avant soumission.");
      return fail("PROVIDER_ERROR", "La soumission du ticket a échoué.");
    }
    // Jamais de faux succès : sans identifiant de ticket réel, on ne déclare PAS un succès.
    if (!outcome.ticketId) return fail("NO_OBSERVABLE_RESULT", "Le provider n'a retourné aucun identifiant de ticket.");
    return { status: "succeeded", observable: `Ticket soumis, identifiant retourné : ${outcome.ticketId}`, output: { ticketId: outcome.ticketId }, error: null };
  },

  // Préparation d'une reprise contrôlée (non destructive).
  prepare_retry: async (args) => {
    const stage = typeof args.stage === "string" ? (args.stage as string) : "last_failed_step";
    return { status: "succeeded", observable: `Plan de reprise préparé (étape : ${stage}).`, output: { retry: true, stage }, error: null };
  },

  // Préparation d'une demande gouvernée POUR VALIDATION HUMAINE FUTURE — AUCUN effet métier.
  prepare_only: async (args) => {
    const summary = String(args.summary ?? "");
    return {
      status: "succeeded",
      observable: "Descripteur de demande préparé pour validation humaine future (aucune exécution).",
      output: { prepared: true, requiresHumanValidation: true, summary },
      error: null,
    };
  },

  // Adaptateur des actions déclarées NON DISPONIBLES — ne s'exécute jamais réellement.
  unavailable: async () => fail("ACTION_UNAVAILABLE", "Cette action n'est pas disponible."),
};

export function hasAdapter(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, id);
}

export function getAdapter(id: string): ActionAdapter | null {
  return hasAdapter(id) ? ADAPTERS[id] : null;
}

/** Disponibilité RUNTIME d'un adaptateur (dépend des deps injectées). */
export function adapterAvailable(id: string, deps: AdapterDeps): boolean {
  if (id === "unavailable") return false;
  if (id === "submit_ticket") return !!deps.supportProvider;
  return hasAdapter(id);
}
