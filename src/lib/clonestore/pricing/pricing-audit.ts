// src/lib/clonestore/pricing/pricing-audit.ts
// P10 §7 — TRACE D'AUDIT des décisions de tarification. Privacy-safe : JAMAIS d'IP brute
// stockée (hash tronqué salé, salt = CLONESTORE_IP_HASH_SALT existant). Sink par défaut = log
// serveur structuré (aucune table de prod appliquée ; une migration DRAFT non appliquée est
// fournie séparément si une persistance est autorisée par l'owner).

import { createHash, randomUUID } from "node:crypto";

export type PricingDecisionOutcome = "allowed" | "blocked" | "review_required" | "country_required";

export interface PricingAuditInput {
  readonly requestId?: string | null;
  readonly userId?: string | null;
  readonly anonSessionId?: string | null;
  readonly selectedCountry?: string | null;
  readonly resolvedCountry?: string | null;
  readonly geoCountry?: string | null;
  readonly companyCountry?: string | null;
  readonly billingCountry?: string | null;
  readonly taxCountry?: string | null;
  readonly requestedPriceKey?: string | null;
  readonly resolvedPriceKey?: string | null;
  readonly currency?: string | null;
  readonly decision: PricingDecisionOutcome;
  readonly reasonCode: string;
  readonly ip?: string | null;         // brut EN ENTRÉE uniquement → hashé, jamais conservé
  readonly at: string;                 // ISO (fourni par l'appelant : pas de Date.now() ici)
}

export interface PricingAuditRecord {
  readonly auditId: string;
  readonly at: string;
  readonly requestId: string | null;
  readonly userId: string | null;
  readonly anonSessionId: string | null;
  readonly selectedCountry: string | null;
  readonly resolvedCountry: string | null;
  readonly geoCountry: string | null;
  readonly companyCountry: string | null;
  readonly billingCountry: string | null;
  readonly taxCountry: string | null;
  readonly requestedPriceKey: string | null;
  readonly resolvedPriceKey: string | null;
  readonly currency: string | null;
  readonly decision: PricingDecisionOutcome;
  readonly reasonCode: string;
  readonly ipHash: string | null;      // sha256(salt+ip) tronqué — jamais l'IP brute
}

/** Hash tronqué et salé d'une IP (privacy-safe). Retourne null si pas d'IP ou pas de salt. */
export function hashIp(ip: string | null | undefined, salt: string | null | undefined): string | null {
  if (!ip || !salt) return null;
  const norm = ip.trim();
  if (!norm) return null;
  return "ip_" + createHash("sha256").update(`${salt}::${norm}`).digest("hex").slice(0, 20);
}

const nn = (v: string | null | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Construit un enregistrement d'audit privacy-safe (aucune IP brute conservée). */
export function buildPricingAuditRecord(input: PricingAuditInput, opts?: { salt?: string | null; auditId?: string }): PricingAuditRecord {
  const salt = opts?.salt ?? process.env.CLONESTORE_IP_HASH_SALT ?? null;
  return {
    auditId: opts?.auditId ?? `pa_${randomUUID()}`,
    at: input.at,
    requestId: nn(input.requestId),
    userId: nn(input.userId),
    anonSessionId: nn(input.anonSessionId),
    selectedCountry: nn(input.selectedCountry),
    resolvedCountry: nn(input.resolvedCountry),
    geoCountry: nn(input.geoCountry),
    companyCountry: nn(input.companyCountry),
    billingCountry: nn(input.billingCountry),
    taxCountry: nn(input.taxCountry),
    requestedPriceKey: nn(input.requestedPriceKey),
    resolvedPriceKey: nn(input.resolvedPriceKey),
    currency: nn(input.currency),
    decision: input.decision,
    reasonCode: input.reasonCode,
    ipHash: hashIp(input.ip, salt),
  };
}

export type PricingAuditSink = (record: PricingAuditRecord) => void;

/** Sink par défaut : log serveur structuré (une ligne JSON, préfixe stable pour le grep/collecte). */
export const consoleAuditSink: PricingAuditSink = (record) => {
  try { console.info("[p10-pricing-audit]", JSON.stringify(record)); } catch { /* ignore */ }
};

/**
 * Enregistre une décision de tarification. Retourne l'auditId. Ne throw jamais (best-effort :
 * l'audit ne doit pas casser un checkout). Sink par défaut = log serveur ; injectable pour tests.
 */
export function recordPricingDecision(input: PricingAuditInput, opts?: { salt?: string | null; sink?: PricingAuditSink; auditId?: string }): string {
  const record = buildPricingAuditRecord(input, { salt: opts?.salt, auditId: opts?.auditId });
  try { (opts?.sink ?? consoleAuditSink)(record); } catch { /* audit best-effort */ }
  return record.auditId;
}
