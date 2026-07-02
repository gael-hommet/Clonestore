// src/app/api/assistant/conversations/route.ts
// P9.4.1 — Conversations DURABLES (multi-device). GET liste les conversations de
// l'utilisateur (vérité serveur, pas localStorage) ; POST en crée une. Tenant résolu
// serveur ; isolation RLS/ownership. no-store.

import { requireCloneChatUser, ccNoStore } from "@/lib/clonechat/server/auth";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const stores = await getCloneChatStores();
  const list = await stores.conversations.listConversations(auth.identity, { limit: 40 });
  return ccNoStore({ ok: true, durable: stores.durable, conversations: list });
}

export async function POST(req: Request) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { title?: string } | null;
  const stores = await getCloneChatStores();
  const conv = await stores.conversations.createConversation(auth.identity, { title: body?.title, at: new Date().toISOString() });
  return ccNoStore({ ok: true, durable: stores.durable, conversation: conv });
}
