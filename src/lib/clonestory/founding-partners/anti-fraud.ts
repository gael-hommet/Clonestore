// CloneStory — Le Cercle des Partenaires Fondateurs
// anti-fraud.ts — Règles de protection anti-fraude (domaine pur, déterministe).
//
// Chaque évaluation retourne un VERDICT structuré (allow | review | reject) avec
// un code stable et une raison lisible. Les décisions sensibles doivent produire
// une trace exploitable côté serveur (append-only) — non implémenté ici (Bloc 2),
// mais le verdict expose `requiresTrace` pour câbler la trace.

import { normalizeEmailForCompare } from "./normalize";

export type FraudDecision = "allow" | "review" | "reject";

export const FRAUD_CODES = [
  "SELF_ATTRIBUTION",        // partenaire = prospect (auto-attribution / auto-parrainage)
  "DECLARED_AFTER_PURCHASE", // introduction déclarée après l'achat
  "DUPLICATE_COMPANY",       // même entreprise déjà attribuée
  "DUPLICATE_PAYMENT",       // même paiement réutilisé
  "DISPOSABLE_DOMAIN",       // domaine email jetable
  "SUSPICIOUS_EMAIL",        // email frauduleux / role-based douteux
  "MULTI_ACCOUNT",           // comptes multiples suspectés
  "COLLUSION",               // collusion entre utilisateurs (même IP/appareil/branche close)
  "BRANCH_FRAUD",            // anomalie de branche
  "POST_VERIFICATION_EDIT",  // modification après vérification
  "CROSS_TENANT_ACCESS",     // tentative d'accès inter-tenant
  "OK",
] as const;
export type FraudCode = (typeof FRAUD_CODES)[number];

export interface FraudVerdict {
  readonly decision: FraudDecision;
  readonly code: FraudCode;
  readonly reason: string;
  /** Une décision sensible exige une trace append-only côté serveur. */
  readonly requiresTrace: boolean;
}

const ALLOW: FraudVerdict = { decision: "allow", code: "OK", reason: "Aucune anomalie détectée", requiresTrace: false };

function reject(code: FraudCode, reason: string): FraudVerdict {
  return { decision: "reject", code, reason, requiresTrace: true };
}
function review(code: FraudCode, reason: string): FraudVerdict {
  return { decision: "review", code, reason, requiresTrace: true };
}

/** Domaines jetables connus (liste de base, extensible côté serveur). */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com",
  "tempmail.com", "temp-mail.org", "trashmail.com", "getnada.com",
  "throwawaymail.com", "fakeinbox.com", "sharklasers.com", "maildrop.cc",
]);

/** Préfixes role-based génériques (review, jamais bloquant seul). */
const ROLE_BASED_PREFIXES = new Set([
  "admin", "contact", "info", "sales", "support", "billing", "noreply", "no-reply",
  "hello", "team", "office", "webmaster", "postmaster",
]);

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : "";
}
function localPartOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(0, at).toLowerCase().trim() : email.toLowerCase().trim();
}

// ── Règle 1 : auto-attribution / auto-parrainage ─────────────────────────────
/**
 * Le partenaire ne peut pas s'attribuer lui-même : si l'email du prospect
 * correspond à l'email du partenaire (comparaison normalisée), c'est un rejet.
 */
export function checkSelfAttribution(input: {
  partnerEmail: string;
  prospectEmail: string;
}): FraudVerdict {
  const a = normalizeEmailForCompare(input.partnerEmail);
  const b = normalizeEmailForCompare(input.prospectEmail);
  if (a && a === b) {
    return reject("SELF_ATTRIBUTION", "Le prospect ne peut pas être le partenaire lui-même");
  }
  return ALLOW;
}

// ── Règle 2 : introduction déclarée APRÈS l'achat ────────────────────────────
/**
 * Une recommandation n'est valable que si elle PRÉCÈDE l'achat. Si l'introduction
 * a été déclarée après le paiement, elle est rejetée (anti « réclamation a posteriori »).
 * Tolérance optionnelle (graceMs) pour de petites dérives d'horloge ; 0 par défaut.
 */
export function checkDeclaredBeforePurchase(input: {
  declaredAt: string | Date;
  purchaseAt: string | Date | null;
  graceMs?: number;
}): FraudVerdict {
  if (!input.purchaseAt) return ALLOW; // pas encore d'achat → rien à comparer
  const declared = toMs(input.declaredAt);
  const purchase = toMs(input.purchaseAt);
  if (declared === null || purchase === null) {
    return review("DECLARED_AFTER_PURCHASE", "Horodatage manquant ou invalide — revue requise");
  }
  const grace = Math.max(0, input.graceMs ?? 0);
  if (declared > purchase + grace) {
    return reject("DECLARED_AFTER_PURCHASE", "Introduction déclarée après l'achat — attribution refusée");
  }
  return ALLOW;
}

// ── Règle 3 : entreprise déjà attribuée ──────────────────────────────────────
/**
 * Une même entreprise (identifiée par un fingerprint stable, sans PII) ne peut
 * être attribuée qu'une seule fois. Si le fingerprint est déjà crédité à une
 * autre introduction, on rejette le doublon (dédup).
 */
export function checkDuplicateCompany(input: {
  companyFingerprint: string;
  alreadyAttributedFingerprints: ReadonlySet<string>;
}): FraudVerdict {
  if (input.companyFingerprint && input.alreadyAttributedFingerprints.has(input.companyFingerprint)) {
    return reject("DUPLICATE_COMPANY", "Cette entreprise est déjà attribuée à une autre contribution");
  }
  return ALLOW;
}

// ── Règle 4 : même paiement réutilisé ────────────────────────────────────────
export function checkDuplicatePayment(input: {
  stripeEventId: string | null;
  consumedStripeEventIds: ReadonlySet<string>;
}): FraudVerdict {
  if (input.stripeEventId && input.consumedStripeEventIds.has(input.stripeEventId)) {
    return reject("DUPLICATE_PAYMENT", "Cet événement de paiement a déjà servi à une contribution");
  }
  return ALLOW;
}

// ── Règle 5 : domaine email ──────────────────────────────────────────────────
/**
 * Domaine jetable → rejet (entreprise inexistante probable). Email role-based →
 * revue (jamais bloquant seul, car certaines PME utilisent contact@). Gmail et
 * consorts ne sont JAMAIS bloqués.
 */
export function checkEmailDomain(email: string): FraudVerdict {
  const domain = domainOf(email);
  if (!domain) return review("SUSPICIOUS_EMAIL", "Email sans domaine exploitable");
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return reject("DISPOSABLE_DOMAIN", `Domaine jetable refusé : ${domain}`);
  }
  if (ROLE_BASED_PREFIXES.has(localPartOf(email))) {
    return review("SUSPICIOUS_EMAIL", "Adresse générique (role-based) — revue recommandée");
  }
  return ALLOW;
}

// ── Règle 6 : comptes multiples / collusion ──────────────────────────────────
/**
 * Signaux faibles agrégés : même IP hachée, même empreinte d'appareil, ou
 * partenaire et prospect dans une branche close. Aucun de ces signaux n'est
 * bloquant seul → verdict de REVUE (jamais de rejet automatique sur signal faible).
 */
export function checkCollusionSignals(input: {
  sameHashedIp?: boolean;
  sameDeviceFingerprint?: boolean;
  sameBranch?: boolean;
}): FraudVerdict {
  const signals = [input.sameHashedIp, input.sameDeviceFingerprint, input.sameBranch].filter(Boolean).length;
  if (signals >= 2) {
    return review("COLLUSION", "Plusieurs signaux de collusion détectés — validation manuelle requise");
  }
  if (signals === 1) {
    return review("MULTI_ACCOUNT", "Signal de compte multiple — surveillance recommandée");
  }
  return ALLOW;
}

// ── Règle 7 : modification après vérification ────────────────────────────────
/**
 * Une contribution déjà vérifiée ne peut pas être modifiée silencieusement.
 * Toute tentative d'édition d'une contribution `verified` exige une revue + trace.
 */
export function checkPostVerificationEdit(input: {
  currentStatus: string;
  isEditingAttribution: boolean;
}): FraudVerdict {
  if (input.currentStatus === "verified" && input.isEditingAttribution) {
    return review("POST_VERIFICATION_EDIT", "Modification d'une contribution vérifiée — revue + trace obligatoires");
  }
  return ALLOW;
}

// ── Règle 8 : accès inter-tenant ─────────────────────────────────────────────
export function checkCrossTenantAccess(input: {
  requestTenantId: string | null;
  resourceTenantId: string | null;
}): FraudVerdict {
  if (
    input.requestTenantId &&
    input.resourceTenantId &&
    input.requestTenantId !== input.resourceTenantId
  ) {
    return reject("CROSS_TENANT_ACCESS", "Accès inter-tenant refusé");
  }
  return ALLOW;
}

// ── Agrégation : pire verdict gagne ──────────────────────────────────────────
const SEVERITY: Record<FraudDecision, number> = { allow: 0, review: 1, reject: 2 };

/**
 * Combine plusieurs verdicts : retourne le plus sévère. À sévérité égale, conserve
 * le premier rencontré (ordre des règles = priorité de message).
 */
export function combineVerdicts(verdicts: readonly FraudVerdict[]): FraudVerdict {
  if (verdicts.length === 0) return ALLOW;
  let worst = verdicts[0];
  for (const v of verdicts) {
    if (SEVERITY[v.decision] > SEVERITY[worst.decision]) worst = v;
  }
  return worst;
}

/**
 * Évaluation complète d'une introduction au moment de l'attribution. Compose
 * toutes les règles pertinentes. Le partenaire ne peut JAMAIS forcer un `allow` :
 * toutes les entrées proviennent de faits serveur vérifiables.
 */
export interface IntroductionFraudInput {
  partnerEmail: string;
  prospectEmail: string;
  declaredAt: string | Date;
  purchaseAt: string | Date | null;
  companyFingerprint: string;
  alreadyAttributedFingerprints: ReadonlySet<string>;
  stripeEventId: string | null;
  consumedStripeEventIds: ReadonlySet<string>;
  collusion?: { sameHashedIp?: boolean; sameDeviceFingerprint?: boolean; sameBranch?: boolean };
}

export function evaluateIntroductionFraud(input: IntroductionFraudInput): FraudVerdict {
  return combineVerdicts([
    checkSelfAttribution({ partnerEmail: input.partnerEmail, prospectEmail: input.prospectEmail }),
    checkDeclaredBeforePurchase({ declaredAt: input.declaredAt, purchaseAt: input.purchaseAt }),
    checkDuplicateCompany({
      companyFingerprint: input.companyFingerprint,
      alreadyAttributedFingerprints: input.alreadyAttributedFingerprints,
    }),
    checkDuplicatePayment({
      stripeEventId: input.stripeEventId,
      consumedStripeEventIds: input.consumedStripeEventIds,
    }),
    checkEmailDomain(input.prospectEmail),
    checkCollusionSignals(input.collusion ?? {}),
  ]);
}

function toMs(v: string | Date): number | null {
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isNaN(t) ? null : t;
}
