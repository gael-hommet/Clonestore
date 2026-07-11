// Programme partenaires — emails transactionnels (templates + enqueue + worker).
// Réutilise le provider Resend partagé (sendClonestoryEmail). Enqueue dans la MÊME
// transaction que la mutation métier ; worker claim SKIP LOCKED + backoff + dead-letter.
// Aucun secret/token brut dans payload_safe.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { sendClonestoryEmail } from "@/lib/clonestory/founding-partners/server/emails";

export type PartnerEmailKind =
  | "application_received" | "application_accepted" | "application_rejected"
  | "contract_pending" | "stripe_onboarding_pending" | "partner_activated"
  | "introduction_received" | "client_converted" | "client_active"
  | "commission_recorded" | "commission_available" | "monthly_statement"
  | "transfer_executed" | "transfer_failed" | "partner_suspended";

// ── Templates (HTML inline sombre + version texte) ───────────────────────────

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0a0b0f;color:#e9ecf5;font-family:Inter,Arial,sans-serif;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#12131a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8b84ff">Cabinets Fondateurs CloneStore</div>
    <h1 style="font-size:22px;margin:12px 0 16px;color:#fff">${title}</h1>
    ${bodyHtml}
    <p style="margin-top:24px;font-size:12px;color:#7a8091">CloneStore — Pierre, employé IA RH. Les commissions sont calculées sur les montants HT réellement encaissés et ne sont jamais annoncées comme acquises avant leur statut réel.</p>
  </div></body></html>`;
}
const p = (t: string) => `<p style="font-size:15px;line-height:1.6;color:#c7ccdb;margin:0 0 12px">${t}</p>`;

type Payload = Record<string, unknown>;
const s = (o: Payload, k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");

/** Rendu d'un email partenaire (subject + html + text). Pur, reconstruit depuis payload_safe. */
export function renderPartnerEmail(kind: PartnerEmailKind, payload: Payload): { subject: string; html: string; text: string } {
  switch (kind) {
    case "application_received":
      return { subject: "Votre candidature Cabinet Fondateur est bien reçue", html: shell("Candidature reçue", p("Merci — nous avons bien reçu votre candidature. Notre équipe l'examine et revient vers vous rapidement.")), text: "Votre candidature Cabinet Fondateur est bien reçue. Nous l'examinons et revenons vers vous." };
    case "application_accepted":
      return { subject: "Bienvenue parmi les Cabinets Fondateurs CloneStore", html: shell("Candidature acceptée", p("Félicitations, votre cabinet est accepté. Prochaine étape : accepter le contrat partenaire puis configurer vos versements Stripe.") + p(`Votre espace : ${s(payload, "spaceUrl")}`)), text: `Candidature acceptée. Accédez à votre espace : ${s(payload, "spaceUrl")}` };
    case "application_rejected":
      return { subject: "Suite de votre candidature Cabinet Fondateur", html: shell("Candidature non retenue", p("Après examen, nous ne pouvons pas donner suite à votre candidature pour le moment. Merci de votre intérêt.")), text: "Votre candidature n'a pas été retenue pour le moment." };
    case "stripe_onboarding_pending":
      return { subject: "Terminez la configuration de vos versements", html: shell("Onboarding Stripe à finaliser", p("Pour recevoir vos commissions, finalisez la configuration de votre compte de versement depuis votre espace.")), text: "Finalisez la configuration de vos versements Stripe depuis votre espace." };
    case "partner_activated":
      return { subject: "Votre cabinet est activé", html: shell("Cabinet activé", p("Votre cabinet est désormais actif. Vous pouvez présenter des entreprises et suivre vos commissions.")), text: "Votre cabinet est activé." };
    case "introduction_received":
      return { subject: "Nous avons bien reçu votre mise en relation", html: shell("Mise en relation reçue", p(`Nous avons bien reçu la présentation de « ${s(payload, "companyName")} ». Nous vous tenons informé de son avancement.`)), text: `Mise en relation reçue : ${s(payload, "companyName")}.` };
    case "commission_recorded":
      return { subject: "Une commission a été enregistrée", html: shell("Commission enregistrée", p(`Une commission de ${s(payload, "amount")} a été enregistrée sur une facture réglée. Elle deviendra disponible après le délai de réserve.`)), text: `Commission enregistrée : ${s(payload, "amount")} (disponible après réserve).` };
    case "commission_available":
      return { subject: "Une commission est disponible", html: shell("Commission disponible", p(`Une commission de ${s(payload, "amount")} est désormais disponible et sera incluse dans votre prochain versement.`)), text: `Commission disponible : ${s(payload, "amount")}.` };
    case "monthly_statement":
      return { subject: `Votre relevé mensuel ${s(payload, "period")}`, html: shell(`Relevé ${s(payload, "period")}`, p(`Total des commissions de la période : ${s(payload, "total")}. Détail disponible dans votre espace.`)), text: `Relevé ${s(payload, "period")} : ${s(payload, "total")}.` };
    case "transfer_executed":
      return { subject: "Votre versement a été envoyé", html: shell("Versement envoyé", p(`Un versement de ${s(payload, "amount")} a été transmis vers votre compte pour la période ${s(payload, "period")}.`)), text: `Versement envoyé : ${s(payload, "amount")} (${s(payload, "period")}).` };
    case "transfer_failed":
      return { subject: "Votre versement n'a pas pu être envoyé", html: shell("Versement en échec", p("Un versement n'a pas pu aboutir. Nous le réessaierons automatiquement ; vérifiez la configuration de votre compte si besoin.")), text: "Un versement a échoué et sera réessayé automatiquement." };
    case "partner_suspended":
      return { subject: "Votre partenariat est suspendu", html: shell("Partenariat suspendu", p("Votre partenariat est temporairement suspendu. Contactez-nous pour en connaître les modalités.")), text: "Votre partenariat est suspendu." };
    default:
      return { subject: "Cabinets Fondateurs CloneStore", html: shell("Notification", p("Vous avez une nouvelle notification dans votre espace.")), text: "Nouvelle notification." };
  }
}

// ── Enqueue transactionnel ────────────────────────────────────────────────────

/** Enfile un email dans la MÊME transaction que la mutation métier. Idempotent (clé unique). */
export async function enqueuePartnerEmailTx(
  tx: SqlExecutor,
  input: { partnerId?: string | null; applicationId?: string | null; kind: PartnerEmailKind; toEmail: string; idempotencyKey: string; payload?: Payload },
): Promise<void> {
  const { subject } = renderPartnerEmail(input.kind, input.payload ?? {});
  await tx.query(
    `insert into clonestore_pp_email_outbox (partner_id, application_id, kind, idempotency_key, to_email, subject, payload_safe)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     on conflict (idempotency_key) do nothing`,
    [input.partnerId ?? null, input.applicationId ?? null, input.kind, input.idempotencyKey, input.toEmail, subject, JSON.stringify(input.payload ?? {})],
  );
}

// ── Worker ────────────────────────────────────────────────────────────────────

type OutboxRow = { id: string; kind: PartnerEmailKind; to_email: string; idempotency_key: string; attempts: number; max_attempts: number; payload_safe: Payload };

export type ProcessResult = { claimed: number; sent: number; retried: number; dead: number };

/** Traite l'outbox : claim SKIP LOCKED, envoi, transitions sent / backoff / dead. */
export async function processPartnerEmailOutbox(
  db: SqlExecutor,
  withServiceFn: <T>(db: SqlExecutor, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>,
  limit = 50,
): Promise<ProcessResult> {
  const result: ProcessResult = { claimed: 0, sent: 0, retried: 0, dead: 0 };

  const claimed = await withServiceFn(db, async (tx) => {
    // Récupère les bails abandonnés (> 5 min).
    await tx.query(`update clonestore_pp_email_outbox set status='failed_retryable' where status='sending' and (locked_at is null or locked_at < now() - interval '5 minutes')`);
    const rows = await tx.query<OutboxRow>(
      `update clonestore_pp_email_outbox set status='sending', locked_at=now(), attempts=attempts+1
       where id in (
         select id from clonestore_pp_email_outbox
         where status in ('pending','failed_retryable') and next_attempt_at <= now()
         order by next_attempt_at asc for update skip locked limit $1
       ) returning id, kind, to_email, idempotency_key, attempts, max_attempts, payload_safe`,
      [Math.min(limit, 100)],
    );
    return rows.rows;
  });
  result.claimed = claimed.length;

  for (const job of claimed) {
    const { subject, html, text } = renderPartnerEmail(job.kind, job.payload_safe ?? {});
    try {
      const sent = await sendClonestoryEmail({ to: job.to_email, subject, html, text, idempotencyKey: job.idempotency_key });
      if (sent.ok) {
        await withServiceFn(db, (tx) => tx.query(`update clonestore_pp_email_outbox set status='sent', provider_message_id=$2, updated_at=now() where id=$1`, [job.id, sent.id ?? null]));
        result.sent += 1;
      } else {
        await failJob(db, withServiceFn, job, sent.error ?? "send_failed", result);
      }
    } catch (e) {
      await failJob(db, withServiceFn, job, e instanceof Error ? e.message.slice(0, 200) : "error", result);
    }
  }
  return result;
}

async function failJob(
  db: SqlExecutor,
  withServiceFn: <T>(db: SqlExecutor, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>,
  job: OutboxRow,
  error: string,
  result: ProcessResult,
): Promise<void> {
  const dead = job.attempts >= job.max_attempts;
  const backoffMin = Math.min(60, Math.pow(2, job.attempts));
  await withServiceFn(db, (tx) =>
    tx.query(
      `update clonestore_pp_email_outbox set status=$2, last_error=$3, next_attempt_at=now() + ($4 || ' minutes')::interval, locked_at=null, updated_at=now() where id=$1`,
      [job.id, dead ? "dead" : "failed_retryable", error, String(backoffMin)],
    ),
  );
  if (dead) result.dead += 1; else result.retried += 1;
}
