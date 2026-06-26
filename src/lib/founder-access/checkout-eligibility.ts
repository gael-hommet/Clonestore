// E-R1 §8 — Évaluation PURE de l'éligibilité d'une réservation fondateur au checkout.
// Sans I/O ni confiance client : toutes les conditions sont vérifiées explicitement et
// tout cas invalide renvoie un code d'erreur (jamais d'ignorance silencieuse).

import type { ReservationForActivation } from "./store";
import type { FounderPhase } from "./commercial";

export type CheckoutEligibility =
  | { ok: true; reservationId: string }
  | { ok: false; code: string; message: string };

export function evaluateFounderCheckout(args: {
  reservation: ReservationForActivation | null;
  phase: FounderPhase;
  userId: string;
  userEmailNormalized: string | null;
}): CheckoutEligibility {
  if (args.phase !== "launched") {
    return { ok: false, code: "FOUNDER_WINDOW_CLOSED", message: "L'accès fondateur n'est pas ouvert actuellement." };
  }
  if (!args.userEmailNormalized) {
    return { ok: false, code: "FOUNDER_EMAIL_UNKNOWN", message: "Compte sans adresse email vérifiable." };
  }
  const r = args.reservation;
  if (!r) return { ok: false, code: "FOUNDER_RESERVATION_NOT_FOUND", message: "Réservation introuvable." };
  if (r.unsubscribed) return { ok: false, code: "FOUNDER_RESERVATION_UNSUBSCRIBED", message: "Réservation désinscrite." };
  if (!r.verified) return { ok: false, code: "FOUNDER_EMAIL_NOT_CONFIRMED", message: "Email de réservation non confirmé." };
  if (r.email_normalized !== args.userEmailNormalized) {
    return { ok: false, code: "FOUNDER_EMAIL_MISMATCH", message: "L'email de la réservation ne correspond pas au compte." };
  }
  if (r.user_id && r.user_id !== args.userId) {
    return { ok: false, code: "FOUNDER_RESERVATION_CLAIMED", message: "Réservation déjà rattachée à un autre compte." };
  }
  return { ok: true, reservationId: r.id };
}
