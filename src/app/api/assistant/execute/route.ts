// src/app/api/assistant/execute/route.ts
// P9.4.2 — Garde d'IDEMPOTENCE DURABLE cross-session/instance pour les actions
// effectives. Le client RÉSERVE (claim) une action avant de l'exécuter, puis CONFIRME
// (commit) après succès, ou LIBÈRE (fail) après échec. Le fingerprint est calculé
// CÔTÉ SERVEUR à partir de l'identité résolue (vraie entreprise + user) — le client ne
// peut pas usurper le tenant. no-store.

import { requireCloneChatUser, ccNoStore } from "@/lib/clonechat/server/auth";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { actionFingerprint } from "@/lib/clonechat/durable/idempotency-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body { op?: "claim" | "commit" | "fail"; kind?: string; key?: string; fingerprint?: string; result?: unknown; }

export async function POST(req: Request) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as Body | null;
  const op = body?.op;
  const stores = await getCloneChatStores();
  const { companyId, userId } = auth.identity;

  if (op === "claim") {
    const kind = String(body?.kind ?? "").trim();
    const key = String(body?.key ?? "").trim();
    if (!kind || !key) return ccNoStore({ ok: false, code: "BAD_REQUEST" }, 400);
    const fingerprint = actionFingerprint(companyId, userId, kind, key, new Date().toISOString());
    const status = await stores.idempotency.claim(fingerprint, { companyId, userId, kind });
    return ccNoStore({ ok: true, durable: stores.durable, fingerprint, status });
  }
  if (op === "commit") {
    const fp = String(body?.fingerprint ?? "").trim();
    if (!fp) return ccNoStore({ ok: false, code: "BAD_REQUEST" }, 400);
    await stores.idempotency.commit(fp, body?.result);
    return ccNoStore({ ok: true });
  }
  if (op === "fail") {
    const fp = String(body?.fingerprint ?? "").trim();
    if (!fp) return ccNoStore({ ok: false, code: "BAD_REQUEST" }, 400);
    await stores.idempotency.fail(fp);
    return ccNoStore({ ok: true });
  }
  return ccNoStore({ ok: false, code: "BAD_OP" }, 400);
}
