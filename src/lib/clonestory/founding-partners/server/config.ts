// CloneStory — configuration FAIL-CLOSED des secrets (SERVER-ONLY).
//
// En production (NODE_ENV=production), un secret obligatoire absent ou trop faible
// PROVOQUE une erreur explicite : aucune valeur de secours n'est utilisable.
// Les valeurs de développement ne sont autorisées que dans un mode local EXPLICITE
// (CLONESTORY_LOCAL_MODE=1), jamais en production.

export class ClonestoryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClonestoryConfigError";
  }
}

const MIN_SECRET_LEN = 24;

export const REQUIRED_PRODUCTION_VARS = [
  "CLONESTORY_SESSION_SECRET",
  "CLONESTORY_COMPANY_SALT",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "CLONESTORE_FOUNDER_EMAIL_FROM",
] as const;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Mode dev local EXPLICITE — jamais actif en production. */
export function isLocalMode(): boolean {
  return !isProduction() && process.env.CLONESTORY_LOCAL_MODE === "1";
}

function devValue(name: string): string {
  return `dev-only-${name}-set-a-real-secret-please`; // ≥ 24, jamais en prod
}

/**
 * Résout un secret. Prod : exige présence + longueur. Dev : valeur fournie si
 * présente, sinon valeur de dev UNIQUEMENT en mode local explicite, sinon erreur
 * (force la déclaration explicite du mode local).
 */
function resolveSecret(name: string, minLen = MIN_SECRET_LEN): string {
  const v = (process.env[name] ?? "").trim();
  if (v.length >= minLen) return v;
  if (isProduction()) {
    throw new ClonestoryConfigError(
      `[CloneStory] ${name} requis en production (au moins ${minLen} caractères forts). Inscriptions bloquées.`,
    );
  }
  if (isLocalMode()) return v.length ? v : devValue(name);
  throw new ClonestoryConfigError(
    `[CloneStory] ${name} absent. En développement, déclarez CLONESTORY_LOCAL_MODE=1 ou fournissez ${name}.`,
  );
}

export function sessionSecret(): string {
  return resolveSecret("CLONESTORY_SESSION_SECRET");
}

export function companySalt(): string {
  return resolveSecret("CLONESTORY_COMPANY_SALT");
}

export function emailFrom(): string {
  const v = (process.env.CLONESTORE_FOUNDER_EMAIL_FROM ?? "").trim();
  if (v) return v;
  if (isProduction()) {
    throw new ClonestoryConfigError("[CloneStory] CLONESTORE_FOUNDER_EMAIL_FROM requis en production.");
  }
  return "CloneStore <fondateur@clonestore.pro>";
}

/** Fail-closed email : en prod, exige RESEND_API_KEY + expéditeur. */
export function assertEmailConfigured(): void {
  if (!isProduction()) return;
  if (!process.env.RESEND_API_KEY) {
    throw new ClonestoryConfigError("[CloneStory] RESEND_API_KEY requis en production.");
  }
  emailFrom();
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL);
}

/**
 * Ouverture des inscriptions — DÉCISION OPÉRATEUR EXPLICITE, jamais déduite de la
 * présence des secrets. Par défaut FERMÉ. N'est « ouvert » que si la variable vaut
 * exactement "true".
 */
export function registrationOpen(): boolean {
  return (process.env.CLONESTORY_REGISTRATION_OPEN ?? "").trim() === "true";
}

/** Base URL publique pour la reprise d'envoi (worker, sans requête HTTP). */
export function publicBaseUrl(): string {
  return (process.env.CLONESTORY_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://clonestore.pro").replace(/\/$/, "");
}

// ── CS-FINAL 3 : contribution commerciale ───────────────────────────────────────
/**
 * Délai de sécurité (ms) entre l'activation confirmée et la vérification définitive
 * d'une contribution. Couvre le risque de remboursement immédiat / fraude / activation
 * retardée. Par défaut 7 jours (aligné sur la fenêtre d'essai/rétractation usuelle).
 * Configurable ; jamais inventé arbitrairement — documenté dans CS_FINAL_3.
 */
const DEFAULT_VALIDATION_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
export function contributionValidationDelayMs(): number {
  const raw = Number.parseInt((process.env.CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS ?? "").trim(), 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_VALIDATION_DELAY_MS;
}

/**
 * Seuil de remboursement PARTIEL au-delà duquel une contribution vérifiée repasse en
 * revue (validation_pending). Exprimé en pourcentage du brut remboursé (0–100).
 * Par défaut 50 % : un remboursement ≥ 50 % du montant brut suspend la contribution.
 * En-deçà, la contribution reste valide (seul le net est ajusté). Documenté.
 */
const DEFAULT_PARTIAL_REFUND_REVIEW_PCT = 50;
export function partialRefundReviewPct(): number {
  const raw = Number.parseInt((process.env.CLONESTORY_PARTIAL_REFUND_REVIEW_PCT ?? "").trim(), 10);
  return Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : DEFAULT_PARTIAL_REFUND_REVIEW_PCT;
}

/** Produits CloneStore éligibles à une contribution commerciale vérifiée (audités). */
export function eligibleCommercialProducts(): Set<string> {
  return new Set(["pierre", "clara"]);
}

/** Secret du cron de l'outbox commerciale (réutilise le secret générique en repli). */
export function commercialOutboxCronSecret(): string {
  return (process.env.CLONESTORY_COMMERCIAL_CRON_SECRET ?? process.env.CLONESTORY_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
}

/**
 * FEATURE FLAGS d'exploitation (CS-FINAL 4) — interrupteurs d'incident. Chaque flag est
 * ACTIF par défaut (les chemins sont testés) ; un opérateur peut le DÉSACTIVER en posant
 * `CLONESTORY_FF_<FLAG>=off|false|0` (ex. couper le pont commercial sans redéployer). Le
 * checkout CloneStore principal n'est JAMAIS gouverné par ces flags.
 */
export type ClonestoryFeature =
  | "commercial_bridge" | "attribution_capture" | "notifications" | "auto_verification" | "admin_mutations";
export function clonestoryFeatureEnabled(flag: ClonestoryFeature): boolean {
  const v = (process.env[`CLONESTORY_FF_${flag.toUpperCase()}`] ?? "").trim().toLowerCase();
  return !(v === "off" || v === "false" || v === "0" || v === "no");
}

/**
 * PRÉFLIGHT D'INSCRIPTION — à appeler AVANT toute écriture / rate-limit / token.
 * Lève `ClonestoryConfigError` si la configuration requise est incomplète. Le flag
 * seul ne suffit JAMAIS : la config doit être complète. En dev (mode local), les
 * résolveurs renvoient des valeurs de dev — le préflight passe pour les tests/dev.
 */
export function assertClonestoryRegistrationReady(): void {
  if (!registrationOpen()) {
    throw new ClonestoryConfigError("[CloneStory] inscriptions fermées (flag).");
  }
  sessionSecret(); // lève en prod si absent/faible
  companySalt(); //  lève en prod si absent/faible
  if (isProduction() && !databaseConfigured()) {
    throw new ClonestoryConfigError("[CloneStory] DATABASE_URL requis en production.");
  }
  assertEmailConfigured(); // lève en prod si RESEND_API_KEY / expéditeur manquant
}

/**
 * Les affordances de dev (base PGlite en process, URLs devVerifyUrl/devConfirmUrl)
 * ne sont JAMAIS autorisées en production, même si la variable est posée.
 */
export function devAffordancesAllowed(): boolean {
  return !isProduction() && Boolean(process.env.CLONESTORY_LOCAL_PGLITE);
}

/** Rapport de préparation (booléens uniquement — ne révèle JAMAIS les valeurs). */
export interface VarReadiness {
  name: string;
  present: boolean;
  strong: boolean; // longueur suffisante (pour les secrets)
}
export function inspectProductionReadiness(): { vars: VarReadiness[]; ready: boolean; registrationOpen: boolean } {
  const secretVars = new Set(["CLONESTORY_SESSION_SECRET", "CLONESTORY_COMPANY_SALT"]);
  const vars = REQUIRED_PRODUCTION_VARS.map((name) => {
    const v = (process.env[name] ?? "").trim();
    const present = v.length > 0;
    const strong = secretVars.has(name) ? v.length >= MIN_SECRET_LEN : present;
    return { name, present, strong };
  });
  // L'état du flag est INFORMATIF (ouverte/fermée) ; il n'entre PAS dans `ready`
  // (l'infra peut être prête alors que l'ouverture reste une décision séparée).
  return { vars, ready: vars.every((v) => v.present && v.strong), registrationOpen: registrationOpen() };
}
