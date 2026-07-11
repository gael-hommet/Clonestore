// P-FINAL 01 — Phase 5 — Stripe readiness checks.
// Pure: no Stripe SDK, no Next, no async, no throw.

import type { StripeReadinessCheck, StripeEnvAnalysis, StripeManualVerification } from "./stripe-readiness-types";

export function buildStripeEnvChecks(analysis: StripeEnvAnalysis): StripeReadinessCheck[] {
  const checks: StripeReadinessCheck[] = [];

  // Secret key present
  checks.push({
    id: "stripe_secret_key_present",
    label: "STRIPE_SECRET_KEY présente",
    description: "La clé secrète Stripe est définie dans les variables d'environnement",
    status: analysis.has_secret_key ? "ok" : "blocking",
    passes: analysis.has_secret_key,
    is_manual: false,
    detail: !analysis.has_secret_key ? "STRIPE_SECRET_KEY manquante dans l'environnement" : undefined,
  });

  // Publishable key present
  checks.push({
    id: "stripe_publishable_key_present",
    label: "STRIPE_PUBLISHABLE_KEY présente",
    description: "La clé publishable Stripe est définie (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)",
    status: analysis.has_publishable_key ? "ok" : "blocking",
    passes: analysis.has_publishable_key,
    is_manual: false,
    detail: !analysis.has_publishable_key ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquante" : undefined,
  });

  // Webhook secret present
  checks.push({
    id: "stripe_webhook_secret_present",
    label: "STRIPE_WEBHOOK_SECRET présent",
    description: "Le webhook secret Stripe est défini pour valider les événements webhook",
    status: analysis.has_webhook_secret ? "ok" : "blocking",
    passes: analysis.has_webhook_secret,
    is_manual: false,
    detail: !analysis.has_webhook_secret ? "STRIPE_WEBHOOK_SECRET manquant — les webhooks Stripe ne peuvent pas être validés" : undefined,
  });

  // Price ID present
  checks.push({
    id: "stripe_price_id_present",
    label: "STRIPE_PRICE_ID présent",
    description: "L'ID du produit/tarif Stripe (Pierre 449€) est défini",
    status: analysis.has_price_id ? "ok" : "blocking",
    passes: analysis.has_price_id,
    is_manual: false,
    detail: !analysis.has_price_id ? "NEXT_PUBLIC_STRIPE_PRICE_ID manquant" : undefined,
  });

  // Live keys in production
  checks.push({
    id: "stripe_live_keys",
    label: "Clés Stripe live (pas test) en production",
    description: "sk_live_ et pk_live_ doivent être utilisées en production, pas sk_test_/pk_test_",
    status: analysis.all_live_keys ? "ok" : analysis.all_test_keys ? "blocking" : "warning",
    passes: analysis.all_live_keys,
    is_manual: false,
    detail: analysis.all_test_keys
      ? "Clés TEST détectées — à remplacer par les clés LIVE avant lancement public"
      : !analysis.all_live_keys
      ? "Statut des clés non déterminé"
      : undefined,
  });

  // No key mismatch
  checks.push({
    id: "stripe_no_key_mismatch",
    label: "Pas de mismatch live/test entre les clés",
    description: "La clé secrète et la clé publishable doivent être du même environnement",
    status: analysis.key_mismatch ? "blocking" : "ok",
    passes: !analysis.key_mismatch,
    is_manual: false,
    detail: analysis.key_mismatch
      ? "Mismatch détecté : une clé est live et l'autre est test — dangereux"
      : undefined,
  });

  return checks;
}

export function buildStripeManualChecks(
  manual: Partial<StripeManualVerification>
): StripeReadinessCheck[] {
  return [
    {
      id: "stripe_webhook_endpoint_created",
      label: "Endpoint webhook Stripe créé dans le Dashboard",
      description: "Un endpoint webhook pointant vers /api/webhooks/stripe (route canonique) est configuré dans le Stripe Dashboard",
      status: manual.webhook_endpoint_created ? "ok" : "blocking",
      passes: !!manual.webhook_endpoint_created,
      is_manual: true,
      detail: !manual.webhook_endpoint_created
        ? "Créer l'endpoint webhook dans Stripe Dashboard → Developers → Webhooks"
        : undefined,
    },
    {
      id: "stripe_live_payment_tested",
      label: "Paiement live testé de bout en bout",
      description: "Un vrai paiement (ou paiement test live) a été effectué et l'activation du compte s'est bien déclenchée",
      status: manual.live_payment_tested ? "ok" : "blocking",
      passes: !!manual.live_payment_tested,
      is_manual: true,
      detail: !manual.live_payment_tested
        ? "Effectuer un test de paiement complet avec une vraie carte (ou Stripe test clock)"
        : undefined,
    },
    {
      id: "stripe_subscription_flow_verified",
      label: "Flux abonnement Pierre vérifié (checkout → activation → accès)",
      description: "Le flux complet checkout → paiement Stripe → activation compte → accès Pierre fonctionne",
      status: manual.subscription_flow_verified ? "ok" : "blocking",
      passes: !!manual.subscription_flow_verified,
      is_manual: true,
      detail: !manual.subscription_flow_verified
        ? "Tester le flux complet checkout Pierre 449€ avec activation automatique"
        : undefined,
    },
    {
      id: "stripe_dashboard_reviewed",
      label: "Dashboard Stripe production revu (fraud, billing, products)",
      description: "Le produit Pierre, les prix, les paramètres de facturation et les règles anti-fraude ont été configurés",
      status: manual.stripe_dashboard_reviewed ? "ok" : "warning",
      passes: !!manual.stripe_dashboard_reviewed,
      is_manual: true,
      detail: !manual.stripe_dashboard_reviewed
        ? "Vérifier Products, Prices, Radar fraud rules, Tax settings dans le Dashboard Stripe"
        : undefined,
    },
  ];
}
