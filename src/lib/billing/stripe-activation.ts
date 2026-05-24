// src/lib/billing/stripe-activation.ts
// B31.7 — Pure helpers for Stripe activation logic. No side effects, no DB, no network.

export type ActivationStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete_expired"
  | "paused"
  | "none";

export const ACTIVE_STATUSES: readonly ActivationStatus[] = ["active", "trialing"];
export const INACTIVE_STATUSES: readonly ActivationStatus[] = [
  "canceled",
  "unpaid",
  "incomplete_expired",
];

// Expected Pierre price in cents (449.00 EUR)
export const EXPECTED_PIERRE_PRICE_AMOUNT = 44900;
export const TRIAL_PERIOD_DAYS = 7;

export function isAccessGranted(status: ActivationStatus | string): boolean {
  return ACTIVE_STATUSES.includes(status as ActivationStatus);
}

export function isAccessRevoked(status: ActivationStatus | string): boolean {
  return INACTIVE_STATUSES.includes(status as ActivationStatus);
}

// Maps checkout.session.completed payment_status to an activation status.
// For subscription mode:
//   - "paid" → subscription is "active" (no trial)
//   - "no_payment_required" → subscription is "trialing" (trial active)
export function mapPaymentStatusToActivation(
  paymentStatus: string | null
): ActivationStatus {
  if (paymentStatus === "paid") return "active";
  if (paymentStatus === "no_payment_required") return "trialing";
  return "none";
}

// Maps Stripe subscription.status directly to ActivationStatus.
export function mapSubscriptionStatus(status: string | null): ActivationStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled") return "canceled";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "incomplete_expired") return "incomplete_expired";
  if (status === "paused") return "paused";
  return "none";
}

// Safely extracts user_id and agent_slug from a metadata object.
export function extractActivationMetadata(obj: Record<string, unknown>): {
  user_id: string | null;
  agent_slug: string | null;
} {
  const meta = obj["metadata"];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { user_id: null, agent_slug: null };
  }
  const m = meta as Record<string, unknown>;
  return {
    user_id: typeof m["user_id"] === "string" ? m["user_id"] : null,
    agent_slug: typeof m["agent_slug"] === "string" ? m["agent_slug"] : null,
  };
}

export type CheckoutSessionValidation = {
  valid: boolean;
  reason?: string;
  user_id: string | null;
  agent_slug: string | null;
  subscription_id: string | null;
  status: ActivationStatus;
};

// Validates a checkout.session.completed object for activation.
// Accepts both "paid" (immediate subscription) and "no_payment_required" (trial).
export function validateCheckoutSession(
  session: Record<string, unknown>
): CheckoutSessionValidation {
  const base: CheckoutSessionValidation = {
    valid: false,
    user_id: null,
    agent_slug: null,
    subscription_id: null,
    status: "none",
  };

  const mode = session["mode"];
  if (mode !== "subscription") {
    return { ...base, reason: "Not a subscription checkout" };
  }

  const subscription_id =
    typeof session["subscription"] === "string" ? session["subscription"] : null;
  if (!subscription_id) {
    return { ...base, reason: "No subscription ID on checkout session" };
  }

  const { user_id, agent_slug } = extractActivationMetadata(session);
  if (!user_id || !agent_slug) {
    return {
      ...base,
      subscription_id,
      reason: "Missing user_id or agent_slug in session metadata",
    };
  }

  const payment_status =
    typeof session["payment_status"] === "string" ? session["payment_status"] : null;

  // Accept "paid" (active subscription) or "no_payment_required" (trial)
  if (payment_status !== "paid" && payment_status !== "no_payment_required") {
    return {
      ...base,
      user_id,
      agent_slug,
      subscription_id,
      reason: `Unexpected payment_status: ${payment_status}`,
    };
  }

  const status = mapPaymentStatusToActivation(payment_status);

  return { valid: true, user_id, agent_slug, subscription_id, status };
}

// Checks if a Stripe price amount matches the expected Pierre price.
export function isPierrePriceAmountValid(unitAmount: number | null): boolean {
  if (unitAmount === null) return false;
  return unitAmount === EXPECTED_PIERRE_PRICE_AMOUNT;
}
