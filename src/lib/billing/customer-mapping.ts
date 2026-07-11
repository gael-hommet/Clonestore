// src/lib/billing/customer-mapping.ts
// Mapping User ↔ Stripe Customer ↔ Subscription — décisions PURES.
// Aucun réseau, aucune base, aucun effet de bord.
//
// PROBLÈME RÉSOLU
// `checkout.sessions.create` ne passait ni `customer` ni `client_reference_id` : Stripe
// créait donc un NOUVEAU Customer à chaque session. Un même utilisateur qui se réabonne
// (après `canceled`/`past_due`) ou qui double-clique se retrouvait avec plusieurs Customers,
// ce qui casse l'historique de facturation, le Billing Portal et toute analyse de revenu.
//
// INVARIANT DE SÉCURITÉ
// Un Customer n'est réutilisé que s'il appartient RÉELLEMENT à l'utilisateur. Un Customer
// portant une `metadata.user_id` d'un autre compte n'est JAMAIS réutilisé : on refuse (on ne
// crée pas silencieusement un doublon, qui masquerait une corruption de données).

/** Vue minimale d'un Customer Stripe (source : API Stripe, jamais le client). */
export type StripeCustomerView = {
  id: string;
  deleted: boolean;
  metadataUserId: string | null;
} | null;

export type CustomerBinding =
  | { ok: true; action: "reuse"; customerId: string }
  | { ok: true; action: "create"; reason: "no_local_customer" | "not_found" | "deleted" }
  | { ok: false; httpStatus: number; code: string; message: string };

/**
 * Décide s'il faut réutiliser le Customer Stripe connu localement, en créer un nouveau,
 * ou refuser.
 *
 *   aucun customer local            → create (no_local_customer)
 *   customer introuvable chez Stripe → create (not_found)
 *   customer supprimé chez Stripe    → create (deleted)
 *   customer d'un AUTRE utilisateur  → REFUS 409 (corruption : on ne masque pas)
 *   sinon                            → reuse
 *
 * La `metadata.user_id` n'est contrôlée que si elle est présente : un Customer historique
 * créé par Checkout (sans metadata) reste réutilisable, car son id provient déjà d'une ligne
 * `orders` de CET utilisateur — la liaison a été établie côté serveur par le webhook.
 */
export function decideCustomerBinding(input: {
  userId: string;
  existingCustomerId: string | null;
  customer: StripeCustomerView;
}): CustomerBinding {
  if (!input.existingCustomerId) {
    return { ok: true, action: "create", reason: "no_local_customer" };
  }

  if (!input.customer || input.customer.id !== input.existingCustomerId) {
    return { ok: true, action: "create", reason: "not_found" };
  }

  if (input.customer.deleted) {
    return { ok: true, action: "create", reason: "deleted" };
  }

  if (input.customer.metadataUserId !== null && input.customer.metadataUserId !== input.userId) {
    return {
      ok: false,
      httpStatus: 409,
      code: "CUSTOMER_USER_MISMATCH",
      message: "Le compte de facturation rattaché est incohérent. Contactez le support.",
    };
  }

  return { ok: true, action: "reuse", customerId: input.customer.id };
}

// ── Clés d'idempotence (déterministes) ──────────────────────────────────────
//
// Stripe accepte une clé d'idempotence sur les requêtes POST et la conserve 24 h.
// Rejouer la MÊME requête avec la MÊME clé renvoie la réponse d'origine au lieu de créer
// un second objet — c'est ce qui neutralise les double-clics et les retries réseau.

/**
 * Création du Customer : une seule identité de facturation par utilisateur.
 * Deux requêtes concurrentes (double-clic) renvoient le MÊME Customer.
 */
export function customerIdempotencyKey(userId: string): string {
  return `cs-customer:${userId}`;
}

/**
 * Création de la session Checkout : une seule session par (utilisateur, produit, prix).
 *
 * Le prix fait partie de la clé : si le tarif change (ex. bascule EUR→CHF via P10), une
 * NOUVELLE session est légitimement créée au lieu de renvoyer l'ancienne, périmée.
 * Dans la fenêtre de 24 h, un double-clic renvoie la session existante — dont l'URL reste
 * valide, la durée de vie par défaut d'une session Checkout étant elle aussi de 24 h.
 */
export function checkoutIdempotencyKey(input: {
  userId: string;
  agentSlug: string;
  priceId: string;
}): string {
  return `cs-checkout:${input.userId}:${input.agentSlug}:${input.priceId}`;
}

/** Normalise un `Stripe.Customer | Stripe.DeletedCustomer | string` en vue pure. */
export function toCustomerView(raw: unknown): StripeCustomerView {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o["id"] === "string" ? o["id"] : null;
  if (!id) return null;
  const meta = typeof o["metadata"] === "object" && o["metadata"] !== null
    ? (o["metadata"] as Record<string, unknown>)
    : {};
  return {
    id,
    deleted: o["deleted"] === true,
    metadataUserId: typeof meta["user_id"] === "string" ? meta["user_id"] : null,
  };
}
