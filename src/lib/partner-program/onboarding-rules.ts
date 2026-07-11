// Cabinets Fondateurs — règles PURES d'admission automatique et d'activation.
// Aucune I/O. L'admission est AUTOMATIQUE par défaut : la revue humaine n'existe
// que par EXCEPTION, lorsqu'un risque réel est détecté.

export type RiskKind =
  | "disposable_email"
  | "non_professional_email"
  | "domain_mismatch"
  | "duplicate_applications"
  | "existing_partner_domain"
  | "country_not_allowed"
  | "self_referral_suspected"
  | "shared_stripe_account"
  | "abnormal_volume";

export type RiskFlag = {
  kind: RiskKind;
  severity: "low" | "medium" | "high";
  /** Toujours explicable en clair — jamais un score opaque. */
  explanation: string;
};

/** Un flag BLOQUANT force la revue humaine ; les autres sont seulement signalés. */
export const BLOCKING_RISKS: ReadonlySet<RiskKind> = new Set<RiskKind>([
  "disposable_email",
  "duplicate_applications",
  "existing_partner_domain",
  "country_not_allowed",
  "self_referral_suspected",
  "shared_stripe_account",
  "abnormal_volume",
]);

export const ALLOWED_COUNTRIES: ReadonlySet<string> = new Set(["FR", "BE", "LU", "CH"]);

export type ApplicationRiskInput = {
  emailDomain: string | null;
  isDisposableDomain: boolean;
  isPersonalDomain: boolean;
  websiteDomain: string | null;
  country: string;
  /** Nombre de candidatures antérieures (ouvertes ou traitées) pour le même domaine. */
  priorApplicationsSameDomain: number;
  /** Un partenaire existe déjà avec ce domaine d'email. */
  partnerExistsWithDomain: boolean;
  /** Candidatures reçues récemment depuis la même IP (comportement automatisé). */
  recentApplicationsSameIp: number;
};

export type AdmissionDecision =
  | { admit: "auto"; flags: RiskFlag[] }
  | { admit: "manual_review"; flags: RiskFlag[]; blocking: RiskKind[] };

/**
 * Décide l'admission d'une candidature.
 * Par défaut : AUTO. Revue humaine uniquement si au moins un risque BLOQUANT.
 */
export function evaluateApplicationRisk(input: ApplicationRiskInput): AdmissionDecision {
  const flags: RiskFlag[] = [];

  if (input.isDisposableDomain) {
    flags.push({ kind: "disposable_email", severity: "high", explanation: `Domaine e-mail jetable détecté (${input.emailDomain ?? "inconnu"}).` });
  }
  if (input.isPersonalDomain && !input.isDisposableDomain) {
    // Signalé, NON bloquant : un cabinet peut candidater depuis une adresse grand public.
    flags.push({ kind: "non_professional_email", severity: "low", explanation: "Adresse e-mail grand public plutôt que professionnelle." });
  }
  if (input.websiteDomain && input.emailDomain && input.websiteDomain !== input.emailDomain) {
    // Signalé, NON bloquant : un cabinet peut légitimement avoir un site distinct.
    flags.push({ kind: "domain_mismatch", severity: "low", explanation: `Le domaine du site (${input.websiteDomain}) diffère du domaine e-mail (${input.emailDomain}).` });
  }
  if (input.priorApplicationsSameDomain >= 2) {
    flags.push({ kind: "duplicate_applications", severity: "medium", explanation: `${input.priorApplicationsSameDomain} candidatures antérieures pour le même domaine.` });
  }
  if (input.partnerExistsWithDomain) {
    flags.push({ kind: "existing_partner_domain", severity: "high", explanation: "Un cabinet partenaire existe déjà avec ce domaine." });
  }
  if (!ALLOWED_COUNTRIES.has(input.country.toUpperCase())) {
    flags.push({ kind: "country_not_allowed", severity: "high", explanation: `Pays hors périmètre du programme (${input.country}).` });
  }
  if (input.recentApplicationsSameIp >= 3) {
    flags.push({ kind: "abnormal_volume", severity: "high", explanation: `${input.recentApplicationsSameIp} candidatures récentes depuis la même origine.` });
  }

  const blocking = flags.filter((f) => BLOCKING_RISKS.has(f.kind)).map((f) => f.kind);
  if (blocking.length > 0) return { admit: "manual_review", flags, blocking };
  return { admit: "auto", flags };
}

// ── Activation automatique ───────────────────────────────────────────────────

export type ActivationInput = {
  status: string;
  contractAccepted: boolean;
  onboardingStatus: "none" | "pending" | "complete" | "restricted";
  payoutsEnabled: boolean;
  hasBlockingRiskFlag: boolean;
};

export type ActivationDecision =
  | { activate: true }
  | { activate: false; reason: string; code: string };

/**
 * Le partenaire s'active AUTOMATIQUEMENT dès que les trois conditions sont réunies :
 * conditions acceptées + Stripe Connect complet (payouts activés) + aucun risque bloquant.
 * Aucune action administrateur n'est requise.
 */
export function decideAutoActivation(input: ActivationInput): ActivationDecision {
  if (input.status === "active") return { activate: false, reason: "Le partenaire est déjà actif.", code: "already_active" };
  if (input.status === "suspended" || input.status === "archived") {
    return { activate: false, reason: "Le partenaire est suspendu ou archivé.", code: "partner_suspended" };
  }
  if (input.hasBlockingRiskFlag) {
    return { activate: false, reason: "Un signal de risque bloquant est ouvert : revue humaine requise.", code: "blocking_risk_flag" };
  }
  if (!input.contractAccepted) {
    return { activate: false, reason: "Les conditions du programme ne sont pas encore acceptées.", code: "contract_not_accepted" };
  }
  if (input.onboardingStatus !== "complete" || !input.payoutsEnabled) {
    return { activate: false, reason: "L’onboarding Stripe Connect n’est pas terminé.", code: "stripe_onboarding_incomplete" };
  }
  return { activate: true };
}

/** Étapes restantes affichées au partenaire (espace). Ordre = ordre du parcours. */
export function remainingOnboardingSteps(input: ActivationInput): string[] {
  const steps: string[] = [];
  if (!input.contractAccepted) steps.push("accept_terms");
  if (input.onboardingStatus !== "complete" || !input.payoutsEnabled) steps.push("complete_stripe_onboarding");
  if (input.hasBlockingRiskFlag) steps.push("awaiting_review");
  return steps;
}
