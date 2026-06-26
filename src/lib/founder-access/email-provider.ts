// Phase E — Founder Access : abstraction d'envoi email (serveur uniquement).
// Réutilise Resend (déjà présent dans le repo) en production via variables d'env.
// Mode local explicite et signalé. JAMAIS de faux succès en production.

import { DEMO_LAUNCH_LABEL, FOUNDER_CLOSE_LABEL, FOUNDER_PRICE_MONTHLY } from "./commercial";

export interface FounderEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** E-R2 §7 — clé d'idempotence stable transmise au fournisseur (dédup côté provider). */
  idempotencyKey?: string;
}

export interface EmailSendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** clé d'idempotence réellement transmise (traçabilité). */
  idempotencyKey?: string;
  /** mode effectif : 'resend' (prod réel) | 'local' (journalisé, non envoyé). */
  mode: "resend" | "local";
}

export interface FounderEmailProvider {
  readonly mode: "resend" | "local";
  send(msg: FounderEmailMessage): Promise<EmailSendResult>;
}

const FROM = process.env.CLONESTORE_FOUNDER_EMAIL_FROM ?? "CloneStore <fondateur@clonestore.pro>";

class ResendProvider implements FounderEmailProvider {
  readonly mode = "resend" as const;
  constructor(private apiKey: string) {}
  async send(msg: FounderEmailMessage): Promise<EmailSendResult> {
    try {
      const { Resend } = await import("resend");
      const client = new Resend(this.apiKey);
      // §7 — la clé d'idempotence est transmise au contrat Resend (options.idempotencyKey).
      // Retries → même clé → un seul envoi logique côté provider (best-effort selon le provider).
      const options = msg.idempotencyKey ? { idempotencyKey: msg.idempotencyKey } : undefined;
      const res = await client.emails.send({
        from: FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }, options);
      if (res.error) return { ok: false, error: res.error.message, mode: "resend", idempotencyKey: msg.idempotencyKey };
      return { ok: true, id: res.data?.id, mode: "resend", idempotencyKey: msg.idempotencyKey };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "send_failed", mode: "resend", idempotencyKey: msg.idempotencyKey };
    }
  }
}

/** Mode local : journalise, n'envoie rien. Interdit en production (voir resolver). */
class LocalLogProvider implements FounderEmailProvider {
  readonly mode = "local" as const;
  async send(msg: FounderEmailMessage): Promise<EmailSendResult> {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info(`[founder-email:LOCAL] to=${msg.to} subject=${JSON.stringify(msg.subject)} (non envoyé)`);
    }
    return { ok: true, mode: "local", idempotencyKey: msg.idempotencyKey };
  }
}

/**
 * Résout le fournisseur. En production sans RESEND_API_KEY → throw (jamais de faux
 * succès). En dev sans clé → mode local explicite.
 */
export function resolveFounderEmailProvider(): FounderEmailProvider {
  const key = process.env.RESEND_API_KEY;
  if (key) return new ResendProvider(key);
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_API_KEY manquant : envoi email fondateur impossible en production.");
  }
  return new LocalLogProvider();
}

export function isFounderEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// ── Rendu des emails (identité CloneStore) ──────────────────────────────────

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f5eee2;font-family:Inter,Segoe UI,sans-serif;color:#151922">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1px solid #e8d7bd;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 18px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8a95a5;font-weight:700">CloneStore</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#151922">${title}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#8a95a5">${FOUNDER_PRICE_MONTHLY} — tarif conservé tant que l'abonnement reste actif après activation.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function renderVerificationEmail(verifyUrl: string): { html: string; text: string } {
  const html = shell(
    "Confirmez votre réservation de Pierre",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#29313d">Merci d'avoir réservé Pierre, l'employé IA RH de CloneStore. Confirmez votre adresse pour recevoir votre accès à l'activation.</p>
     <p style="margin:0 0 20px"><a href="${verifyUrl}" style="display:inline-block;background:#6b63e8;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">Confirmer mon adresse email</a></p>
     <p style="margin:0;font-size:13px;color:#5c6675">Aucun paiement aujourd'hui. Ouverture des activations le ${DEMO_LAUNCH_LABEL}. Accès fondateur jusqu'au ${FOUNDER_CLOSE_LABEL}.</p>`,
  );
  const text = `Confirmez votre réservation de Pierre.\nConfirmez votre email : ${verifyUrl}\nAucun paiement aujourd'hui. Ouverture le ${DEMO_LAUNCH_LABEL}. ${FOUNDER_PRICE_MONTHLY}.`;
  return { html, text };
}

// ── Emails programmés (séquence commerciale, ton professionnel, sans fausse urgence) ─
import type { FounderEmailKind } from "./email-sequence";

interface ScheduledCopy { title: string; body: string; cta: string }

const SCHEDULED_COPY: Record<Exclude<FounderEmailKind, "verification">, ScheduledCopy> = {
  j5_before_launch:    { title: "Pierre ouvre ses accès dans 5 jours", body: `Les activations de l'accès fondateur ouvrent le ${DEMO_LAUNCH_LABEL}. Vous serez parmi les premiers à pouvoir activer Pierre.`, cta: "Revoir Pierre" },
  j2_before_launch:    { title: "J-2 avant l'ouverture de Pierre", body: `Plus que deux jours avant l'ouverture des activations, le ${DEMO_LAUNCH_LABEL}.`, cta: "Revoir Pierre" },
  j1_before_launch:    { title: "Demain : ouverture des activations", body: `Demain, le ${DEMO_LAUNCH_LABEL}, vous pourrez activer Pierre au tarif fondateur.`, cta: "Revoir Pierre" },
  launch_open:         { title: "Pierre est disponible", body: `Vous pouvez maintenant activer Pierre au tarif fondateur. Le tarif est conservé tant que l'abonnement reste actif.`, cta: "Activer Pierre" },
  post_launch_followup:{ title: "Votre accès fondateur vous attend", body: `Votre réservation reste active. Activez Pierre quand vous êtes prêt, avant la fermeture de l'accès fondateur.`, cta: "Activer Pierre" },
  j14_before_close:    { title: "14 jours avant la fermeture", body: `L'accès fondateur ferme le ${FOUNDER_CLOSE_LABEL}. Au-delà, le tarif fondateur n'est plus garanti.`, cta: "Activer Pierre" },
  j5_before_close:     { title: "J-5 avant la fermeture", body: `Il reste 5 jours pour activer Pierre au tarif fondateur, jusqu'au ${FOUNDER_CLOSE_LABEL}.`, cta: "Activer Pierre" },
  j1_before_close:     { title: "Demain : fermeture de l'accès fondateur", body: `L'accès fondateur ferme demain, le ${FOUNDER_CLOSE_LABEL}.`, cta: "Activer Pierre" },
  close:              { title: "L'accès fondateur ferme ce soir", body: `Dernière journée pour activer Pierre au tarif fondateur.`, cta: "Activer Pierre" },
};

export function renderScheduledEmail(
  kind: Exclude<FounderEmailKind, "verification">,
  links: { actionUrl: string; unsubscribeUrl?: string | null },
): { html: string; text: string } {
  const c = SCHEDULED_COPY[kind];
  const unsub = links.unsubscribeUrl
    ? `<p style="margin:18px 0 0;font-size:11px;color:#b0b8c4"><a href="${links.unsubscribeUrl}" style="color:#b0b8c4">Se désinscrire</a></p>`
    : "";
  const html = shell(
    c.title,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#29313d">${c.body}</p>
     <p style="margin:0 0 8px"><a href="${links.actionUrl}" style="display:inline-block;background:#6b63e8;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">${c.cta}</a></p>${unsub}`,
  );
  const text = `${c.title}\n\n${c.body}\n\n${c.cta} : ${links.actionUrl}${links.unsubscribeUrl ? `\n\nSe désinscrire : ${links.unsubscribeUrl}` : ""}`;
  return { html, text };
}
