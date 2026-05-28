// B48 — Billing Readiness
// Checks Stripe / billing configuration for production launch.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck } from "./types";

export function getBillingReadinessChecks(): LaunchReadinessCheck[] {
  return [
    {
      id: "BILL_STRIPE_LIVE_KEYS",
      surface: "billing",
      label: "Clés Stripe live configurées",
      description: "STRIPE_SECRET_KEY doit être sk_live_*, pas sk_test_*. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY doit être pk_live_*.",
      status: "blocked",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Non vérifié — requis avant prise de paiement réel.",
      remediation: "Remplacer les clés test par les clés live sur le dashboard Stripe. Mettre à jour les variables d'environnement.",
    },
    {
      id: "BILL_STRIPE_WEBHOOK",
      surface: "billing",
      label: "Webhook Stripe production enregistré",
      description: "STRIPE_WEBHOOK_SECRET doit correspondre au webhook de production (whsec_live_*).",
      status: "blocked",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Non vérifié — requis pour recevoir les événements Stripe.",
      remediation: "Créer un webhook sur dashboard.stripe.com pointant vers /api/stripe/return. Copier le signing secret.",
    },
    {
      id: "BILL_STRIPE_PRICE_ID",
      surface: "billing",
      label: "Prix Stripe live créé (449€/mois)",
      description: "NEXT_PUBLIC_STRIPE_PRICE_ID doit correspondre à un prix actif en mode live à 449€/mois.",
      status: "blocked",
      severity: "critical",
      is_manual: true,
      manual_verified: false,
      blocking_public_launch: true,
      notes: "Non vérifié — requis pour le checkout.",
      remediation: "Créer un produit et un prix récurrent à 449€/mois en mode live sur Stripe.",
    },
    {
      id: "BILL_ACTIVATE_ROUTE",
      surface: "billing",
      label: "Route /api/billing/activate opérationnelle",
      description: "L'activation du compte après paiement Stripe doit fonctionner end-to-end.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Route implémentée en B34.",
      remediation: null,
    },
    {
      id: "BILL_CHECKOUT_ROUTE",
      surface: "checkout",
      label: "Route /api/checkout opérationnelle",
      description: "La création de session Stripe checkout doit fonctionner end-to-end.",
      status: "ready",
      severity: "blocking",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: true,
      notes: "Route implémentée.",
      remediation: null,
    },
    {
      id: "BILL_PRICE_MATCH",
      surface: "billing",
      label: "Prix 449€/mois cohérent partout",
      description: "PIERRE_MONTHLY_PRICE_EUR=449 doit correspondre au prix affiché sur la landing page et au prix Stripe.",
      status: "ready",
      severity: "warning",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "449€ documenté en B47.",
      remediation: null,
    },
    {
      id: "BILL_NO_FREE_TRIAL",
      surface: "billing",
      label: "Pas d'essai gratuit de production activé",
      description: "B47 interdit un essai gratuit de 7 jours en production. free_trial_enabled doit rester false.",
      status: "ready",
      severity: "warning",
      is_manual: false,
      manual_verified: true,
      blocking_public_launch: false,
      notes: "Enforced in B47 pricing policy.",
      remediation: null,
    },
  ];
}

export function getBillingBlockers(): LaunchReadinessCheck[] {
  return getBillingReadinessChecks().filter(
    (c) => c.blocking_public_launch && c.status !== "ready"
  );
}

export function isBillingLaunchBlocked(): boolean {
  return getBillingBlockers().length > 0;
}

export function getBillingReadinessSummary(): {
  total: number;
  ready: number;
  blocked: number;
  blocking_unresolved: number;
} {
  const checks = getBillingReadinessChecks();
  const ready = checks.filter((c) => c.status === "ready").length;
  const blocked = checks.filter((c) => c.status === "blocked").length;
  const blocking_unresolved = checks.filter((c) => c.blocking_public_launch && c.status !== "ready").length;
  return { total: checks.length, ready, blocked, blocking_unresolved };
}
