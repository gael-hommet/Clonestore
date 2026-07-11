// src/lib/pierre/v1/ultimate/p16a/continuity-intent.ts
// P16A — pure continuity INTENT classification (owner §11). It answers "which authoritative mission /
// artifact does this follow-up refer to, and is it a correction or a new mission?" over an INJECTED,
// tenant-scoped candidate list (the caller supplies recent missions/artifacts from the real repos — this
// module never touches the DB, so it cannot leak across tenants and is fully unit-testable). It NEVER
// resolves completion from chat text: `requiresAuthoritativeRead` tells the caller to re-read the durable
// state. The durable resume itself stays in the existing continuation controller (P16C wires it).

import type { P16AContinuity, ContinuityKind, ContinuityTargetKind } from "./types";
import type { PierreNextStep } from "../../cognitive-runtime/types";

export type ContinuityCandidate = {
  readonly id: string;
  readonly label: string;
  readonly updatedAtIso?: string | null;   // ISO string; lexicographic sort = chronological (no Date.now)
  readonly distinguisher?: string | null;
};
export type ContinuityContext = {
  readonly missions?: readonly ContinuityCandidate[];
  readonly artifacts?: readonly ContinuityCandidate[];
};

function strip(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type KindRule = { kind: ContinuityKind; re: RegExp; target: ContinuityTargetKind; isCorrection: boolean };
const KIND_RULES: readonly KindRule[] = [
  { kind: "status", re: /\b(qu'?est-ce qui bloque|qu'?est-ce qu'?il reste|reste[- ]t[- ]il|ou en est|point d'?avancement|statut)\b/, target: "mission", isCorrection: false },
  { kind: "cancel_last", re: /\b(annul|supprim).{0,20}(derniere|dernier|proposition|brouillon)\b/, target: "artifact", isCorrection: false },
  { kind: "use_latest", re: /\b(utilise|prend?s?|reprend?s?).{0,20}(derniere version|dernier|la version)|derniere version\b/, target: "artifact", isCorrection: true },
  { kind: "redo_part", re: /\b(refais|refaire|regenere|recree).{0,20}(seulement|uniquement|juste|le mail|l'?email|le document|la lettre|l'?avenant)\b/, target: "artifact", isCorrection: true },
  { kind: "change_field", re: /\b(change|modifie|corrige|remplace|mets? [àa] jour).{0,24}(la date|le nom|le montant|l'?adresse|le manager|le poste)\b/, target: "artifact", isCorrection: true },
  { kind: "correct", re: /\b(corrige|corriger|rectifie|refais).{0,12}(ca|cela|le document|le mail|l'?avenant|la lettre)?\b/, target: "artifact", isCorrection: true },
  { kind: "continue", re: /\b(continue|continuer|reprend?s?|reprendre|poursuis|fais le necessaire|fais la suite|termine la mission)\b/, target: "mission", isCorrection: false },
];

const LATEST_CUE = /\b(derniere|dernier|latest|la version)\b/;
// content nouns that let "refais le mail" find the mail artifact
const CONTENT_NOUNS: readonly string[] = ["mail", "email", "document", "lettre", "avenant", "contrat", "attestation", "note", "rapport", "convocation"];

function mostRecent(cands: readonly ContinuityCandidate[]): { pick: ContinuityCandidate | null; tie: boolean } {
  if (cands.length === 0) return { pick: null, tie: false };
  if (cands.length === 1) return { pick: cands[0], tie: false };
  const sorted = [...cands].sort((a, b) => (b.updatedAtIso ?? "").localeCompare(a.updatedAtIso ?? ""));
  const top = sorted[0].updatedAtIso ?? "";
  const tie = !top || sorted.filter((c) => (c.updatedAtIso ?? "") === top).length > 1;
  return { pick: sorted[0], tie };
}

function byContentNoun(text: string, cands: readonly ContinuityCandidate[]): ContinuityCandidate[] {
  const t = strip(text);
  const noun = CONTENT_NOUNS.find((n) => t.includes(n));
  if (!noun) return [];
  return cands.filter((c) => strip(c.label).includes(noun));
}

const NON_CONTINUATION: P16AContinuity = {
  isContinuation: false, kind: "none", isCorrection: false, targetKind: "none", targetId: null,
  ambiguousCandidates: [], requiresAuthoritativeRead: false, nextStep: "PREPARE_PLAN",
  reason: "no_continuity_cue",
};

/** Classify a follow-up utterance's continuity intent + resolve its authoritative target. Pure. */
export function classifyContinuityIntent(instruction: string, context: ContinuityContext = {}): P16AContinuity {
  const t = strip(instruction);
  const rule = KIND_RULES.find((r) => r.re.test(t));
  if (!rule) return NON_CONTINUATION;

  const missions = context.missions ?? [];
  const artifacts = context.artifacts ?? [];
  const pool = rule.target === "artifact" ? (artifacts.length > 0 ? artifacts : missions) : missions;
  const targetKind: ContinuityTargetKind = rule.target === "artifact" && artifacts.length === 0 && missions.length > 0 ? "mission" : rule.target;

  const asCand = (c: ContinuityCandidate) => ({ id: c.id, label: c.label, distinguisher: c.distinguisher ?? "" });

  // 0) No authoritative candidates at all → we still recognise the intent, but cannot resolve a target.
  if (pool.length === 0) {
    return {
      isContinuation: true, kind: rule.kind, isCorrection: rule.isCorrection, targetKind,
      targetId: null, ambiguousCandidates: [], requiresAuthoritativeRead: true,
      nextStep: "ASK_CLARIFICATION", reason: "no_authoritative_candidate",
    };
  }

  // 1) content-noun match ("refais le mail") narrows the artifact pool.
  const nounMatches = byContentNoun(instruction, pool);
  const candidatePool = nounMatches.length > 0 ? nounMatches : pool;

  // 2) explicit "latest/dernière" cue → resolve to the most recent (tie → ambiguous).
  const wantsLatest = LATEST_CUE.test(t) || rule.kind === "use_latest" || rule.kind === "cancel_last";
  if (wantsLatest) {
    const { pick, tie } = mostRecent(candidatePool);
    if (pick && !tie) {
      return {
        isContinuation: true, kind: rule.kind, isCorrection: rule.isCorrection, targetKind,
        targetId: pick.id, ambiguousCandidates: [], requiresAuthoritativeRead: true,
        nextStep: "RESUME_EXISTING_WORK", reason: "resolved_latest",
      };
    }
    return {
      isContinuation: true, kind: rule.kind, isCorrection: rule.isCorrection, targetKind,
      targetId: null, ambiguousCandidates: candidatePool.map(asCand), requiresAuthoritativeRead: true,
      nextStep: "ASK_CLARIFICATION", reason: "ambiguous_latest_tie",
    };
  }

  // 3) generic continuation ("continue", "corrige ça"): unique candidate → resolve; several → ambiguous.
  if (candidatePool.length === 1) {
    return {
      isContinuation: true, kind: rule.kind, isCorrection: rule.isCorrection, targetKind,
      targetId: candidatePool[0].id, ambiguousCandidates: [], requiresAuthoritativeRead: true,
      nextStep: "RESUME_EXISTING_WORK", reason: "resolved_unique",
    };
  }
  return {
    isContinuation: true, kind: rule.kind, isCorrection: rule.isCorrection, targetKind,
    targetId: null, ambiguousCandidates: candidatePool.map(asCand), requiresAuthoritativeRead: true,
    nextStep: "ASK_CLARIFICATION", reason: "ambiguous_multiple_candidates",
  };
}

export type { PierreNextStep };
