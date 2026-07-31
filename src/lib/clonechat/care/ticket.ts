// src/lib/clonechat/care/ticket.ts
//
// Modèle de ticket support + adaptateur CONTRÔLÉ. On PRÉPARE un brouillon sûr ; on ne l'envoie
// JAMAIS automatiquement. Redaction déterministe, déduplication, clé d'idempotence, interface
// provider abstraite + mock déterministe, réponse honnête si le provider est indisponible.

import { truthVersionHash } from "@/lib/clonechat/product-truth/types";
import { redactText, redactList, safeErrorCode } from "./redaction";
import {
  CLONECHAT_TICKET_VERSION, type SupportTicketDraft, type TicketCategory, type CarePriority,
} from "./types";

export interface TicketDraftInput {
  readonly summary: string;
  readonly category: TicketCategory;
  readonly priority: CarePriority;
  readonly affectedRoute: string | null;
  readonly errorCodes: readonly string[];
  readonly attemptedSteps: readonly string[];
  readonly expectedResult: string;
  readonly observedResult: string;
  readonly evidence: readonly string[];
  /** Identifiant tenant scopé, uniquement si autorisé ET nécessaire ; sinon null. */
  readonly tenantRef: string | null;
}

/** Construit un brouillon SÛR : tous les champs texte redigés, codes normalisés, clé idempotente. */
export function buildTicketDraft(input: TicketDraftInput): SupportTicketDraft {
  const summary = redactText(input.summary).slice(0, 200);
  const errorCodes = Array.from(new Set(input.errorCodes.map(safeErrorCode).filter((c) => c.length > 0)));
  const attemptedSteps = redactList(input.attemptedSteps).slice(0, 20);
  const evidence = redactList(input.evidence).slice(0, 20);
  const affectedRoute = input.affectedRoute;
  const tenantRef = input.tenantRef ? redactText(input.tenantRef).slice(0, 80) : null;

  // Clé d'idempotence DÉTERMINISTE : deux situations identiques → même clé (dédup / anti-répétition).
  const material = [
    input.category, input.priority, affectedRoute ?? "-", errorCodes.slice().sort().join(","),
    redactText(input.observedResult).slice(0, 120), tenantRef ?? "-",
  ].join("|");
  const idempotencyKey = `tkt-${truthVersionHash(material)}`;

  return Object.freeze({
    version: CLONECHAT_TICKET_VERSION,
    idempotencyKey,
    summary,
    category: input.category,
    priority: input.priority,
    affectedRoute,
    errorCodes: Object.freeze(errorCodes),
    attemptedSteps: Object.freeze(attemptedSteps),
    expectedResult: redactText(input.expectedResult).slice(0, 200),
    observedResult: redactText(input.observedResult).slice(0, 200),
    evidence: Object.freeze(evidence),
    tenantRef,
  });
}

/** Déduplique une liste de brouillons par clé d'idempotence (le premier gagne). */
export function dedupeTickets(drafts: readonly SupportTicketDraft[]): SupportTicketDraft[] {
  const seen = new Set<string>();
  const out: SupportTicketDraft[] = [];
  for (const d of drafts) {
    if (seen.has(d.idempotencyKey)) continue;
    seen.add(d.idempotencyKey);
    out.push(d);
  }
  return out;
}

/** Anti-répétition avec état : register renvoie true si la clé est NOUVELLE, false si déjà vue. */
export interface TicketDeduper {
  register(key: string): boolean;
  has(key: string): boolean;
}
export function createTicketDeduper(): TicketDeduper {
  const seen = new Set<string>();
  return {
    register(key: string): boolean {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    has(key: string): boolean {
      return seen.has(key);
    },
  };
}

// ── Provider support (jamais d'envoi automatique) ─────────────────────────────

export interface TicketSubmitOutcome {
  readonly ok: boolean;
  readonly ticketId: string | null;
  readonly error: "not_confirmed" | "provider_unavailable" | "duplicate" | "provider_error" | null;
}

export interface SupportTicketProvider {
  submit(draft: SupportTicketDraft): Promise<TicketSubmitOutcome>;
}

/** Mock déterministe : succès factice, jamais de réseau. */
export function mockSupportProvider(outcome?: Partial<TicketSubmitOutcome>): SupportTicketProvider {
  return {
    submit: async (draft) => ({ ok: true, ticketId: `mock-${draft.idempotencyKey}`, error: null, ...outcome }),
  };
}

/** Provider indisponible : réponse HONNÊTE, jamais un faux succès. */
export function unavailableSupportProvider(): SupportTicketProvider {
  return { submit: async () => ({ ok: false, ticketId: null, error: "provider_unavailable" }) };
}

/**
 * Soumission CONTRÔLÉE : refuse tant que `confirmed !== true` (aucun envoi automatique). Une clé
 * déjà soumise (deduper) → `duplicate` (idempotence). Sinon délègue au provider.
 */
export async function submitTicket(
  provider: SupportTicketProvider,
  draft: SupportTicketDraft,
  opts: { confirmed: boolean; deduper?: TicketDeduper },
): Promise<TicketSubmitOutcome> {
  if (opts.confirmed !== true) return { ok: false, ticketId: null, error: "not_confirmed" };
  if (opts.deduper && !opts.deduper.register(draft.idempotencyKey)) {
    return { ok: false, ticketId: null, error: "duplicate" };
  }
  try {
    return await provider.submit(draft);
  } catch {
    return { ok: false, ticketId: null, error: "provider_error" };
  }
}
