// src/lib/clonechat/server/company.ts
// P9.4.2 (round 2) — Résolution d'entreprise FAIL-CLOSED. En Production, CloneChat NE
// retombe JAMAIS silencieusement sur un tenant fabriqué `u:<userId>`. Il résout la VRAIE
// entreprise à partir du membership V1 (lecture seule) :
//   utilisateur → memberships actifs → préférence gouvernée → vérification statut →
//   rôle/scope de site → company_id réel
// Sinon il renvoie un refus STRUCTURÉ (MEMBERSHIP_REQUIRED / COMPANY_SELECTION_REQUIRED /
// MEMBERSHIP_SUSPENDED / COMPANY_UNAVAILABLE) et l'appelant N'écrit rien sous une fausse
// entreprise. Une panne DB P8 échoue FERMÉ (jamais de continuation silencieuse). Un repli
// par-utilisateur n'est permis QUE si un flag explicite local/test est vrai.

import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { listCompaniesForUser } from "@/lib/pierre/v1/members";

const UNHEALTHY_COMPANY = new Set(["suspended", "cancelled", "archived"]);

export type TenantRefusalCode =
  | "MEMBERSHIP_REQUIRED"        // aucun membership actif (compte non rattaché / retiré / left)
  | "MEMBERSHIP_SUSPENDED"       // membership suspendu (ou entreprise suspendue)
  | "COMPANY_SELECTION_REQUIRED" // plusieurs entreprises actives, pas de préférence valide
  | "COMPANY_UNAVAILABLE";       // panne/erreur runtime P8 → fail-closed

export interface ResolvedTenantOk {
  readonly ok: true;
  readonly companyId: string;
  readonly role: string;
  readonly siteIds: string[];
  /** true = vraie entreprise (membership V1) ; false = repli par-utilisateur (flag explicite). */
  readonly real: boolean;
}
export interface ResolvedTenantRefusal {
  readonly ok: false;
  readonly code: TenantRefusalCode;
  readonly companies?: Array<{ id: string; name: string }>;
}
export type TenantResolution = ResolvedTenantOk | ResolvedTenantRefusal;

/** Sentinelle de repli par-utilisateur (isolation individuelle, non-entreprise). */
export function userScopedTenant(userId: string): string { return `u:${userId}`; }

/** Le repli par-utilisateur est-il autorisé ? UNIQUEMENT via un flag explicite local/test. */
export function tenantFallbackAllowed(): boolean {
  return process.env.CLONECHAT_ALLOW_USER_TENANT_FALLBACK === "1";
}

/**
 * Résolution FAIL-CLOSED de l'entreprise réelle (lecture seule du canon V1). Ne throw
 * jamais : toute panne DB → refus structuré COMPANY_UNAVAILABLE (fail-closed).
 */
export async function resolveCloneChatTenant(userId: string): Promise<TenantResolution> {
  let db;
  try { db = await getRuntimeDb(); } catch { return { ok: false, code: "COMPANY_UNAVAILABLE" }; }
  try {
    // Memberships actifs OU suspendus (les retirés/left ne sont PAS renvoyés par P8).
    const memberships = await listCompaniesForUser(db, userId);
    const healthy = memberships.filter((c) => !UNHEALTHY_COMPANY.has(c.status));
    const active = healthy.filter((c) => c.member_status === "active");

    // Préférence gouvernée (lecture seule, identity-scoped).
    const pref = await db.query<{ last_company_id: string | null }>(
      "select last_company_id from pierre_rt_user_company_prefs where user_id = $1", [userId]);
    const prefId = pref.rows[0]?.last_company_id ?? null;
    const prefMatch = prefId ? active.find((c) => c.id === prefId) : null;

    let chosen: { id: string; role: string } | null = null;
    if (prefMatch) chosen = { id: prefMatch.id, role: prefMatch.role };
    else if (active.length === 1) chosen = { id: active[0].id, role: active[0].role };
    else if (active.length > 1) return { ok: false, code: "COMPANY_SELECTION_REQUIRED", companies: active.map((c) => ({ id: c.id, name: c.name })) };
    else {
      // Aucune entreprise active : suspendu → refus explicite, sinon membership requis.
      const hasSuspended = memberships.some((c) => c.member_status === "suspended" || UNHEALTHY_COMPANY.has(c.status));
      return { ok: false, code: hasSuspended ? "MEMBERSHIP_SUSPENDED" : "MEMBERSHIP_REQUIRED" };
    }

    // Scope de site (lecture seule) — pour livrer uniquement le contexte permis.
    let siteIds: string[] = [];
    try {
      const sites = await db.query<{ site_id: string }>(
        `select ms.site_id from pierre_rt_member_sites ms
           join pierre_rt_members m on m.id = ms.member_id
          where m.user_id = $1 and m.company_id = $2`, [userId, chosen.id]);
      siteIds = sites.rows.map((r) => r.site_id).filter(Boolean);
    } catch { siteIds = []; /* pas de scope de site → accès entreprise complet */ }

    return { ok: true, companyId: chosen.id, role: chosen.role, siteIds, real: true };
  } catch {
    return { ok: false, code: "COMPANY_UNAVAILABLE" }; // fail-closed sur toute erreur DB
  }
}

/**
 * Résolution utilisée par les routes. Renvoie l'entreprise réelle, OU un repli
 * par-utilisateur SEULEMENT si le flag explicite est actif ET que le refus est
 * MEMBERSHIP_REQUIRED (compte non rattaché). Une panne DB ou une sélection requise ne
 * retombent JAMAIS silencieusement.
 */
export async function resolveCloneChatCompany(userId: string): Promise<TenantResolution> {
  const t = await resolveCloneChatTenant(userId);
  if (t.ok) return t;
  if (tenantFallbackAllowed() && t.code === "MEMBERSHIP_REQUIRED") {
    return { ok: true, companyId: userScopedTenant(userId), role: "member", siteIds: [], real: false };
  }
  return t; // refus structuré — l'appelant ne crée rien sous une fausse entreprise
}
