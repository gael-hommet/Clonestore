// Phase E — Founder Access : machine d'état stricte de la réservation.

import type { ReservationStatus } from "./types";

/** Transitions autorisées. Toute transition absente est interdite. */
const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  started: ["email_to_confirm", "unsubscribed", "expired"],
  email_to_confirm: ["confirmed", "email_to_confirm", "unsubscribed", "expired"],
  confirmed: ["qualified", "strong_intent", "activation_sent", "unsubscribed", "expired"],
  qualified: ["strong_intent", "activation_sent", "unsubscribed", "expired"],
  strong_intent: ["qualified", "activation_sent", "unsubscribed", "expired"],
  activation_sent: ["activation_started", "active_client", "unsubscribed", "expired"],
  activation_started: ["active_client", "activation_sent", "unsubscribed", "expired"],
  active_client: ["unsubscribed"], // un client actif n'expire pas via le funnel
  expired: ["email_to_confirm", "confirmed", "activation_sent"], // réouverture possible (réservation tardive)
  unsubscribed: [],
};

export class ReservationTransitionError extends Error {
  code = "illegal_reservation_transition" as const;
  constructor(public from: ReservationStatus, public to: ReservationStatus) {
    super(`Transition de réservation interdite : ${from} → ${to}`);
  }
}

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  if (from === to) return true; // idempotent
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!canTransition(from, to)) throw new ReservationTransitionError(from, to);
}

/** Statuts considérés comme "client payant actif" (jamais relancés pour activation). */
export function isActiveClient(status: ReservationStatus): boolean {
  return status === "active_client";
}

/** Statuts qui ne doivent plus recevoir d'emails de séquence. */
export function isEmailSuppressed(status: ReservationStatus): boolean {
  return status === "unsubscribed";
}
