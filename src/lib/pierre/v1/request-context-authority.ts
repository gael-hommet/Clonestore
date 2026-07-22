// src/lib/pierre/v1/request-context-authority.ts
// P20.1 — REQUEST CONTEXT AUTHORITY. Resolves (company_id, entity_id, legal_country) for an
// authenticated user, server-side only, fail-closed on ambiguity. Composes EXISTING V1 canonical
// sources — V1 membership (members.ts) + the P18/P19 geo resolver already proven in
// src/lib/clonechat/server/cloneos-turn.ts (resolveServerCountryForCompany) — it is NOT a new
// store and NOT a new architecture: a thin composition, same pattern as document-jurisdiction.ts.
//
// Doctrine (hard):
//   - the client NEVER supplies company_id/entity_id/country for this resolution — server-only ;
//   - an ambiguous context (0 or >1 active company memberships) is REFUSED, never silently guessed ;
//   - a company with no resolvable legal country is REFUSED, never silently defaulted to France ;
//   - every result carries provenance + a resolution timestamp for audit.

import { listCompaniesForUser } from "./members";
import { getRuntimeDb } from "./db";
import { resolveServerCountryForCompany } from "@/lib/clonechat/server/cloneos-turn";

export type RequestContextStatus =
  | "resolved"
  | "no_company"
  | "ambiguous_company"
  | "country_unresolved";

export type RequestContextResult = {
  readonly status: RequestContextStatus;
  readonly company_id: string | null;
  readonly entity_id: string | null;
  readonly legal_country: string | null;
  readonly provenance: "v1_membership+geo_resolver";
  readonly resolved_at: string;
  readonly reason: string;
};

/**
 * Resolve the server-authoritative company/entity/legal-country context for a user.
 * Fail-closed: any ambiguity or missing data returns a non-"resolved" status — callers MUST
 * treat every non-"resolved" status as a hard stop, never a partial success.
 */
export async function resolveRequestContextAuthority(
  userId: string,
  nowIso: string,
): Promise<RequestContextResult> {
  const base = { entity_id: null as string | null, provenance: "v1_membership+geo_resolver" as const, resolved_at: nowIso };

  const db = await getRuntimeDb();
  const companies = await listCompaniesForUser(db, userId);
  const active = companies.filter(
    (c) => c.member_status === "active" && !["suspended", "cancelled", "archived"].includes(c.status),
  );

  if (active.length === 0) {
    return { ...base, status: "no_company", company_id: null, legal_country: null, reason: "Aucune société active pour cet utilisateur — contexte refusé (fail-closed)." };
  }
  if (active.length > 1) {
    return { ...base, status: "ambiguous_company", company_id: null, legal_country: null, reason: `Plusieurs sociétés actives (${active.length}) pour cet utilisateur — contexte ambigu refusé, aucune sélection implicite.` };
  }

  const company_id = active[0].id;
  const legal_country = await resolveServerCountryForCompany(company_id);
  if (!legal_country) {
    return { ...base, status: "country_unresolved", company_id, legal_country: null, reason: "Pays légal non résolu côté serveur pour cette société — aucun repli France silencieux." };
  }

  return { ...base, status: "resolved", company_id, legal_country, reason: "Contexte résolu côté serveur (adhésion V1 + autorité pays P18)." };
}
