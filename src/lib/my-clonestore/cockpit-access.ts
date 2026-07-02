// My CloneStore — logique d'accès au cockpit (P9.2, Étape 8).
//
// Fonction PURE et déterministe : à partir des données réelles (authentification,
// état opérationnel de l'entitlement, possession de l'employé, complétude
// onboarding), retourne une décision d'accès + un message clair + un CTA correct.
// Aucune fuite technique, aucune boucle : chaque état a un CTA unique et sûr.
// Le lien « ready » réutilise la route cockpit EXISTANTE (jamais refondue en P9.2).

import type {
  CockpitAccessDecision,
  CockpitAccessInput,
  CockpitAccessResult,
} from "./types";

export interface CockpitAccessOptions {
  /** Route canonique du cockpit de cet employé (ex. /agents/pierre/use). */
  readonly cockpitHref?: string;
  /** Route de la fiche publique de l'employé (ex. /agents/pierre). */
  readonly discoverHref?: string;
  /** Route d'onboarding client. */
  readonly onboardingHref?: string;
  /** Route home / facturation. */
  readonly accountHref?: string;
  /** Libellé de l'employé (ex. « Pierre »). */
  readonly employeeLabel?: string;
}

const DEFAULTS = {
  cockpitHref: "/agents/pierre/use",
  discoverHref: "/agents/pierre",
  onboardingHref: "/profile/onboarding",
  accountHref: "/profile",
  employeeLabel: "Pierre",
} as const;

export function resolveCockpitAccess(
  input: CockpitAccessInput,
  options: CockpitAccessOptions = {},
): CockpitAccessResult {
  const opt = { ...DEFAULTS, ...clean(options) };

  const build = (
    decision: CockpitAccessDecision,
    canOpen: boolean,
    title: string,
    message: string,
    label: string,
    href: string,
  ): CockpitAccessResult => ({ decision, canOpen, title, message, cta: { label, href } });

  // 1) Route indisponible → jamais de lien mort.
  if (!input.routeAvailable) {
    return build(
      "unavailable",
      false,
      "Bientôt disponible",
      "Cet espace n'est pas encore disponible pour votre compte.",
      "Retour à My CloneStore",
      opt.accountHref,
    );
  }

  // 2) Non authentifié / anonyme → géré par le guard (redirection login).
  if (!input.authenticated || input.operationalState === "anonymous") {
    return build(
      "unavailable",
      false,
      "Connexion requise",
      "Connectez-vous pour accéder à votre espace.",
      "Se connecter",
      "/login",
    );
  }

  // 3) Entitlement en cours d'activation.
  if (
    input.operationalState === "payment_pending" ||
    input.operationalState === "activation_pending"
  ) {
    return build(
      "entitlement_pending",
      false,
      "Activation en cours",
      `L'accès à ${opt.employeeLabel} est en cours d'activation. Vous serez prévenu dès qu'il est prêt.`,
      "Voir l'état",
      opt.accountHref,
    );
  }

  // 4) Entitlement inactif (suspendu / terminé).
  if (
    input.operationalState === "subscription_suspended" ||
    input.operationalState === "subscription_ended"
  ) {
    return build(
      "entitlement_inactive",
      false,
      "Abonnement inactif",
      `Votre abonnement ${opt.employeeLabel} n'est pas actif pour le moment.`,
      "Gérer l'abonnement",
      opt.accountHref,
    );
  }

  // 5) N'appartient pas au client (ne possède pas cet employé).
  if (!input.ownsEmployee || input.operationalState === "authenticated_without_employee") {
    return build(
      "employee_not_owned",
      false,
      `Découvrir ${opt.employeeLabel}`,
      `Vous ne possédez pas encore ${opt.employeeLabel}. Découvrez ce qu'il fait avant de l'activer.`,
      `Découvrir ${opt.employeeLabel}`,
      opt.discoverHref,
    );
  }

  // 6) Possédé + actif : dépend de la complétude onboarding.
  if (input.operationalState === "employee_active") {
    if (!input.companyIdentityComplete) {
      return build(
        "account_incomplete",
        false,
        "Complétez votre entreprise",
        "Renseignez l'identité de votre entreprise pour démarrer.",
        "Démarrer",
        opt.onboardingHref,
      );
    }
    if (!input.onboardingSufficient) {
      return build(
        "onboarding_required",
        false,
        "Terminez le démarrage",
        `Encore quelques informations et ${opt.employeeLabel} pourra travailler avec votre contexte.`,
        "Continuer le démarrage",
        opt.onboardingHref,
      );
    }
    return build(
      "ready",
      true,
      "Cockpit prêt",
      `${opt.employeeLabel} est prêt. Ouvrez son cockpit pour piloter les missions.`,
      "Ouvrir le cockpit",
      opt.cockpitHref,
    );
  }

  // 7) Filet de sécurité.
  return build(
    "unavailable",
    false,
    "Indisponible",
    "Cet espace n'est pas disponible pour le moment.",
    "Retour à My CloneStore",
    opt.accountHref,
  );
}

function clean<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
