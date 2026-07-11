// src/lib/clonechat/intelligence/c1-1/parrain-bug-learning.ts
// C1.1 — Mémoire de bugs étendue : portées global / account / route / feature /
// browser / device / release. Règles d'isolation dures : une résolution VALIDÉE globale
// est réutilisable partout ; une résolution de compte UNIQUEMENT dans ce compte ; un
// candidat n'est JAMAIS servi comme autoritaire ; le déprécié n'est plus retourné ;
// les détails sensibles sont rédigés AVANT toute promotion globale.

import { redactSymptom } from "../../bug-memory";
import { c1TokenSimilarity } from "../c1/clonechat-knowledge-types";
import { parrainHash } from "./parrain-types";

export const PARRAIN_BUG_SCOPES = ["global", "account", "route", "feature", "browser", "device", "release"] as const;
export type ParrainBugScope = (typeof PARRAIN_BUG_SCOPES)[number];

export type ParrainBugStatus = "candidate" | "validated" | "deprecated";

export interface ParrainKnownBug {
  readonly id: string;
  readonly title: string;
  readonly symptoms: readonly string[];
  readonly scope: ParrainBugScope;
  /** Obligatoire pour scope=account ; interdit ailleurs. */
  readonly accountId: string | null;
  readonly route: string | null;
  readonly feature: string | null;
  readonly browser: string | null;
  readonly device: string | null;
  readonly release: string | null;
  readonly workaround: string | null;
  readonly confirmedFix: string | null;
  readonly status: ParrainBugStatus;
  readonly severity: "low" | "medium" | "high" | "blocking";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BugQueryContext {
  readonly text: string;
  readonly companyId?: string | null;
  readonly route?: string | null;
  readonly browser?: string | null;
  readonly device?: string | null;
  readonly release?: string | null;
}

export interface ParrainBugStore {
  find(query: BugQueryContext): readonly { readonly bug: ParrainKnownBug; readonly score: number }[];
  report(input: Omit<ParrainKnownBug, "id" | "status" | "updatedAt"> & { readonly at: string }): ParrainKnownBug;
  validate(id: string, by: string, at: string): ParrainKnownBug | null;
  deprecate(id: string, by: string, at: string): ParrainKnownBug | null;
  /** Promotion compte→global : rédaction obligatoire, validation obligatoire. */
  promoteToGlobal(id: string, by: string, at: string): ParrainKnownBug | null;
  get(id: string): ParrainKnownBug | null;
  list(): readonly ParrainKnownBug[];
}

const MATCH_THRESHOLD = 0.28;

function visibleFor(bug: ParrainKnownBug, q: BugQueryContext): boolean {
  if (bug.status !== "validated") return false; // candidat/déprécié : jamais autoritaire
  if (bug.scope === "account") {
    return typeof q.companyId === "string" && q.companyId.length > 0 && bug.accountId === q.companyId;
  }
  if (bug.scope === "route" && bug.route && q.route && bug.route !== q.route) return false;
  if (bug.scope === "browser" && bug.browser && q.browser && !q.browser.toLowerCase().includes(bug.browser.toLowerCase())) return false;
  if (bug.scope === "device" && bug.device && q.device && !q.device.toLowerCase().includes(bug.device.toLowerCase())) return false;
  if (bug.scope === "release" && bug.release && q.release && bug.release !== q.release) return false;
  return true;
}

export function createParrainBugStore(seed: readonly ParrainKnownBug[] = []): ParrainBugStore {
  const bugs = new Map<string, ParrainKnownBug>(seed.map((b) => [b.id, b]));
  return {
    find(query) {
      const out: { bug: ParrainKnownBug; score: number }[] = [];
      for (const bug of bugs.values()) {
        if (!visibleFor(bug, query)) continue;
        const score =
          Math.max(...bug.symptoms.map((s) => c1TokenSimilarity(query.text, s)), c1TokenSimilarity(query.text, bug.title)) +
          (query.route && bug.route === query.route ? 0.2 : 0);
        if (score >= MATCH_THRESHOLD) out.push({ bug, score });
      }
      return out.sort((a, b) => b.score - a.score);
    },
    report(input) {
      const symptoms = input.symptoms.map((s) => redactSymptom(s));
      const id = `pkb_${parrainHash(symptoms.join("|") + (input.scope === "account" ? `@${input.accountId}` : ""))}`;
      const existing = bugs.get(id);
      if (existing) return existing;
      const bug: ParrainKnownBug = Object.freeze({
        ...input,
        id,
        title: redactSymptom(input.title),
        symptoms,
        accountId: input.scope === "account" ? input.accountId : null,
        status: "candidate",
        createdAt: input.at,
        updatedAt: input.at,
      });
      bugs.set(id, bug);
      return bug;
    },
    validate(id, by, at) {
      const bug = bugs.get(id);
      if (!bug || !by) return null;
      const next = Object.freeze({ ...bug, status: "validated" as const, updatedAt: at });
      bugs.set(id, next);
      return next;
    },
    deprecate(id, by, at) {
      const bug = bugs.get(id);
      if (!bug || !by) return null;
      const next = Object.freeze({ ...bug, status: "deprecated" as const, updatedAt: at });
      bugs.set(id, next);
      return next;
    },
    promoteToGlobal(id, by, at) {
      const bug = bugs.get(id);
      if (!bug || !by) return null;
      if (bug.status !== "validated") return null; // jamais de promotion d'un candidat
      const next: ParrainKnownBug = Object.freeze({
        ...bug,
        scope: "global",
        accountId: null,
        // Rédaction AVANT promotion globale — aucune donnée de compte ne fuit.
        title: redactSymptom(bug.title),
        symptoms: bug.symptoms.map((s) => redactSymptom(s)),
        workaround: bug.workaround ? redactSymptom(bug.workaround) : null,
        updatedAt: at,
      });
      bugs.set(id, next);
      return next;
    },
    get: (id) => bugs.get(id) ?? null,
    list: () => [...bugs.values()],
  };
}

/** Formulation honnête : un contournement n'est JAMAIS présenté comme un correctif. */
export function honestResolutionText(bug: ParrainKnownBug): string {
  if (bug.confirmedFix) return `Problème connu (« ${bug.title} ») — un correctif a été confirmé : ${bug.confirmedFix}`;
  if (bug.workaround) return `Problème connu (« ${bug.title} ») — contournement vérifié : ${bug.workaround} Le problème reste suivi ; ce n'est pas encore un correctif.`;
  return `Problème connu (« ${bug.title} ») — pas encore de contournement fiable : je ne vais pas en inventer un. Le signalement est tracé.`;
}
