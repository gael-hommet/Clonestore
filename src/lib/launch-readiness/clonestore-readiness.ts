// B48 — CloneStore Platform Readiness
// Checks CloneStore platform readiness for production.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck } from "./types";

export function getClonestoreReadinessChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "CS_TECHNOLOGIES_CONFIG",
      surface: "technologies",
      label: "Technologies B46 configurées",
      description: "CloneOS, CloneADN, CloneGuard, CloneTrace correctement configurés. Locked technologies ne peuvent pas être désactivées.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "B46 technology registry implemented with locked enforcement.",
      remediation: null,
    },
    {
      id: "CS_CLONEGUARD_ACTIVE",
      surface: "technologies",
      label: "CloneGuard actif (jamais désactivable)",
      description: "CloneGuard doit toujours être en mode 'production' — il est locked et ne peut pas être désactivé.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Doubly enforced: canEditTechnologyConfig + TECHNOLOGY_LOCKED route check.",
      remediation: null,
    },
    {
      id: "CS_CLONETRACE_ACTIVE",
      surface: "technologies",
      label: "CloneTrace actif (jamais désactivable)",
      description: "CloneTrace doit toujours être en mode 'production' — il est locked.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Locked in B46.",
      remediation: null,
    },
    {
      id: "CS_AUTH_FLOW",
      surface: "auth",
      label: "Flux d'authentification complet",
      description: "Inscription, connexion, session, déconnexion — tous fonctionnels. Supabase Auth configuré.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "B33 auth layer implemented.",
      remediation: null,
    },
    {
      id: "CS_BILLING_FLOW",
      surface: "billing",
      label: "Flux de paiement complet",
      description: "Checkout → Activation → Accès cockpit — flux complet testé.",
      status: "ready_with_warnings",
      severity: "blocking",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Code ready — clés Stripe live non vérifiées.",
      remediation: "Configurer les clés Stripe live et tester le flux de bout en bout.",
    },
    {
      id: "CS_TENANT_ISOLATION",
      surface: "security",
      label: "Isolation multi-tenant (company_id)",
      description: "Chaque requête filtre par company_id. Pas de cross-tenant data leak possible.",
      status: "ready_with_warnings",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Code filtre par company_id — RLS non vérifié en production.",
      remediation: "Activer et tester RLS Supabase pour toutes les tables multi-tenant.",
    },
    {
      id: "CS_TENANT_SPOOFING_STRIP",
      surface: "security",
      label: "Stripping des IDs tenant des inputs client",
      description: "user_id/company_id/tenant_id sont strippés des corps client sur les routes sensibles.",
      status: "ready",
      severity: "critical",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Enforced in B46 technology save/reset routes.",
      remediation: null,
    },
    {
      id: "CS_RUNTIME_CONTEXT",
      surface: "cockpit",
      label: "Runtime context CloneOS opérationnel",
      description: "GET/POST /api/clonestore/runtime fonctionnels. Context evaluator opérationnel.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "B19 runtime context implemented.",
      remediation: null,
    },
    {
      id: "CS_OBSERVABILITY",
      surface: "observability",
      label: "Observabilité et audit trail",
      description: "Audit trail B16, CloneTrace B14/B15, logs structurés — opérationnels.",
      status: "ready",
      severity: "warning",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "B16 audit trail implemented.",
      remediation: null,
    },
    {
      id: "CS_ERROR_PAGES",
      surface: "public_site",
      label: "Pages d'erreur 404/500 configurées",
      description: "Pages d'erreur personnalisées Next.js en place.",
      status: "ready_with_warnings",
      severity: "info",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: false,
      notes: "À vérifier visuellement.",
      remediation: "Vérifier /not-found.tsx et error.tsx dans Next.js.",
    },
  ];
}

export function getClonestoreBlockers(): LaunchReadinessCheck[] {
  return getClonestoreReadinessChecks().filter(
    (c) => c.blocking_public_launch && c.status !== "ready"
  );
}

export function isClonestoreLaunchBlocked(): boolean {
  return getClonestoreBlockers().length > 0;
}
