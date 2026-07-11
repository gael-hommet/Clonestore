// P-FINAL 01 — Phase 5 — Stripe live readiness checklist.
// Pure: no Stripe SDK, no Next, no async, no throw.

export interface StripeChecklistItem {
  id: string;
  category: "keys" | "webhook" | "products" | "flow" | "compliance" | "monitoring";
  title: string;
  description: string;
  critical: boolean;
  stripe_dashboard_path?: string;
}

export const STRIPE_LIVE_CHECKLIST: StripeChecklistItem[] = [
  // ── Keys ──────────────────────────────────────────────────────────────────
  {
    id: "replace_test_keys_with_live",
    category: "keys",
    title: "Remplacer les clés test par les clés live",
    description: "Dans les variables d'environnement production, remplacer sk_test_/pk_test_ par sk_live_/pk_live_.",
    critical: true,
    stripe_dashboard_path: "Dashboard → Developers → API Keys",
  },
  {
    id: "rotate_keys_if_exposed",
    category: "keys",
    title: "Vérifier qu'aucune clé secrète n'a été exposée",
    description: "S'assurer que STRIPE_SECRET_KEY n'apparaît jamais dans les logs, le frontend, ou les dépôts publics.",
    critical: true,
  },

  // ── Webhook ───────────────────────────────────────────────────────────────
  {
    id: "create_live_webhook_endpoint",
    category: "webhook",
    title: "Créer le webhook live dans le Dashboard Stripe",
    description: "Créer un endpoint pointant vers https://[domaine]/api/webhooks/stripe (route canonique — PAS /api/stripe/webhook) avec les événements : checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed, charge.refunded, charge.dispute.created, charge.dispute.closed.",
    critical: true,
    stripe_dashboard_path: "Dashboard → Developers → Webhooks → Add endpoint",
  },
  {
    id: "copy_webhook_secret_to_env",
    category: "webhook",
    title: "Copier le Webhook Signing Secret dans STRIPE_WEBHOOK_SECRET",
    description: "Après création du webhook, copier le Signing Secret (whsec_...) dans la variable d'environnement production.",
    critical: true,
  },
  {
    id: "test_webhook_delivery",
    category: "webhook",
    title: "Tester la livraison du webhook (Send test event)",
    description: "Utiliser 'Send test event' dans le Dashboard pour vérifier que le webhook est reçu et traité sans erreur.",
    critical: true,
    stripe_dashboard_path: "Dashboard → Developers → Webhooks → [endpoint] → Send test event",
  },

  // ── Products ──────────────────────────────────────────────────────────────
  {
    id: "create_live_product_pierre",
    category: "products",
    title: "Créer le produit Pierre en mode LIVE",
    description: "Créer le produit Pierre 449€/mois dans le Dashboard Stripe LIVE (pas test). Copier le price_id dans NEXT_PUBLIC_STRIPE_PRICE_ID.",
    critical: true,
    stripe_dashboard_path: "Dashboard → Products → Add product",
  },
  {
    id: "verify_price_metadata",
    category: "products",
    title: "Vérifier les métadonnées du produit (nom, description, prix)",
    description: "Le produit Stripe doit afficher 'Pierre — Employé IA RH' avec le tarif 449€ HT/mois en euros.",
    critical: false,
  },

  // ── Flow ──────────────────────────────────────────────────────────────────
  {
    id: "test_full_checkout_flow",
    category: "flow",
    title: "Tester le flux de checkout complet (live)",
    description: "Effectuer un vrai test de checkout Pierre 449€ → paiement → activation du compte → accès au service.",
    critical: true,
  },
  {
    id: "verify_subscription_renewal",
    category: "flow",
    title: "Vérifier le renouvellement automatique",
    description: "Confirmer que l'abonnement se renouvelle automatiquement chaque mois et que l'accès est maintenu.",
    critical: false,
  },
  {
    id: "test_cancellation_flow",
    category: "flow",
    title: "Tester le flux de résiliation",
    description: "Vérifier que la résiliation depuis l'espace client ou le support fonctionne et révoque l'accès à la fin de la période payée.",
    critical: false,
  },

  // ── Compliance ────────────────────────────────────────────────────────────
  {
    id: "configure_tax_settings",
    category: "compliance",
    title: "Configurer la TVA (Stripe Tax ou mention HT)",
    description: "Configurer Stripe Tax ou s'assurer que les prix sont affichés HT avec la TVA applicable selon la réglementation.",
    critical: false,
    stripe_dashboard_path: "Dashboard → Settings → Tax",
  },
  {
    id: "setup_stripe_radar",
    category: "compliance",
    title: "Activer Stripe Radar (anti-fraude)",
    description: "Vérifier que Stripe Radar est actif et configuré avec les règles appropriées.",
    critical: false,
    stripe_dashboard_path: "Dashboard → Radar → Rules",
  },

  // ── Monitoring ────────────────────────────────────────────────────────────
  {
    id: "setup_payment_failure_alerts",
    category: "monitoring",
    title: "Configurer les alertes d'échec de paiement",
    description: "Activer les notifications Stripe pour les événements invoice.payment_failed afin de réagir rapidement.",
    critical: false,
    stripe_dashboard_path: "Dashboard → Settings → Email notifications",
  },
];

export function getChecklistByCategory(
  category: StripeChecklistItem["category"]
): StripeChecklistItem[] {
  return STRIPE_LIVE_CHECKLIST.filter((i) => i.category === category);
}

export function getCriticalStripeChecklistItems(): StripeChecklistItem[] {
  return STRIPE_LIVE_CHECKLIST.filter((i) => i.critical);
}

export function areAllCriticalStripeDone(doneIds: string[]): boolean {
  const doneSet = new Set(doneIds);
  return getCriticalStripeChecklistItems().every((i) => doneSet.has(i.id));
}
