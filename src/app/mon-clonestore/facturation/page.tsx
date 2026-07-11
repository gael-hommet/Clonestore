// src/app/mon-clonestore/facturation/page.tsx
// Page de gestion d'abonnement (return_url du Billing Portal). La session est déjà exigée par
// le layout /mon-clonestore ; l'interactif (fetch/actions) est porté par BillingManager (client).
import { BillingManager } from "@/components/mon-clonestore/BillingManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturation — Mon CloneStore",
  description: "Gérez votre abonnement CloneStore : statut, renouvellement et espace de facturation.",
};

export default function FacturationPage() {
  return <BillingManager />;
}
