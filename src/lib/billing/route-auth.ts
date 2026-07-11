// src/lib/billing/route-auth.ts
// Authentification serveur partagée des routes de facturation.
// user_id est TOUJOURS dérivé du Bearer validé côté serveur — jamais du body.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrderAdminClient } from "./order-activation";

const NO_STORE = { "cache-control": "private, no-store" };

export type BillingAuth =
  | { ok: true; userId: string; email: string | null; admin: SupabaseClient }
  | { ok: false; response: NextResponse };

function fail(status: number, code: string, error: string): NextResponse {
  return NextResponse.json({ ok: false, code, error }, { status, headers: NO_STORE });
}

function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

/** Résout l'identité serveur depuis le Bearer. Renvoie une réponse d'erreur prête sinon. */
export async function authenticateBilling(req: Request): Promise<BillingAuth> {
  const token = readBearer(req);
  if (!token) return { ok: false, response: fail(401, "AUTH_REQUIRED", "Authentification requise.") };

  let admin: SupabaseClient;
  try {
    admin = createOrderAdminClient();
  } catch {
    return { ok: false, response: fail(503, "BACKEND_NOT_CONFIGURED", "Service indisponible.") };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, response: fail(401, "AUTH_INVALID", "Session invalide ou expirée.") };
  }
  return { ok: true, userId: data.user.id, email: data.user.email ?? null, admin };
}

export { NO_STORE };
