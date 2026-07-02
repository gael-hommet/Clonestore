// src/app/api/assistant/conversations/[id]/route.ts
// P9.4.1 — Une conversation durable : GET son historique paginé (reprise multi-device),
// PATCH (renommer / archiver), DELETE (suppression). Ownership/RLS appliqués côté store.

import { requireCloneChatUser, ccNoStore } from "@/lib/clonechat/server/auth";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const stores = await getCloneChatStores();
  const conv = await stores.conversations.getConversation(id, auth.identity);
  if (!conv) return ccNoStore({ ok: false, code: "NOT_FOUND" }, 404);
  const messages = await stores.conversations.getMessages(id, auth.identity, { limit: 200 });
  return ccNoStore({ ok: true, durable: stores.durable, conversation: conv, messages });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { title?: string; archived?: boolean } | null;
  const stores = await getCloneChatStores();
  const at = new Date().toISOString();
  if (typeof body?.title === "string") await stores.conversations.renameConversation(id, auth.identity, body.title, at);
  if (body?.archived === true) await stores.conversations.archiveConversation(id, auth.identity, at);
  const conv = await stores.conversations.getConversation(id, auth.identity);
  return ccNoStore({ ok: true, conversation: conv });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const stores = await getCloneChatStores();
  await stores.conversations.deleteConversation(id, auth.identity);
  return ccNoStore({ ok: true });
}
