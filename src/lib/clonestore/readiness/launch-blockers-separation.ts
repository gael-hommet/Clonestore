// TECH-11 — Technology Readiness Final Gate — Launch Blockers Separation
// Sépare les blockers internes (technologie) des blockers externes (lancement public).
// Les blockers externes n'empêchent PAS la readiness technologique.
// Ils empêchent UNIQUEMENT public_launch_ready.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessExternalBlocker,
  TechnologyReadinessReport,
} from "./technology-readiness-types";

// ── Blockers externes connus ──────────────────────────────────────────────────

/**
 * Liste des blockers externes au lancement public.
 * Ces blockers sont externes au repo — ils ne reflètent pas l'état du code.
 *
 * RÈGLE : Ces blockers ne cassent PAS `platform_technology_foundation_ready`.
 * Ils rendent uniquement `public_launch_ready = false`.
 */
export const KNOWN_EXTERNAL_LAUNCH_BLOCKERS: TechnologyReadinessExternalBlocker[] = [
  {
    blocker_id: "company_legal_entity_pending",
    label: "Société légale non finalisée",
    description:
      "La structure juridique de la société n'est pas encore finalisée. " +
      "Requis avant lancement public commercial.",
    type: "legal",
    severity: "blocking",
    affects_technology_readiness: false,
    affects_public_launch: true,
    resolution_hint:
      "Finaliser la création de la société (SASU/SAS) avant activation Stripe live.",
  },
  {
    blocker_id: "stripe_live_pending",
    label: "Stripe live non configuré",
    description:
      "Le compte Stripe live n'est pas encore activé ou configuré. " +
      "Les paiements clients sont en mode test uniquement.",
    type: "payment",
    severity: "blocking",
    affects_technology_readiness: false,
    affects_public_launch: true,
    resolution_hint:
      "Activer Stripe live après finalisation de la société et validation du compte marchand.",
  },
  {
    blocker_id: "legal_review_pending",
    label: "Validation juridique en attente",
    description:
      "Les CGV, mentions légales et contrats clients n'ont pas été validés par un juriste.",
    type: "legal",
    severity: "blocking",
    affects_technology_readiness: false,
    affects_public_launch: true,
    resolution_hint:
      "Faire valider les documents légaux (CGV, CGU, mentions légales, RGPD) par un juriste.",
  },
  {
    blocker_id: "production_rls_pending",
    label: "RLS production Supabase non validé",
    description:
      "Les politiques Row Level Security Supabase n'ont pas été validées en environnement production.",
    type: "security",
    severity: "blocking",
    affects_technology_readiness: false,
    affects_public_launch: true,
    resolution_hint:
      "Déployer et valider les politiques RLS sur l'environnement Supabase production.",
  },
  {
    blocker_id: "live_e2e_paid_customer_pending",
    label: "E2E client payant live non validé",
    description:
      "Aucun parcours client payant complet (inscription → paiement → accès → usage) " +
      "n'a été validé en environnement live.",
    type: "operational",
    severity: "blocking",
    affects_technology_readiness: false,
    affects_public_launch: true,
    resolution_hint:
      "Réaliser un test E2E complet avec un client payant réel sur l'environnement production.",
  },
];

// ── Fonctions ─────────────────────────────────────────────────────────────────

/**
 * Retourne la liste des blockers externes au lancement public.
 */
export function listExternalLaunchBlockers(): TechnologyReadinessExternalBlocker[] {
  return KNOWN_EXTERNAL_LAUNCH_BLOCKERS;
}

/**
 * Retourne les blockers internes (technologie) depuis un rapport.
 */
export function listInternalTechnologyBlockers(
  report: TechnologyReadinessReport,
): string[] {
  return report.internal_blockers;
}

/**
 * Sépare les blockers d'un rapport en internes et externes.
 */
export function separateLaunchBlockers(report: TechnologyReadinessReport): {
  internal: string[];
  external: TechnologyReadinessExternalBlocker[];
  internal_count: number;
  external_count: number;
} {
  return {
    internal: report.internal_blockers,
    external: report.external_blockers,
    internal_count: report.internal_blockers.length,
    external_count: report.external_blockers.length,
  };
}

/**
 * Vérifie si le socle technologique peut être déclaré ready.
 *
 * RÈGLE : Les blockers externes n'affectent PAS cette décision.
 * `platform_technology_foundation_ready` peut être true même avec des blockers externes.
 */
export function canDeclareTechnologyFoundationReady(
  report: TechnologyReadinessReport,
): boolean {
  // Foundation ready si :
  // 1. Pas de blockers internes technologiques
  // 2. Les invariants absolus passent
  // 3. Les technologies core required sont au moins partial
  const hasInternalBlockers = report.internal_blockers.length > 0;
  if (hasInternalBlockers) return false;

  const absoluteFailures = report.invariants.filter(
    (i) => i.is_absolute && i.status === "fail",
  );
  if (absoluteFailures.length > 0) return false;

  const coreRequired = report.technologies.filter((t) => t.required_for_employee_runtime);
  const coreBlocked = coreRequired.filter((t) => t.status === "blocked");
  if (coreBlocked.length > 0) return false;

  return true;
}

/**
 * Vérifie si le lancement public peut être déclaré.
 *
 * RÈGLE : false tant que les blockers externes ne sont pas levés.
 * Cette fonction retourne toujours false avec les blockers connus.
 */
export function canDeclarePublicLaunchReady(
  report: TechnologyReadinessReport,
): false {
  // Toujours false si des blockers externes existent
  if (report.external_blockers.length > 0) return false;
  // Toujours false si des blockers internes existent
  if (report.internal_blockers.length > 0) return false;
  // Dans l'état actuel (TECH-11), toujours false
  return false;
}

/**
 * Construit un message d'explication de la séparation.
 */
export function buildBlockersSeparationMessage(
  report: TechnologyReadinessReport,
): string {
  const canFoundation = canDeclareTechnologyFoundationReady(report);
  const externalCount = report.external_blockers.length;
  const internalCount = report.internal_blockers.length;

  const lines: string[] = [
    "=== SÉPARATION READINESS TECHNOLOGIQUE / LANCEMENT PUBLIC ===",
    "",
    `Socle technologique (repo) : ${canFoundation ? "PRÊT ✅" : "PARTIEL ⚠️"}`,
    `Lancement public : NO-GO 🚫 (${externalCount} blocker(s) externe(s))`,
    "",
    "La readiness technologique et le lancement public sont deux verdicts distincts.",
    "Le socle technologique peut être prêt côté repo",
    "MÊME SI le lancement public reste bloqué par des facteurs externes.",
    "",
  ];

  if (internalCount > 0) {
    lines.push(`Blockers internes (${internalCount}) :`);
    for (const b of report.internal_blockers) {
      lines.push(`  - ${b}`);
    }
    lines.push("");
  }

  if (externalCount > 0) {
    lines.push(`Blockers externes (${externalCount}) — n'affectent PAS la readiness tech :`);
    for (const b of report.external_blockers) {
      lines.push(`  - ${b.label} [${b.type}]`);
    }
    lines.push("");
  }

  lines.push("Prochaines étapes pour lever les blockers externes :");
  for (const b of report.external_blockers) {
    lines.push(`  → ${b.resolution_hint}`);
  }

  return lines.join("\n");
}
