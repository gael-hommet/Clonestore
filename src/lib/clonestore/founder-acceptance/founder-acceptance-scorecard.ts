// src/lib/clonestore/founder-acceptance/founder-acceptance-scorecard.ts
// P13 §7 — SCORECARD d'acceptation fondateur. Pur, déterministe. Note 12 dimensions de 0 à 3
// (0 échec / 1 partiel / 2 pass / 3 excellent), max 36. Applique les règles d'acceptation ET les
// bloqueurs DURS (framing assistant / 2e cerveau RH / overclaim légal-pays / production / faux provider).

export type ScoreValue = 0 | 1 | 2 | 3;

export type ScorecardDimId =
  | "os_feeling"
  | "employee_ia_feeling"
  | "pierre_hr_credibility"
  | "cloneos_command_simplicity"
  | "cloneroom_salon_clarity"
  | "global_cockpit_command_clarity"
  | "pierre_cockpit_hr_clarity"
  | "mon_clonestore_distinction"
  | "no_scroll_usability"
  | "mobile_usability"
  | "country_launch_credibility"
  | "honest_limitation_disclosure";

export interface ScorecardDimension { readonly id: ScorecardDimId; readonly n: number; readonly title: string }

export const SCORECARD_DIMENSIONS: readonly ScorecardDimension[] = [
  { id: "os_feeling", n: 1, title: "Ressenti « OS » (pas un SaaS)" },
  { id: "employee_ia_feeling", n: 2, title: "Ressenti « employé IA acheté »" },
  { id: "pierre_hr_credibility", n: 3, title: "Crédibilité RH de Pierre" },
  { id: "cloneos_command_simplicity", n: 4, title: "Simplicité de commande CloneOS" },
  { id: "cloneroom_salon_clarity", n: 5, title: "Clarté du salon CloneRoom" },
  { id: "global_cockpit_command_clarity", n: 6, title: "Clarté de commande Global Cockpit" },
  { id: "pierre_cockpit_hr_clarity", n: 7, title: "Clarté RH du Pierre Cockpit" },
  { id: "mon_clonestore_distinction", n: 8, title: "Distinction Mon CloneStore (admin ≠ travail)" },
  { id: "no_scroll_usability", n: 9, title: "Utilisabilité sans scroll (console)" },
  { id: "mobile_usability", n: 10, title: "Utilisabilité mobile" },
  { id: "country_launch_credibility", n: 11, title: "Crédibilité pays de lancement" },
  { id: "honest_limitation_disclosure", n: 12, title: "Divulgation honnête des limites" },
];

export const SCORECARD_MAX = 36; // 12 × 3
export const SCORECARD_ACCEPT_THRESHOLD = 30;

export type ScorecardVerdict = "ACCEPTED" | "FOUNDER_REVIEW_REQUIRED" | "BLOCKED";

export interface ScorecardBlockers {
  readonly assistantFraming?: boolean;      // Pierre présenté en assistant/chatbot/copilote
  readonly secondHrBrain?: boolean;         // logique RH réimplémentée hors V1
  readonly legalCountryOverclaim?: boolean; // conformité légale/pays finale revendiquée
  readonly fakeProviderLive?: boolean;      // faux « provider live » (Yousign/Stripe)
  readonly productionEnabled?: boolean;     // PRODUCTION_AUTHORIZED true
  readonly countryUnsupportedOrMispriced?: boolean; // pays non supporté / mal tarifé
}

export interface ScorecardInput {
  readonly scores: Partial<Record<ScorecardDimId, ScoreValue>>;
  readonly blockers?: ScorecardBlockers;
}

export interface ScorecardResult {
  readonly total: number;
  readonly max: number;
  readonly perDimension: ReadonlyArray<{ id: ScorecardDimId; title: string; score: ScoreValue }>;
  readonly weakPillars: ScorecardDimId[];   // dimensions ≤ 1
  readonly hardBlockers: string[];          // bloqueurs DURS déclenchés
  readonly accepted: boolean;
  readonly founderReviewRequired: boolean;
  readonly blocked: boolean;
  readonly verdict: ScorecardVerdict;
  readonly note: string;
}

const BLOCKER_LABELS: Record<keyof ScorecardBlockers, string> = {
  assistantFraming: "Pierre cadré en assistant/chatbot/copilote — BLOQUÉ.",
  secondHrBrain: "Deuxième cerveau RH (logique RH hors runtime V1) — BLOQUÉ.",
  legalCountryOverclaim: "Surpromesse de conformité légale/pays finale — BLOQUÉ.",
  fakeProviderLive: "Fausse revendication provider live (Yousign/Stripe) — BLOQUÉ.",
  productionEnabled: "Production activée (PRODUCTION_AUTHORIZED true) — BLOQUÉ.",
  countryUnsupportedOrMispriced: "Pays non supporté / mal tarifé — BLOQUÉ.",
};

/**
 * Évalue le scorecard. RÈGLES :
 *   • tout bloqueur DUR → BLOCKED (peu importe le total).
 *   • sinon, ACCEPTED ssi total ≥ 30 ET aucune dimension ≤ 1.
 *   • sinon → FOUNDER_REVIEW_REQUIRED.
 * Pur, déterministe.
 */
export function evaluateFounderScorecard(input: ScorecardInput): ScorecardResult {
  const perDimension = SCORECARD_DIMENSIONS.map((d) => ({
    id: d.id, title: d.title, score: (input.scores[d.id] ?? 0) as ScoreValue,
  }));
  const total = perDimension.reduce((s, d) => s + d.score, 0);
  const weakPillars = perDimension.filter((d) => d.score <= 1).map((d) => d.id);

  const b = input.blockers ?? {};
  const hardBlockers: string[] = [];
  for (const [k, v] of Object.entries(b)) if (v === true && BLOCKER_LABELS[k as keyof ScorecardBlockers]) hardBlockers.push(BLOCKER_LABELS[k as keyof ScorecardBlockers]);

  const blocked = hardBlockers.length > 0;
  const meetsThreshold = total >= SCORECARD_ACCEPT_THRESHOLD;
  const noWeakPillar = weakPillars.length === 0;
  const accepted = !blocked && meetsThreshold && noWeakPillar;
  const founderReviewRequired = !blocked && !accepted;

  const verdict: ScorecardVerdict = blocked ? "BLOCKED" : accepted ? "ACCEPTED" : "FOUNDER_REVIEW_REQUIRED";

  const note = blocked
    ? `BLOQUÉ par ${hardBlockers.length} bloqueur(s) dur(s) — acceptation impossible tant qu'ils ne sont pas levés.`
    : accepted
      ? `ACCEPTÉ : ${total}/${SCORECARD_MAX} (≥ ${SCORECARD_ACCEPT_THRESHOLD}) et aucune dimension faible.`
      : `REVUE FONDATEUR REQUISE : total ${total}/${SCORECARD_MAX}${noWeakPillar ? "" : `, dimensions faibles : ${weakPillars.join(", ")}`}.`;

  return { total, max: SCORECARD_MAX, perDimension, weakPillars, hardBlockers, accepted, founderReviewRequired, blocked, verdict, note };
}

/** Le scorecard est-il complet ? (12 dimensions, ids uniques, max 36). Pur. */
export function scorecardComplete(): boolean {
  const ids = new Set(SCORECARD_DIMENSIONS.map((d) => d.id));
  return SCORECARD_DIMENSIONS.length === 12 && ids.size === 12 && SCORECARD_MAX === 36;
}
