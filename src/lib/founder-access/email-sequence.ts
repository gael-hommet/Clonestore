// Phase E — Founder Access : séquence email programmée (heure de Paris).
// Définitions PURES ; l'envoi réel + l'idempotence sont gérés par la file de jobs.

export type FounderEmailKind =
  | "verification"
  | "j5_before_launch"
  | "j2_before_launch"
  | "j1_before_launch"
  | "launch_open"
  | "post_launch_followup"
  | "j14_before_close"
  | "j5_before_close"
  | "j1_before_close"
  | "close";

export interface ScheduledEmail {
  kind: FounderEmailKind;
  /** Date d'envoi prévue (ISO, fuseau Europe/Paris encodé via offset). null = immédiat. */
  sendAtIso: string | null;
  subject: string;
  /** Suppose une réservation confirmée (sauf la vérification). */
  requiresConfirmed: boolean;
  /** Ne pas envoyer à un client déjà actif. */
  skipIfActiveClient: boolean;
}

// Offset été Paris = +02:00 (toutes ces dates sont en heure d'été).
export const FOUNDER_EMAIL_SCHEDULE: ScheduledEmail[] = [
  { kind: "verification", sendAtIso: null, subject: "Confirmez votre réservation de Pierre", requiresConfirmed: false, skipIfActiveClient: false },
  { kind: "j5_before_launch", sendAtIso: "2026-07-17T09:00:00+02:00", subject: "Pierre ouvre ses accès dans 5 jours", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j2_before_launch", sendAtIso: "2026-07-20T09:00:00+02:00", subject: "J-2 avant l'ouverture de Pierre", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j1_before_launch", sendAtIso: "2026-07-21T09:00:00+02:00", subject: "Demain : ouverture des activations de Pierre", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "launch_open", sendAtIso: "2026-07-22T08:00:00+02:00", subject: "Pierre est disponible : activez votre accès fondateur", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "post_launch_followup", sendAtIso: "2026-07-24T09:00:00+02:00", subject: "Votre accès fondateur Pierre vous attend", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j14_before_close", sendAtIso: "2026-08-17T09:00:00+02:00", subject: "Accès fondateur : 14 jours avant la fermeture", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j5_before_close", sendAtIso: "2026-08-26T09:00:00+02:00", subject: "J-5 avant la fermeture de l'accès fondateur", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j1_before_close", sendAtIso: "2026-08-30T09:00:00+02:00", subject: "Demain : fermeture de l'accès fondateur", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "close", sendAtIso: "2026-08-31T20:00:00+02:00", subject: "L'accès fondateur ferme ce soir", requiresConfirmed: true, skipIfActiveClient: true },
];

/** Identifiant idempotent d'un job email (un seul envoi par réservation × type). */
export function emailJobKey(reservationId: string, kind: FounderEmailKind): string {
  return `${reservationId}:${kind}`;
}

/** Emails programmés dus à `now` (hors envoi immédiat de vérification). */
export function dueScheduledEmails(now: Date = new Date()): ScheduledEmail[] {
  const t = now.getTime();
  return FOUNDER_EMAIL_SCHEDULE.filter((e) => e.sendAtIso !== null && new Date(e.sendAtIso).getTime() <= t);
}
