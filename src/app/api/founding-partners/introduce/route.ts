// CloneStory — « Faire une introduction » (POST, membre authentifié).
// Crée une introduction (declared) et envoie au prospect la demande de confirmation.

import { NextResponse } from "next/server";
import { rateLimit, readJsonBounded, getClientIp } from "@/lib/founder-access/request-utils";
import { createIntroduction } from "@/lib/clonestory/founding-partners/server/store";
import { readMemberSession } from "@/lib/clonestory/founding-partners/server/session";
import { getClonestoryDb, withPartner } from "@/lib/clonestory/founding-partners/server/runtime";
import { processNotificationsOutbox } from "@/lib/clonestory/founding-partners/server/notifications";
import { devAffordancesAllowed } from "@/lib/clonestory/founding-partners/server/config";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req: Request) {
  const partnerId = readMemberSession(req.headers.get("cookie"));
  if (!partnerId) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401, headers: NO_STORE });

  const ip = getClientIp(req);
  if (!rateLimit(`csy-introduce:${partnerId}:${ip ?? ""}`, 20, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body || body.confirmKnown !== true) {
    return NextResponse.json({ ok: false, error: "confirmation_required" }, { status: 422, headers: NO_STORE });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : null);

  // Nom du membre (pour le message de confirmation au prospect).
  const memberName = await withPartner(await getClonestoryDb(), partnerId, async (tx) => {
    const { rows } = await tx.query<{ display_name: string }>(`select display_name from clonestory_fp_partners where id = $1`, [partnerId]);
    return rows[0]?.display_name ?? "un Membre du Cercle";
  });

  const result = await createIntroduction(partnerId, {
    prospectFirstName: str(body.prospectFirstName),
    prospectCompany: str(body.prospectCompany) ?? "",
    prospectEmail: str(body.prospectEmail) ?? "",
    note: str(body.note),
    method: "declared",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422, headers: NO_STORE });
  }
  void memberName; // le nom du membre est porté dans la charge de l'outbox (rendu par le worker)

  // L'email prospect est DÉJÀ enfilé transactionnellement dans createIntroduction (outbox
  // robuste, retry, traçabilité). On déclenche le worker INLINE (best-effort) pour un envoi
  // prompt ; le cron de notifications reste le filet de reprise. Aucun envoi direct fragile.
  try {
    await processNotificationsOutbox(5);
  } catch {
    /* le cron reprendra */
  }

  const origin = new URL(req.url).origin;
  const dev = devAffordancesAllowed()
    ? {
        devConfirmUrl: `${origin}/founding-partners/confirm?token=${encodeURIComponent(result.confirmToken)}`,
        devRefuseUrl: `${origin}/founding-partners/refuse?token=${encodeURIComponent(result.refuseToken)}`,
      }
    : {};
  return NextResponse.json({ ok: true, ...dev }, { headers: NO_STORE });
}
