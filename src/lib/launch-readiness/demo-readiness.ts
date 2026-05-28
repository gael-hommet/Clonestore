// B48 — Demo Readiness
// Checks demo mode configuration and isolation.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck } from "./types";

export type DemoReadinessPolicy = {
  real_email_send_allowed: boolean;
  real_ai_generation_in_demo: boolean;
  official_document_export_in_demo: boolean;
  real_mission_execution_in_demo: boolean;
  customer_data_in_demo: boolean;
  demo_data_isolated: boolean;
  demo_disclaimer_shown: boolean;
};

export function getDemoReadinessPolicy(): DemoReadinessPolicy {
  return {
    real_email_send_allowed: false,
    real_ai_generation_in_demo: false,
    official_document_export_in_demo: false,
    real_mission_execution_in_demo: false,
    customer_data_in_demo: false,
    demo_data_isolated: true,
    demo_disclaimer_shown: true,
  };
}

export function getDemoReadinessChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "DEMO_NO_REAL_EMAIL",
      surface: "demo",
      label: "Demo mode n'envoie pas de vrais emails",
      description: "En mode démo, aucun appel à Resend/SMTP ne doit être effectué.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced in B47 demo policy.",
      remediation: null,
    },
    {
      id: "DEMO_NO_OFFICIAL_DOCS",
      surface: "demo",
      label: "Demo mode ne génère pas de documents officiels",
      description: "Les documents générés en démo sont marqués ILLUSTRATIF et ne peuvent pas être exportés comme officiels.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced in B47 document policy.",
      remediation: null,
    },
    {
      id: "DEMO_NO_REAL_AI",
      surface: "demo",
      label: "Demo mode utilise des réponses mock",
      description: "En mode démo, l'IA est forcée en mode mock — pas d'appel OpenAI/Anthropic live.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "B25 force_mock=true in demo.",
      remediation: null,
    },
    {
      id: "DEMO_DISCLAIMER_VISIBLE",
      surface: "demo",
      label: "Disclaimer démo visible dans l'interface",
      description: "Chaque page démo doit afficher clairement 'Données illustratives — pas de données réelles'.",
      status: "ready_with_warnings",
      severity: "warning",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À vérifier visuellement avant lancement.",
      remediation: "Vérifier que le banner DEMO MODE est visible sur toutes les pages cockpit en mode démo.",
    },
    {
      id: "DEMO_DATA_ISOLATED",
      surface: "demo",
      label: "Données démo isolées des données production",
      description: "Les données de démo (employés fictifs, missions fictives) ne doivent pas mélanger avec des données réelles.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Demo uses separate company_id / mock data.",
      remediation: null,
    },
    {
      id: "DEMO_PIERRE_DEMO_MODE_FLAG",
      surface: "demo",
      label: "PIERRE_DEMO_MODE configuré",
      description: "PIERRE_DEMO_MODE=true en démo, false en production. La valeur ne doit pas être inversée.",
      status: "ready",
      severity: "warning",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "Documented in B47 .env.example.",
      remediation: null,
    },
  ];
}

export function getDemoBlockers(): LaunchReadinessCheck[] {
  return getDemoReadinessChecks().filter(
    (c) => c.blocking_public_launch && c.status !== "ready"
  );
}

export function isDemoLaunchBlocked(): boolean {
  return getDemoBlockers().length > 0;
}
