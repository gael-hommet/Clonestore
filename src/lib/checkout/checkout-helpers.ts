// src/lib/checkout/checkout-helpers.ts
// Pure client-side helpers for checkout auth contract.
// No Stripe, no Supabase imports — fully testable without mocking.

// ── Agent slug normalization ─────────────────────────────────────

export function normalizeAgentSlug(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  return slug || null;
}

// ── Checkout request body ────────────────────────────────────────
// user_id is intentionally absent — server derives it from Bearer token.

export function buildCheckoutBody(agentSlug: string): { agent_slug: string } {
  return { agent_slug: agentSlug };
}

// ── Authorization headers ────────────────────────────────────────
// Returns null when no token — caller must treat as AUTH_REQUIRED.
// Token goes in Authorization header only: never in URL, never in body.

export function buildCheckoutAuthHeaders(token: string | null): Record<string, string> | null {
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Confirm request body ─────────────────────────────────────────
// user_id is intentionally absent — server derives it from Bearer token.
// session_id comes from the URL (set by Stripe after payment).

export function buildConfirmBody(
  sessionId: string,
  agentSlug: string
): { session_id: string; agent_slug: string } {
  return { session_id: sessionId, agent_slug: agentSlug };
}

// ── Error sanitization ───────────────────────────────────────────
// Converts technical API error codes/messages to user-friendly strings.
// The raw "Missing user_id/agent_slug" must never reach the user.

export function sanitizeCheckoutError(
  code: string | null | undefined,
  message: string | null | undefined,
): string {
  const lower = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (
    lower.includes("stripe_not_configured") ||
    lower.includes("price_not_configured") ||
    lower.includes("stripe_secret_key") ||
    lower.includes("missing stripe")
  ) {
    return "Le paiement n'est pas encore configuré sur cet environnement.";
  }

  if (
    lower.includes("auth_required") ||
    lower.includes("auth_invalid") ||
    lower.includes("auth session missing") ||
    lower.includes("missing user_id") ||
    lower.includes("connexion requise")
  ) {
    return "Connexion requise pour continuer le paiement.";
  }

  if (
    lower.includes("agent_slug_required") ||
    lower.includes("agent_slug") ||
    lower.includes("employé ia introuvable")
  ) {
    return "Employé IA introuvable. Veuillez sélectionner un agent valide.";
  }

  if (
    lower.includes("checkout_not_confirmed") ||
    lower.includes("checkout_not_subscription") ||
    lower.includes("subscription_not_active") ||
    lower.includes("subscription_missing")
  ) {
    return "Le paiement n'a pas encore été confirmé. Réessayez dans quelques secondes.";
  }

  if (
    lower.includes("session_user_mismatch") ||
    lower.includes("session_agent_mismatch") ||
    lower.includes("session not found") ||
    lower.includes("session_not_found")
  ) {
    return "La session de paiement est introuvable ou ne correspond pas à votre compte.";
  }

  if (message) return message;
  return "Une erreur est survenue. Veuillez réessayer.";
}
