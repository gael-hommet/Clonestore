// src/lib/clonechat/server/auth.ts
// P9.4.2 (round 2) — Résolution d'identité + TENANT FAIL-CLOSED partagée par les routes
// CloneChat. Le serveur reste l'autorité : flag produit + auth Supabase (bearer/cookie) +
// résolution de la VRAIE entreprise (membership V1, lecture seule). Aucune entreprise
// réelle → refus STRUCTURÉ, jamais un tenant fabriqué (sauf flag local/test explicite).

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import { resolveCloneChatCompany, type ResolvedTenantRefusal } from "./company";

export interface CloneChatIdentity {
  readonly userId: string;
  /** VRAIE entreprise (membership V1) ; en repli explicite : `u:<id>`. Résolue serveur. */
  readonly companyId: string;
  readonly role: string;
  readonly siteIds: string[];
  /** true = entreprise réelle ; false = repli par-utilisateur (flag explicite). */
  readonly realCompany: boolean;
}

function bearer(req: Request): string | null {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function ccNoStore(json: unknown, status = 200) {
  return NextResponse.json(json, { status, headers: { "Cache-Control": "no-store" } });
}

/** Réponse de refus tenant (fail-closed). COMPANY_UNAVAILABLE = 503 ; autres = 200 structuré. */
export function tenantRefusalResponse(t: ResolvedTenantRefusal): NextResponse {
  if (t.code === "COMPANY_UNAVAILABLE") {
    return ccNoStore({ ok: false, code: "COMPANY_UNAVAILABLE", error: "Service momentanément indisponible. Réessayez." }, 503);
  }
  const message =
    t.code === "COMPANY_SELECTION_REQUIRED" ? "Choisissez l'entreprise sur laquelle travailler."
    : t.code === "MEMBERSHIP_SUSPENDED" ? "Votre accès à cette entreprise est suspendu."
    : "Aucune entreprise active n'est associée à votre compte.";
  return ccNoStore({ ok: true, source: "company_required", code: t.code, companies: t.companies ?? [], message }, 200);
}

/**
 * Résout l'utilisateur ET son entreprise réelle. Renvoie l'identité, ou une réponse prête
 * (auth error, ou refus tenant fail-closed).
 */
export async function requireCloneChatUser(req: Request): Promise<{ identity: CloneChatIdentity } | { error: NextResponse }> {
  if (!isCloneChatEnabled()) return { error: ccNoStore({ ok: false, code: "CLONECHAT_DISABLED" }, 503) };
  let userId: string;
  try {
    const supabase = await supabaseServer();
    const token = bearer(req);
    const { data } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    if (!uid) return { error: ccNoStore({ ok: false, code: "AUTH_REQUIRED", error: "Connexion requise." }, 401) };
    userId = uid;
  } catch {
    return { error: ccNoStore({ ok: false, code: "AUTH_ERROR", error: "Session invalide." }, 401) };
  }
  const tenant = await resolveCloneChatCompany(userId);
  if (!tenant.ok) return { error: tenantRefusalResponse(tenant) };
  return { identity: { userId, companyId: tenant.companyId, role: tenant.role, siteIds: tenant.siteIds, realCompany: tenant.real } };
}
