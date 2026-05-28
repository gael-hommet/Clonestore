// B48 — Pierre Feature Readiness
// Checks Pierre HR engine readiness for production.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck } from "./types";

export function getPierreReadinessChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "PIERRE_LEGAL_GUARDRAILS",
      surface: "pierre",
      label: "Legal guardrails B47 activés",
      description: "PIERRE_LEGAL_GUARDRAILS_ENABLED=true en production. Les guardrails interceptent les outputs risqués.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À activer via variable d'environnement.",
      remediation: "Définir PIERRE_LEGAL_GUARDRAILS_ENABLED=true dans les variables de production.",
    },
    {
      id: "PIERRE_NO_LAWYER_CLAIMS",
      surface: "pierre",
      label: "Pierre ne se présente pas comme avocat/juriste",
      description: "Aucune page ou output ne prétend que Pierre est un juriste, avocat, ou remplaçant légal RH.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced by B47 commercial claims policy.",
      remediation: null,
    },
    {
      id: "PIERRE_NO_PAYSLIP_GENERATION",
      surface: "pierre",
      label: "Pierre ne génère pas de bulletins de paie officiels",
      description: "Pierre ne peut pas produire de fiches de paie, soumettre des DSN, ou se substituer à un logiciel de paie officiel.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced by B47 payroll policy — blocked task types.",
      remediation: null,
    },
    {
      id: "PIERRE_NO_LIVE_EMAIL",
      surface: "pierre",
      label: "Pierre ne peut pas envoyer d'emails live",
      description: "Toutes les actions email de Pierre sont en mode 'draft' ou 'requires_approval'. Aucun envoi direct.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced by B38/B47 email policy.",
      remediation: null,
    },
    {
      id: "PIERRE_NO_OFFICIAL_DOCS_WITHOUT_VALIDATION",
      surface: "pierre",
      label: "Documents officiels nécessitent validation humaine",
      description: "Aucun document officiel (contrat, lettre de licenciement, etc.) ne peut sortir sans approbation humaine.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced by B42/B47 document policy.",
      remediation: null,
    },
    {
      id: "PIERRE_BRAIN_MOCK_FALLBACK",
      surface: "pierre",
      label: "Brain IA avec fallback mock opérationnel",
      description: "Si OpenAI/Anthropic indisponibles, Pierre fonctionne en mode déterministe / mock sans interruption.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "B25/B26 force_mock fallback implemented.",
      remediation: null,
    },
    {
      id: "PIERRE_SUBMIT_ROUTE",
      surface: "pierre",
      label: "Route /api/pierre/submit opérationnelle",
      description: "Point d'entrée principal de Pierre fonctionnel en production.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Implemented in B40+.",
      remediation: null,
    },
    {
      id: "PIERRE_SENSITIVE_HR_GUARDRAILS",
      surface: "pierre",
      label: "Guardrails cas RH sensibles actifs",
      description: "Les 13 catégories sensibles (licenciement, harcèlement, santé, etc.) déclenchent validation humaine obligatoire.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced by B43/B47 sensitive HR policy.",
      remediation: null,
    },
    {
      id: "PIERRE_OUTPUT_VALIDATION",
      surface: "pierre",
      label: "Validation output B47 activée",
      description: "PIERRE_OUTPUT_VALIDATION_ENABLED=true en production.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À activer via variable d'environnement.",
      remediation: "Définir PIERRE_OUTPUT_VALIDATION_ENABLED=true en production.",
    },
  ];
}

export function getPierreBlockers(): LaunchReadinessCheck[] {
  return getPierreReadinessChecks().filter(
    (c) => c.blocking_public_launch && c.status !== "ready"
  );
}

export function isPierreLaunchBlocked(): boolean {
  return getPierreBlockers().length > 0;
}

export function getPierreReadinessSummary(): {
  total: number;
  ready: number;
  ready_with_warnings: number;
  blocked: number;
} {
  const checks = getPierreReadinessChecks();
  const ready = checks.filter((c) => c.status === "ready").length;
  const ready_with_warnings = checks.filter((c) => c.status === "ready_with_warnings").length;
  const blocked = checks.filter((c) => c.status === "blocked").length;
  return { total: checks.length, ready, ready_with_warnings, blocked };
}
