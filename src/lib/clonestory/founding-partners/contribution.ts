// CloneStory — Le Cercle des Partenaires Fondateurs
// contribution.ts — Machine d'état STRICTE du cycle de vie d'une contribution
// (introduction → … → vérifiée), + dérivation des statistiques depuis les
// événements append-only. Aucun chiffre n'est jamais saisi par le partenaire.

import type {
  ContributionEvent,
  ContributionEventType,
  ContributionStatus,
  Introduction,
  PartnerStats,
} from "./types";
import { EMPTY_PARTNER_STATS, TERMINAL_CONTRIBUTION_STATUSES } from "./types";

/** Erreur typée pour toute transition de contribution interdite. */
export class ContributionTransitionError extends Error {
  constructor(
    public readonly from: ContributionStatus,
    public readonly to: ContributionStatus,
    public readonly reason: string,
  ) {
    super(`Transition contribution interdite : ${from} → ${to} (${reason})`);
    this.name = "ContributionTransitionError";
  }
}

/**
 * Progression nominale (l'ordre du parcours produit). Chaque état ne peut avancer
 * que vers l'état suivant de la chaîne — pas de saut, pas de retour en arrière.
 * `canceled` / `disputed` / `expired` sont des branches latérales.
 */
const FORWARD_ORDER: ContributionStatus[] = [
  "declared",
  "prospect_confirmed",
  "prospect_registered",
  "company_created",
  "purchase_captured",
  "activation_completed",
  "validation_pending",
  "verified",
];

const FORWARD_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  FORWARD_ORDER.map((s, i) => [s, i]),
);

/**
 * Depuis tout état NON terminal, on peut :
 *  - avancer d'EXACTEMENT un cran dans FORWARD_ORDER ;
 *  - basculer en `canceled` (remboursement/annulation) tant qu'on n'est pas terminal ;
 *  - basculer en `disputed` (litige → validation manuelle) ;
 *  - basculer en `expired` tant que l'achat n'a pas été capturé.
 * Depuis `disputed`, un opérateur peut résoudre vers `verified` ou `canceled`.
 */
export function isContributionTransitionListed(
  from: ContributionStatus,
  to: ContributionStatus,
): boolean {
  if (from === to) return false;
  if (TERMINAL_CONTRIBUTION_STATUSES.has(from)) return false;

  if (from === "disputed") {
    return to === "verified" || to === "canceled";
  }

  // Branches latérales depuis un état nominal non terminal.
  if (to === "canceled") return true;
  if (to === "disputed") return true;
  if (to === "expired") {
    // expirable seulement avant capture de l'achat
    const i = FORWARD_INDEX[from];
    return i !== undefined && i < FORWARD_INDEX["purchase_captured"];
  }

  // Avancée nominale d'un seul cran.
  const fi = FORWARD_INDEX[from];
  const ti = FORWARD_INDEX[to];
  if (fi === undefined || ti === undefined) return false;
  return ti === fi + 1;
}

export interface ContributionTransitionContext {
  /**
   * La transition vers `verified` exige une preuve serveur (achat encaissé +
   * activation), donc un `evidenceRef` non nul (id d'événement Stripe / Phase E,
   * ou id d'audit pour une validation manuelle).
   */
  readonly evidenceRef?: string | null;
  /** Délai de validation écoulé (requis pour validation_pending → verified). */
  readonly validationDelayElapsed?: boolean;
}

/** Valide une transition de contribution. Lève `ContributionTransitionError` sinon. */
export function assertContributionTransition(
  from: ContributionStatus,
  to: ContributionStatus,
  ctx: ContributionTransitionContext = {},
): void {
  if (!isContributionTransitionListed(from, to)) {
    throw new ContributionTransitionError(from, to, "transition non autorisée");
  }
  if (to === "verified") {
    if (!ctx.evidenceRef) {
      throw new ContributionTransitionError(from, to, "preuve vérifiable requise (evidenceRef)");
    }
    // depuis le flux nominal, la vérification suit un délai de validation écoulé
    if (from === "validation_pending" && ctx.validationDelayElapsed === false) {
      throw new ContributionTransitionError(from, to, "délai de validation non écoulé");
    }
  }
}

export function nextContributionStatus(
  from: ContributionStatus,
  to: ContributionStatus,
  ctx: ContributionTransitionContext = {},
): ContributionStatus | null {
  try {
    assertContributionTransition(from, to, ctx);
    return to;
  } catch {
    return null;
  }
}

/** Une introduction compte-t-elle comme « en cours » (ni vérifiée ni terminée) ? */
export function isInProgress(status: ContributionStatus): boolean {
  return !TERMINAL_CONTRIBUTION_STATUSES.has(status) && status !== "verified";
}

// ── Dérivation des statistiques depuis les ÉVÉNEMENTS ─────────────────────────
// `directIntroductions` = introductions dont le partenaire est l'auteur direct.
// `networkVerifiedCount` = nombre de contributions vérifiées de la sous-branche
// (descendants), fourni par l'appelant qui connaît le graphe (voir attribution.ts).
//
// IMPORTANT : on ne fait JAMAIS confiance à un compteur fourni par le partenaire.
// On recompte tout à partir des introductions et de leur statut courant, lui-même
// piloté par la machine d'état ci-dessus à partir des événements append-only.

export function derivePartnerStats(input: {
  directIntroductions: readonly Pick<Introduction, "status">[];
  networkVerifiedCount?: number;
}): PartnerStats {
  const stats = { ...EMPTY_PARTNER_STATS } as {
    -readonly [K in keyof PartnerStats]: PartnerStats[K];
  };

  for (const intro of input.directIntroductions) {
    const s = intro.status;
    if (isInProgress(s)) stats.introductionsInProgress += 1;

    // Jalons cumulatifs : un état avancé implique les précédents franchis
    // (sauf branches latérales canceled/disputed/expired).
    const i = FORWARD_INDEX[s];
    if (i !== undefined) {
      if (i >= FORWARD_INDEX["prospect_registered"]) stats.prospectsRegistered += 1;
      if (i >= FORWARD_INDEX["purchase_captured"]) stats.customersWithPurchase += 1;
      if (s === "verified") stats.verifiedDirect += 1;
    }
    if (s === "canceled") stats.canceled += 1;
  }

  stats.verifiedNetwork = Math.max(0, input.networkVerifiedCount ?? 0);
  return stats;
}

// ── VALIDATION STRICTE D'UNE CONTRIBUTION ────────────────────────────────────
// Une contribution ne devient JAMAIS `verified` parce qu'un seul événement
// `contribution_verified` existe. La vérification exige une CHAÎNE DE PREUVES
// cohérente et ordonnée. Tout événement manquant, hors ordre, dupliqué, sans
// preuve, avant le délai, ou postérieur à une annulation → état litigieux
// (`disputed`), jamais `verified`.

/** Jalons requis, dans l'ordre, pour aboutir à une contribution vérifiée. */
export const VERIFICATION_CHAIN: readonly ContributionEventType[] = [
  "introduction_declared",
  "introduction_confirmed",
  "prospect_registered",
  "company_created",
  "purchase_captured",
  "activation_completed",
  "contribution_verified",
];

/** Jalons de progression nominale (hors événement de vérification finale). */
const PROGRESS_CHAIN: readonly ContributionEventType[] = [
  "introduction_declared",
  "introduction_confirmed",
  "prospect_registered",
  "company_created",
  "purchase_captured",
  "activation_completed",
];

/** Statut nominal atteint pour chaque jalon de PROGRESS_CHAIN. */
const PROGRESS_STATUS: readonly ContributionStatus[] = [
  "declared",
  "prospect_confirmed",
  "prospect_registered",
  "company_created",
  "purchase_captured",
  "validation_pending", // activation terminée → le délai de validation court
];

/** Événements qui DOIVENT porter une preuve serveur (`evidenceRef` non nul). */
const EVIDENCE_REQUIRED: ReadonlySet<ContributionEventType> = new Set<ContributionEventType>([
  "purchase_captured",
  "activation_completed",
  "contribution_verified",
  "manual_validation",
]);

/** Délai de validation par défaut : 7 jours (le verified doit suivre l'activation d'au moins ce délai). */
export const DEFAULT_VALIDATION_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export const CONTRIBUTION_REASON_CODES = [
  "OK",
  "MISSING_EVENT",
  "OUT_OF_ORDER",
  "DUPLICATE_EVENT",
  "DUPLICATE_EVIDENCE",
  "MISSING_EVIDENCE",
  "DELAY_NOT_ELAPSED",
  "CANCELED",
  "VERIFY_AFTER_CANCEL",
  "DISPUTED_UNRESOLVED",
] as const;
export type ContributionReasonCode = (typeof CONTRIBUTION_REASON_CODES)[number];

export interface ContributionAnalysisContext {
  /** Délai exigé entre activation et vérification. Défaut : 7 jours. */
  validationDelayMs?: number;
  /** Empreintes de preuve déjà consommées par d'AUTRES contributions (anti-rejeu Stripe). */
  consumedEvidenceRefs?: ReadonlySet<string>;
}

export interface ContributionAnalysis {
  readonly status: ContributionStatus;
  readonly verified: boolean;
  readonly disputed: boolean;
  readonly reasonCodes: ContributionReasonCode[];
}

/**
 * Analyse complète d'une contribution à partir de ses événements append-only.
 * C'est la SEULE manière d'obtenir `verified`. Renvoie le statut + les raisons.
 */
export function analyzeContribution(
  events: readonly ContributionEvent[],
  ctx: ContributionAnalysisContext = {},
): ContributionAnalysis {
  const delay = ctx.validationDelayMs ?? DEFAULT_VALIDATION_DELAY_MS;
  const reasons = new Set<ContributionReasonCode>();

  // Tri chronologique stable (timestamp, puis ordre d'insertion).
  const sorted = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const t = a.e.occurredAt.localeCompare(b.e.occurredAt);
      return t !== 0 ? t : a.i - b.i;
    })
    .map((x) => x.e);

  // Comptage par type.
  const counts = new Map<ContributionEventType, number>();
  for (const ev of sorted) counts.set(ev.type, (counts.get(ev.type) ?? 0) + 1);

  // Doublons de jalons de la chaîne (ex. deux purchase_captured).
  for (const t of VERIFICATION_CHAIN) {
    if ((counts.get(t) ?? 0) > 1) reasons.add("DUPLICATE_EVENT");
  }

  // Preuve manquante sur un événement présent qui en exige une.
  for (const ev of sorted) {
    if (EVIDENCE_REQUIRED.has(ev.type) && !ev.evidenceRef) reasons.add("MISSING_EVIDENCE");
  }

  // Empreintes de preuve dupliquées (intra-contribution + vs déjà consommées ailleurs).
  const seenEvidence = new Set<string>(ctx.consumedEvidenceRefs ?? []);
  for (const ev of sorted) {
    if (!ev.evidenceRef) continue;
    if (seenEvidence.has(ev.evidenceRef)) reasons.add("DUPLICATE_EVIDENCE");
    else seenEvidence.add(ev.evidenceRef);
  }

  // Ordre : la suite chronologique des jalons présents doit être une
  // sous-séquence ordonnée de la chaîne canonique.
  const presentChainSeq = sorted.map((e) => e.type).filter((t) => VERIFICATION_CHAIN.includes(t));
  if (!isOrderedSubsequence(presentChainSeq, VERIFICATION_CHAIN)) reasons.add("OUT_OF_ORDER");

  // Branches latérales.
  const cancelIdx = sorted.findIndex((e) => e.type === "contribution_canceled");
  const verifyIdx = sorted.findIndex((e) => e.type === "contribution_verified");
  const disputeIdx = sorted.findIndex((e) => e.type === "contribution_disputed");
  const hasVerify = verifyIdx !== -1;
  const hasDispute = disputeIdx !== -1;
  // Résolution manuelle autorisée = manual_validation AVEC preuve, postérieur au litige.
  const hasManualResolution = sorted.some(
    (e, i) => e.type === "manual_validation" && !!e.evidenceRef && (!hasDispute || i > disputeIdx),
  );

  // Annulation : terminal — sauf tentative de vérification postérieure (anomalie).
  if (cancelIdx !== -1) {
    if (hasVerify && verifyIdx > cancelIdx) {
      reasons.add("VERIFY_AFTER_CANCEL");
      return finalize("disputed", reasons);
    }
    return finalize("canceled", new Set<ContributionReasonCode>(["CANCELED"]));
  }

  if (hasVerify) {
    // Chaîne complète obligatoire.
    for (const t of VERIFICATION_CHAIN) if ((counts.get(t) ?? 0) < 1) reasons.add("MISSING_EVENT");
    // Délai écoulé entre activation et vérification.
    const act = lastOf(sorted, "activation_completed");
    const ver = lastOf(sorted, "contribution_verified");
    if (act && ver) {
      const gap = Date.parse(ver.occurredAt) - Date.parse(act.occurredAt);
      if (!(gap >= delay)) reasons.add("DELAY_NOT_ELAPSED");
    }
    // Litige : la vérification n'est légitime qu'après une validation manuelle autorisée.
    if (hasDispute && !hasManualResolution) reasons.add("DISPUTED_UNRESOLVED");

    if (reasons.size === 0) return { status: "verified", verified: true, disputed: false, reasonCodes: ["OK"] };
    return finalize("disputed", reasons);
  }

  // Pas de revendication de vérification.
  if (hasDispute && !hasManualResolution) {
    reasons.add("DISPUTED_UNRESOLVED");
    return finalize("disputed", reasons);
  }

  // Progression nominale : dernier jalon CONTIGU atteint (un trou = jalon manquant).
  const prog = nominalProgress(counts);
  if (prog.gap) reasons.add("MISSING_EVENT");
  if (reasons.size > 0) return finalize("disputed", reasons);
  return { status: prog.status, verified: false, disputed: false, reasonCodes: ["OK"] };
}

/**
 * Reconstruit le statut courant d'une introduction à partir de ses événements
 * append-only. Délègue à `analyzeContribution` : `verified` n'est renvoyé que si
 * la chaîne de preuves complète est satisfaite ; toute anomalie donne `disputed`.
 */
export function deriveContributionStatus(
  events: readonly ContributionEvent[],
  ctx: ContributionAnalysisContext = {},
): ContributionStatus {
  return analyzeContribution(events, ctx).status;
}

/** True si une chaîne d'événements satisfait STRICTEMENT la vérification. */
export function isContributionVerified(
  events: readonly ContributionEvent[],
  ctx: ContributionAnalysisContext = {},
): boolean {
  return analyzeContribution(events, ctx).verified;
}

function finalize(status: ContributionStatus, reasons: Set<ContributionReasonCode>): ContributionAnalysis {
  const codes = [...reasons];
  return {
    status,
    verified: status === "verified",
    disputed: status === "disputed",
    reasonCodes: codes.length ? codes : ["OK"],
  };
}

function lastOf(events: readonly ContributionEvent[], type: ContributionEventType): ContributionEvent | null {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === type) return events[i];
  return null;
}

/**
 * Une suite est-elle une sous-séquence ORDONNÉE de `full` (chaque élément trouvé
 * strictement après le précédent) ? Détecte les éléments hors ordre.
 */
function isOrderedSubsequence(
  seq: readonly ContributionEventType[],
  full: readonly ContributionEventType[],
): boolean {
  let p = 0;
  for (const t of seq) {
    let found = -1;
    for (let j = p; j < full.length; j++) {
      if (full[j] === t) {
        found = j;
        break;
      }
    }
    if (found === -1) return false;
    p = found + 1;
  }
  return true;
}

/** Progression nominale (avant vérification) : dernier jalon contigu + drapeau de trou. */
function nominalProgress(counts: Map<ContributionEventType, number>): { status: ContributionStatus; gap: boolean } {
  let maxIdx = -1;
  for (let i = 0; i < PROGRESS_CHAIN.length; i++) {
    if ((counts.get(PROGRESS_CHAIN[i]) ?? 0) >= 1) maxIdx = i;
  }
  if (maxIdx === -1) return { status: "declared", gap: false };
  for (let i = 0; i <= maxIdx; i++) {
    if ((counts.get(PROGRESS_CHAIN[i]) ?? 0) < 1) return { status: "declared", gap: true };
  }
  return { status: PROGRESS_STATUS[maxIdx], gap: false };
}
