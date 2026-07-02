// src/app/api/assistant/support/route.ts
// P9.4.1 — Ouverture d'un cas de support DURABLE (tenant-safe). Le résumé est redigé
// avant stockage (aucune PII cross-tenant). GET liste les cas de l'utilisateur.

import { requireCloneChatUser, ccNoStore } from "@/lib/clonechat/server/auth";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const stores = await getCloneChatStores();
  const cases = await stores.support.listSupportCases(auth.identity, 30);
  return ccNoStore({ ok: true, durable: stores.durable, cases });
}

export async function POST(req: Request) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { summary?: string; title?: string; severity?: "low" | "normal" | "high" | "security" } | null;
  const summary = (body?.summary ?? "").trim();
  if (!summary) return ccNoStore({ ok: false, code: "EMPTY_SUMMARY" }, 400);
  const stores = await getCloneChatStores();
  const at = new Date().toISOString();
  const c = await stores.support.createSupportCase(auth.identity, { title: (body?.title ?? summary).slice(0, 120), summary, severity: body?.severity, at });
  return ccNoStore({ ok: true, durable: stores.durable, case: c });
}
