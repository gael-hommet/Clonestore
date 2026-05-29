// P-FINAL 01 — Phase 7 — Paid customer checklist.
// Defines what must be true for a paid customer to have full Pierre access.
// Pure: no Supabase, no Next, no async, no throw.

import type { AccountState, PaidCustomerChecklistItem } from "./paid-customer-types";

export const PAID_CUSTOMER_CHECKLIST: PaidCustomerChecklistItem[] = [
  {
    id: "has_company_record",
    label: "Enregistrement company présent en base",
    description: "L'entreprise cliente a un enregistrement dans la table companies",
    critical: true,
    check: (s) => s.has_company_record,
    failure_message: "Pas d'enregistrement company en base — accès Pierre impossible",
  },
  {
    id: "has_user_profile",
    label: "Profil utilisateur présent",
    description: "Le compte utilisateur a un profil lié à la company",
    critical: true,
    check: (s) => s.has_user_profile,
    failure_message: "Pas de profil utilisateur lié à la company",
  },
  {
    id: "subscription_active",
    label: "Abonnement actif (active ou trialing)",
    description: "Le statut de l'abonnement Stripe est 'active' ou 'trialing'",
    critical: true,
    check: (s) => s.subscription_status === "active" || s.subscription_status === "trialing",
    failure_message: `Abonnement non actif — statut attendu: active ou trialing`,
  },
  {
    id: "has_stripe_customer_id",
    label: "Stripe Customer ID présent",
    description: "Le compte a un stripe_customer_id pour la facturation",
    critical: true,
    check: (s) => !!s.stripe_customer_id,
    failure_message: "Pas de stripe_customer_id — facturation impossible",
  },
  {
    id: "has_stripe_subscription_id",
    label: "Stripe Subscription ID présent",
    description: "Le compte a un stripe_subscription_id actif",
    critical: true,
    check: (s) => !!s.stripe_subscription_id,
    failure_message: "Pas de stripe_subscription_id — abonnement non lié",
  },
  {
    id: "pierre_access_full",
    label: "Accès Pierre niveau 'full'",
    description: "L'utilisateur a accès complet à Pierre (pas limité ou aucun)",
    critical: true,
    check: (s) => s.pierre_access_level === "full",
    failure_message: `Accès Pierre non complet — niveau actuel: non-full`,
  },
  {
    id: "payment_current",
    label: "Paiement à jour",
    description: "Le paiement le plus récent a bien été encaissé",
    critical: true,
    check: (s) => s.is_payment_current,
    failure_message: "Paiement non à jour — accès peut être suspendu",
  },
  {
    id: "not_canceled",
    label: "Abonnement non annulé",
    description: "L'abonnement n'est pas dans un état annulé ou incomplet",
    critical: false,
    check: (s) =>
      s.subscription_status !== "canceled" &&
      s.subscription_status !== "incomplete" &&
      s.subscription_status !== "unpaid",
    failure_message: "Abonnement annulé, incomplet ou impayé",
  },
  {
    id: "has_subscription_start_date",
    label: "Date de début d'abonnement enregistrée",
    description: "La date de début de l'abonnement est connue",
    critical: false,
    check: (s) => !!s.subscription_start_date,
    failure_message: "Date de début d'abonnement manquante",
  },
];

export function getCriticalChecklistItems(): PaidCustomerChecklistItem[] {
  return PAID_CUSTOMER_CHECKLIST.filter((i) => i.critical);
}

export function runChecklist(state: AccountState): {
  passed: string[];
  failed_critical: string[];
  failed_non_critical: string[];
} {
  const passed: string[] = [];
  const failed_critical: string[] = [];
  const failed_non_critical: string[] = [];

  for (const item of PAID_CUSTOMER_CHECKLIST) {
    if (item.check(state)) {
      passed.push(item.id);
    } else if (item.critical) {
      failed_critical.push(item.id);
    } else {
      failed_non_critical.push(item.id);
    }
  }

  return { passed, failed_critical, failed_non_critical };
}
