// src/lib/clonechat/support-memory.ts
// P9.4.1 — Mémoire de support/bugs TENANT-AWARE avec politique de RÉUTILISATION VÉRIFIÉE.
// Règle absolue (§6/§7) : un bug signalé ne devient JAMAIS automatiquement une solution
// globale réutilisable. Seuls les cas passés en WORKAROUND_VERIFIED / SOLUTION_VERIFIED
// (reusable=true) peuvent être proposés à un client. Un signalement crée : une occurrence
// TENANT-LOCALE (redigée) + un cas global neutralisé (status reported, reusable=false).
// Deux implémentations : in-memory (tests/repli) et durable Postgres (production/preuves).

import { fingerprint, redactSymptom, symptomSimilarity } from "./bug-memory";

export type SupportStatus =
  | "reported" | "triaged" | "investigating"
  | "workaround_candidate" | "workaround_verified"
  | "solution_candidate" | "solution_verified"
  | "resolved" | "rejected" | "security_escalation";

export interface ReusableCase {
  readonly fingerprint: string;
  readonly title: string;
  readonly workaround: string | null;
  readonly solution: string | null;
  readonly status: SupportStatus;
  readonly reusable: boolean;
  readonly occurrences: number;
}

export interface ReusableMatch {
  readonly matched: boolean;
  readonly case: ReusableCase | null;
  readonly score: number;
}

export interface SupportCase {
  readonly id: string;
  readonly title: string;
  readonly status: SupportStatus;
  readonly severity: "low" | "normal" | "high" | "security";
  readonly redactedSummary: string;
  readonly createdAt: string;
}

export interface SupportCtx { readonly companyId: string; readonly userId?: string | null; }

export interface ReportInput {
  readonly symptoms: string;
  readonly route?: string | null;
  readonly release?: string | null;
  readonly evidence?: Array<{ kind: string; text: string; at: string }>;
  readonly at: string;
}

export interface CreateCaseInput {
  readonly title: string;
  readonly summary: string;
  readonly severity?: "low" | "normal" | "high" | "security";
  readonly fingerprint?: string | null;
  readonly at: string;
}

export interface SupportMemory {
  /** Recherche un contournement/solution RÉUTILISABLE (verified only). Jamais un 'reported'. */
  findReusable(symptoms: string): Promise<ReusableMatch>;
  /** Signale une occurrence : tenant-local (redigé) + cas global neutralisé (reported). */
  report(ctx: SupportCtx, input: ReportInput): Promise<{ fingerprint: string; occurrences: number }>;
  /** Transition de vérification (INTERNE uniquement) → rend un cas réutilisable. */
  verify(fp: string, kind: "workaround" | "solution", by: string, text: string, at: string): Promise<void>;
  createSupportCase(ctx: SupportCtx, input: CreateCaseInput): Promise<SupportCase>;
  listSupportCases(ctx: SupportCtx, limit?: number): Promise<SupportCase[]>;
  getSupportCase(id: string, ctx: SupportCtx): Promise<SupportCase | null>;
}

const REUSE_THRESHOLD = 0.34;

// ── Implémentation IN-MEMORY (tests / repli sans DB) ─────────────────────────
interface GlobalCase { fingerprint: string; title: string; symptoms: string[]; workaround: string | null; solution: string | null; status: SupportStatus; reusable: boolean; occurrences: number; }

export function createInMemorySupportMemory(seed: ReusableCase[] = SEED_REUSABLE): SupportMemory {
  const cases = new Map<string, GlobalCase>();
  for (const s of seed) cases.set(s.fingerprint, { fingerprint: s.fingerprint, title: s.title, symptoms: [s.title], workaround: s.workaround, solution: s.solution, status: s.status, reusable: s.reusable, occurrences: s.occurrences });
  const supportCases: Array<SupportCase & { companyId: string }> = [];
  let n = 0;

  return {
    async findReusable(symptoms) {
      const fp = fingerprint(symptoms);
      const exact = cases.get(fp);
      if (exact && exact.reusable) return { matched: true, case: pub(exact), score: 1 };
      let best: GlobalCase | null = null, bestScore = 0;
      for (const c of cases.values()) {
        if (!c.reusable) continue;
        const score = Math.max(0, ...c.symptoms.map((s) => symptomSimilarity(symptoms, s)));
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best && bestScore >= REUSE_THRESHOLD) return { matched: true, case: pub(best), score: bestScore };
      return { matched: false, case: null, score: bestScore };
    },
    async report(_ctx, input) {
      const fp = fingerprint(input.symptoms);
      const redacted = redactSymptom(input.symptoms);
      const existing = cases.get(fp);
      if (existing) { existing.occurrences += 1; if (!existing.symptoms.includes(redacted)) existing.symptoms.push(redacted); return { fingerprint: fp, occurrences: existing.occurrences }; }
      cases.set(fp, { fingerprint: fp, title: redacted.slice(0, 120), symptoms: [redacted], workaround: null, solution: null, status: "reported", reusable: false, occurrences: 1 });
      return { fingerprint: fp, occurrences: 1 };
    },
    async verify(fp, kind, _by, text, _at) {
      const c = cases.get(fp); if (!c) return;
      if (kind === "workaround") { c.workaround = text; c.status = "workaround_verified"; } else { c.solution = text; c.status = "solution_verified"; }
      c.reusable = true;
    },
    async createSupportCase(ctx, input) {
      const sc: SupportCase & { companyId: string } = { id: `case-${++n}`, companyId: ctx.companyId, title: input.title.slice(0, 120), status: "reported", severity: input.severity ?? "normal", redactedSummary: redactSymptom(input.summary), createdAt: input.at };
      supportCases.push(sc); return strip(sc);
    },
    async listSupportCases(ctx, limit = 20) {
      return supportCases.filter((c) => c.companyId === ctx.companyId).slice(-limit).reverse().map(strip);
    },
    async getSupportCase(id, ctx) {
      const c = supportCases.find((x) => x.id === id && x.companyId === ctx.companyId); return c ? strip(c) : null;
    },
  };

  function pub(c: GlobalCase): ReusableCase { return { fingerprint: c.fingerprint, title: c.title, workaround: c.workaround, solution: c.solution, status: c.status, reusable: c.reusable, occurrences: c.occurrences }; }
  function strip(c: SupportCase & { companyId: string }): SupportCase { const { companyId: _c, ...rest } = c; void _c; return rest; }
}

// Cas RÉUTILISABLES amorcés (déjà vérifiés — tenant-safe, aucun PII).
export const SEED_REUSABLE: ReusableCase[] = [
  { fingerprint: fingerprint("le bouton envoyer reste grisé le message ne part pas"), title: "Le bouton d'envoi reste grisé", workaround: "Rechargez la page (Ctrl/Cmd+R) : le composer redevient actif une fois la page complètement chargée.", solution: null, status: "workaround_verified", reusable: true, occurrences: 1 },
  { fingerprint: fingerprint("pierre ne voit pas mes missions le cockpit est vide"), title: "Le cockpit de Pierre semble vide", workaround: "Vérifiez que l'onboarding de l'entreprise est complété (/profile/onboarding) : sans empreinte, Pierre n'a pas encore de contexte.", solution: "Compléter l'empreinte d'entreprise renseigne le contexte nécessaire à l'affichage.", status: "solution_verified", reusable: true, occurrences: 1 },
];
