// src/lib/pierre/v1/communication-secure-access.ts
// PHASE 8.4-R1.10 — server-side resolution of a secure communication link. The token is opaque and
// NEVER exposes a bucket / object_key / internal URL. Resolution is fail-closed and layered:
//   1. verify the HMAC signature + expiry (verifySecureLink),
//   2. require an authenticated session (the link is not anonymous),
//   3. the claim's company MUST equal the session's active tenant,
//   4. when the claim names a recipient, it MUST equal the session user,
//   5. the claim must be object-consistent (a document-bearing link points at a real document/template),
//   6. the object is loaded TENANT-BOUND (RLS) under the application role and must exist,
//   7. the access is audited (PII-free), and only an app-relative view path is returned.
// A short-lived, private view — never a permanent or cross-tenant handle.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { withTenantTransaction } from "./tenant-tx";
import { verifySecureLink, SecureLinkError } from "./communication-secure-links";

export type SecureAccessResult = {
  object_type: "document" | "template";
  object_id: string;
  document_id: string;
  title: string | null;
  view_path: string;
};

export type SecureAccessInput = {
  token: string;
  secret: string;
  sessionUserId: string | null;
  sessionCompanyId: string | null;
  nowSeconds?: number;
};

/** Resolve + authorize a secure link. Throws SecureLinkError (with a code + status hint) on refusal. */
export async function resolveSecureLinkAccess(db: SqlExecutor, input: SecureAccessInput): Promise<SecureAccessResult> {
  // 1. signature + expiry (throws: malformed / bad_signature / expired / unconfigured)
  const claims = verifySecureLink(input.token, input.secret, input.nowSeconds);
  // 2. authenticated session required
  if (!input.sessionUserId) throw new SecureLinkError("authentication required", "unauthenticated");
  // 3. the claim's tenant MUST match the session's active tenant
  if (!input.sessionCompanyId || claims.c !== input.sessionCompanyId) throw new SecureLinkError("tenant mismatch", "tenant_mismatch");
  // 4. recipient binding: when the link names a recipient, only that user may open it
  if (claims.r && claims.r !== input.sessionUserId) throw new SecureLinkError("not the intended recipient", "recipient_mismatch");
  // 5. claim consistency — a document-bearing object always points at a real document/template id
  if (claims.ot !== "document" && claims.ot !== "template") throw new SecureLinkError("unsupported object type", "bad_object_type");

  // 6. load the object TENANT-BOUND (RLS-enforced) under the application role; must exist in the tenant
  const obj = await withTenantTransaction(db, { company_id: claims.c, user_id: input.sessionUserId }, async (tx) => {
    if (claims.ot === "document") {
      return (await tx.query<{ id: string; title: string | null }>(`select id, title from pierre_rt_documents where company_id=$1 and id=$2`, [claims.c, claims.oid])).rows[0] ?? null;
    }
    return (await tx.query<{ id: string; title: string | null }>(`select id, name as title from pierre_rt_document_templates where company_id=$1 and id=$2`, [claims.c, claims.oid])).rows[0] ?? null;
  });
  if (!obj) throw new SecureLinkError("object not found in tenant", "not_found");

  // 7. audit the access (PII-free) and return ONLY an app-relative view path (never the object key)
  await db.query(
    `insert into pierre_rt_document_access_log (id, company_id, document_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), claims.c, claims.ot === "document" ? claims.oid : null, input.sessionUserId, "communication.secure_link_opened", JSON.stringify({ object_type: claims.ot, object_id: claims.oid })]);

  return { object_type: claims.ot, object_id: claims.oid, document_id: claims.oid, title: obj.title, view_path: `/agents/pierre/use?object_type=${claims.ot}&object_id=${claims.oid}` };
}
