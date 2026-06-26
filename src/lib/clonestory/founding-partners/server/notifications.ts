// CloneStory — OUTBOX de notifications GÉNÉRALE (SERVER-ONLY, CS-FINAL 4).
//
// Remplace l'envoi DIRECT best-effort (erreur avalée) de tous les emails transactionnels
// NON-vérification : confirmation/refus d'introduction, bienvenue, suspension, retrait,
// révocation de lien. Robuste : écriture transactionnelle, idempotency_key unique, retry
// à backoff, provider_message_id, last_error, dead-letter, reprise admin. AUCUN token brut
// en base : pour la confirmation d'introduction, le worker RECONSTRUIT les liens à partir
// du token d'action STATELESS (générations + expiration en base).

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getClonestoryDb, withService } from "./runtime";
import { publicBaseUrl } from "./config";
import { buildActionToken } from "./action-token";
import {
  renderConfirmIntroductionEmail, renderWelcomeEmail, renderIntroductionConfirmedEmail,
  renderIntroductionRefusedEmail, renderLinkRevokedEmail, renderSimpleNoticeEmail, sendClonestoryEmail,
} from "./emails";
import { recordObservabilityEventTx } from "./observability";

export type NotificationKind =
  | "intro_confirm" | "intro_confirmed_member" | "intro_refused_member" | "welcome"
  | "partner_suspended" | "partner_reinstated" | "partner_withdrawn" | "link_revoked";

/** Enfile une notification (idempotente). À appeler DANS une transaction de service. */
export async function enqueueNotificationTx(tx: SqlExecutor, args: {
  partnerId: string | null; introductionId?: string | null; kind: NotificationKind;
  toEmail: string; idempotencyKey: string; payload?: Record<string, unknown>;
}): Promise<void> {
  const to = (args.toEmail ?? "").trim();
  if (!to) return;
  await tx.query(
    `insert into clonestory_fp_notifications_outbox
       (partner_id, introduction_id, kind, idempotency_key, to_email, payload_safe)
     values ($1,$2,$3,$4,$5,$6::jsonb)
     on conflict (idempotency_key) do nothing`,
    [args.partnerId, args.introductionId ?? null, args.kind, args.idempotencyKey, to, JSON.stringify(args.payload ?? {})],
  );
  await recordObservabilityEventTx(tx, "email_enqueued", { refType: "email", refId: args.idempotencyKey, evidence: { kind: args.kind } });
}

interface NotifRow {
  id: string; kind: NotificationKind; to_email: string; idempotency_key: string;
  introduction_id: string | null; payload_safe: Record<string, unknown>; attempts: number; max_attempts: number;
}

function registryUrl(): string {
  return `${publicBaseUrl()}/founding-partners/my-registry`;
}

/** Reconstruit le rendu d'une notification (liens reconstruits depuis le token stateless). */
async function renderNotification(tx: SqlExecutor, row: NotifRow): Promise<{ subject: string; html: string; text: string } | null> {
  const p = (row.payload_safe ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  switch (row.kind) {
    case "intro_confirm": {
      if (!row.introduction_id) return null;
      const intro = (await tx.query<{ confirm_generation: number; confirm_expires_at: string | null; status: string }>(
        `select confirm_generation, confirm_expires_at, status from clonestory_fp_introductions where id = $1`, [row.introduction_id],
      )).rows[0];
      if (!intro || intro.status !== "declared") return null; // déjà consommée → rien à envoyer
      const expMs = intro.confirm_expires_at ? new Date(intro.confirm_expires_at).getTime() : Date.now() + 14 * 24 * 3600 * 1000;
      const base = publicBaseUrl();
      const confirmToken = buildActionToken("introconfirm", row.introduction_id, Number(intro.confirm_generation), expMs);
      const refuseToken = buildActionToken("introrefuse", row.introduction_id, Number(intro.confirm_generation), expMs);
      const confirmUrl = `${base}/founding-partners/confirm?token=${encodeURIComponent(confirmToken)}`;
      const refuseUrl = `${base}/founding-partners/refuse?token=${encodeURIComponent(refuseToken)}`;
      return renderConfirmIntroductionEmail(str(p.memberName) || "un Membre du Cercle", confirmUrl, refuseUrl);
    }
    case "welcome":
      return renderWelcomeEmail(registryUrl());
    case "intro_confirmed_member":
      return renderIntroductionConfirmedEmail(str(p.prospectCompany) || "une entreprise", registryUrl());
    case "intro_refused_member":
      return renderIntroductionRefusedEmail();
    case "link_revoked":
      return renderLinkRevokedEmail();
    case "partner_suspended":
      return renderSimpleNoticeEmail("Votre accès au Cercle est suspendu",
        "Votre participation au Cercle des Partenaires Fondateurs est temporairement suspendue. Contactez le Cercle pour toute question.");
    case "partner_reinstated":
      return renderSimpleNoticeEmail("Votre accès au Cercle est rétabli",
        "Votre participation au Cercle des Partenaires Fondateurs a été rétablie. Votre registre est de nouveau accessible.", registryUrl());
    case "partner_withdrawn":
      return renderSimpleNoticeEmail("Votre retrait du Cercle est enregistré",
        "Votre retrait du Cercle des Partenaires Fondateurs a été pris en compte. Vos contributions vérifiées éventuelles restent inscrites au registre.");
    default:
      return null;
  }
}

/**
 * Worker de l'outbox de notifications : claim (FOR UPDATE SKIP LOCKED), reconstruit le
 * rendu, envoie (idempotent), transitions avec backoff jusqu'à `dead`. Aucun double envoi,
 * aucune erreur silencieuse (tracée dans last_error + observabilité).
 */
export async function processNotificationsOutbox(limit = 50): Promise<{ processed: number; sent: number; failed: number; dead: number; skipped: number }> {
  const db = await getClonestoryDb();
  const claimed = await withService(db, async (tx) => {
    await tx.query(
      `update clonestory_fp_notifications_outbox set status='failed_retryable', updated_at=now()
        where status='sending' and locked_at < now() - interval '5 minutes'`,
    );
    const { rows } = await tx.query<NotifRow>(
      `select id::text, kind, to_email, idempotency_key, introduction_id::text, payload_safe, attempts, max_attempts
         from clonestory_fp_notifications_outbox
        where status in ('pending','failed_retryable') and next_attempt_at <= now()
        order by next_attempt_at asc for update skip locked limit $1`,
      [limit],
    );
    for (const r of rows) {
      await tx.query(`update clonestory_fp_notifications_outbox set status='sending', locked_at=now(), attempts=attempts+1, updated_at=now() where id=$1`, [r.id]);
    }
    return rows;
  });

  let sent = 0, failed = 0, dead = 0, skipped = 0;
  for (const r of claimed) {
    // Le rendu (et la décision « plus rien à envoyer ») se fait en transaction de service.
    const rendered = await withService(db, (tx) => renderNotification(tx, r));
    if (!rendered) {
      await withService(db, (tx) => tx.query(
        `update clonestory_fp_notifications_outbox set status='superseded', last_error='nothing_to_send', updated_at=now() where id=$1`, [r.id]));
      skipped += 1;
      continue;
    }
    let ok = false, providerId: string | null = null, errMsg: string | null = null;
    try {
      const res = await sendClonestoryEmail({ to: r.to_email, subject: rendered.subject, html: rendered.html, text: rendered.text, idempotencyKey: r.idempotency_key });
      ok = res.ok; providerId = res.id ?? null; errMsg = res.error ?? null;
    } catch (e) {
      ok = false; errMsg = e instanceof Error ? e.message : "send_error";
    }
    await withService(db, async (tx) => {
      if (ok) {
        await tx.query(`update clonestory_fp_notifications_outbox set status='sent', provider_message_id=$2, last_error=null, updated_at=now() where id=$1`, [r.id, providerId]);
        await recordObservabilityEventTx(tx, "email_sent", { refType: "email", refId: r.idempotency_key, evidence: { kind: r.kind } });
        sent += 1;
      } else {
        const attempts = r.attempts + 1;
        const isDead = attempts >= r.max_attempts;
        const backoff = String(Math.min(60, 2 ** attempts));
        await tx.query(
          `update clonestory_fp_notifications_outbox
              set status=$2, last_error=$3, next_attempt_at = now() + ($4 || ' minutes')::interval, updated_at=now()
            where id=$1`,
          [r.id, isDead ? "dead" : "failed_retryable", (errMsg ?? "send_failed").slice(0, 200), backoff],
        );
        if (isDead) { await recordObservabilityEventTx(tx, "email_dead", { refType: "email", refId: r.idempotency_key, level: "error", evidence: { kind: r.kind } }); dead += 1; }
        else failed += 1;
      }
    });
  }
  return { processed: claimed.length, sent, failed, dead, skipped };
}
