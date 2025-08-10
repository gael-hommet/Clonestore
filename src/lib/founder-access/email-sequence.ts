// Phase E — Founder Access : séquence email programmée (heure de Paris).
// Définitions PURES ; l'envoi réel + l'idempotence sont gérés par la file de jobs.

import { DEMO_LAUNCH_ISO, FOUNDER_CLOSE_ISO } from "@/lib/demo/presentation/commercial-state";

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

// Toute la séquence DÉRIVE des dates canoniques (commercial-state) : changer la date de lancement
// (DEMO_LAUNCH_ISO) ou de fermeture (FOUNDER_CLOSE_ISO) propage automatiquement le calendrier — aucune
// date de lancement n'est dupliquée en dur ici. La fenêtre est entièrement en heure d'été Paris (CEST, +02:00).
const PARIS_SUMMER_OFFSET_MS = 2 * 60 * 60 * 1000;
/** ISO d'envoi à `deltaDays` d'une date canonique `baseIso`, à `hour` h (heure de Paris, +02:00). */
function scheduleAt(baseIso: string, deltaDays: number, hour: number): string {
  const wall = new Date(new Date(baseIso).getTime() + deltaDays * 86_400_000 + PARIS_SUMMER_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${wall.getUTCFullYear()}-${p(wall.getUTCMonth() + 1)}-${p(wall.getUTCDate())}T${p(hour)}:00:00+02:00`;
}

export const FOUNDER_EMAIL_SCHEDULE: ScheduledEmail[] = [
  { kind: "verification", sendAtIso: null, subject: "Confirmez votre réservation de Pierre", requiresConfirmed: false, skipIfActiveClient: false },
  { kind: "j5_before_launch", sendAtIso: scheduleAt(DEMO_LAUNCH_ISO, -5, 9), subject: "Pierre est lancé dans 5 jours", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j2_before_launch", sendAtIso: scheduleAt(DEMO_LAUNCH_ISO, -2, 9), subject: "J-2 avant le lancement de Pierre", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j1_before_launch", sendAtIso: scheduleAt(DEMO_LAUNCH_ISO, -1, 9), subject: "Demain : lancement officiel de Pierre", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "launch_open", sendAtIso: scheduleAt(DEMO_LAUNCH_ISO, 0, 8), subject: "Pierre est disponible : activez votre accès fondateur", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "post_launch_followup", sendAtIso: scheduleAt(DEMO_LAUNCH_ISO, 2, 9), subject: "Votre accès fondateur Pierre vous attend", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j14_before_close", sendAtIso: scheduleAt(FOUNDER_CLOSE_ISO, -14, 9), subject: "Accès fondateur : 14 jours avant la fermeture", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j5_before_close", sendAtIso: scheduleAt(FOUNDER_CLOSE_ISO, -5, 9), subject: "J-5 avant la fermeture de l'accès fondateur", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "j1_before_close", sendAtIso: scheduleAt(FOUNDER_CLOSE_ISO, -1, 9), subject: "Demain : fermeture de l'accès fondateur", requiresConfirmed: true, skipIfActiveClient: true },
  { kind: "close", sendAtIso: scheduleAt(FOUNDER_CLOSE_ISO, 0, 20), subject: "L'accès fondateur ferme ce soir", requiresConfirmed: true, skipIfActiveClient: true },
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
