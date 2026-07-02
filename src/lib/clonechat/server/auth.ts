// src/lib/clonechat/server/auth.ts
// P9.4.1 — Résolution d'identité SERVER-ONLY partagée par les routes CloneChat. Le
// serveur reste l'autorité : flag produit + auth Supabase (bearer ou cookie). Le tenant
// (companyId) est le userId (modèle V0) — jamais accepté du corps de requête.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isCloneChatEnabled } from "@/lib/features/product-availability";

export interface CloneChatIdentity { readonly userId: string; readonly companyId: string; }

function bearer(req: Request): string | null {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function ccNoStore(json: unknown, status = 200) {
  return NextResponse.json(json, { status, headers: { "Cache-Control": "no-store" } });
}

/** Résout l'utilisateur ; renvoie soit l'identité, soit une réponse d'erreur prête. */
export async function requireCloneChatUser(req: Request): Promise<{ identity: CloneChatIdentity } | { error: NextResponse }> {
  if (!isCloneChatEnabled()) return { error: ccNoStore({ ok: false, code: "CLONECHAT_DISABLED" }, 503) };
  try {
    const supabase = await supabaseServer();
    const token = bearer(req);
    const { data } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    if (!userId) return { error: ccNoStore({ ok: false, code: "AUTH_REQUIRED", error: "Connexion requise." }, 401) };
    return { identity: { userId, companyId: userId } };
  } catch {
    return { error: ccNoStore({ ok: false, code: "AUTH_ERROR", error: "Session invalide." }, 401) };
  }
}
