// src/lib/clonestore/technologies/t1/technology-audit.ts
// T1 — Audit d'usage des technologies. CHAQUE usage est auditable — y compris en fallback,
// bloqué ou en erreur. Aucun provider externe : trace locale (EvidenceTech incarne le contrat ;
// les traces durables existantes — timeline V1, pierre_rt_ — restent la source en P16C).
// Les notes sont assainies : jamais de secret dans un audit.

import type { TechnologyContext, TechnologyId } from "./technology-types";
import { sanitizeTechnologyMessage, type TechnologyResult, type TechnologyResultKind } from "./technology-result";

export interface TechnologyAuditEntry {
  readonly id: string;
  readonly at: string; // ISO 8601
  readonly technologyId: TechnologyId;
  readonly employeeId: string;
  readonly companyId: string;
  readonly resultKind: TechnologyResultKind;
  readonly requiresHumanValidation: boolean;
  /** INVARIANT T1 : aucun usage audité n'est live. */
  readonly live: false;
  readonly fallbackUsed: boolean;
  readonly note: string;
}

let auditSequence = 0;

/** Crée une entrée d'audit depuis un résultat — fonctionne pour TOUS les kinds (ok→error). Pur (hors horloge/compteur). */
export function createTechnologyAuditEntry<T>(
  result: TechnologyResult<T>,
  ctx?: Partial<TechnologyContext> | null,
  note?: string,
): TechnologyAuditEntry {
  auditSequence += 1;
  const parts = [
    note,
    result.fallbackNote ? `fallback: ${result.fallbackNote}` : undefined,
    result.blockedReason ? `bloqué: ${result.blockedReason}` : undefined,
    result.errorMessage ? `erreur: ${result.errorMessage}` : undefined,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  return {
    id: `t1-audit-${auditSequence}`,
    at: new Date().toISOString(),
    technologyId: result.technologyId,
    employeeId: result.employeeId || (ctx?.employeeId ?? "").trim(),
    companyId: result.companyId || (ctx?.companyId ?? "").trim(),
    resultKind: result.kind,
    requiresHumanValidation: result.requiresHumanValidation,
    live: false,
    fallbackUsed: result.kind === "fallback" || result.fallbackNote !== undefined,
    note: sanitizeTechnologyMessage(parts.join(" | ") || `usage ${result.technologyId} (${result.kind})`),
  };
}

// ── Journal d'audit en mémoire (le bus enregistre chaque usage) ────────────────

export interface TechnologyAuditLog {
  record(entry: TechnologyAuditEntry): void;
  list(): readonly TechnologyAuditEntry[];
  listByTechnology(technologyId: TechnologyId): readonly TechnologyAuditEntry[];
  count(): number;
}

export function createTechnologyAuditLog(): TechnologyAuditLog {
  const entries: TechnologyAuditEntry[] = [];
  return {
    record(entry) { entries.push(entry); },
    list() { return [...entries]; },
    listByTechnology(technologyId) { return entries.filter((e) => e.technologyId === technologyId); },
    count() { return entries.length; },
  };
}
