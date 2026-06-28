// src/lib/pierre/v1/communication-secure-links.ts
// PHASE 8.4.9 — server-generated, tenant-bound, short-lived, signed links. An email NEVER exposes a
// bucket / object_key / internal URL / permanent token. The link is an opaque HMAC-signed token
// that resolves server-side to the real object, scoped to the tenant (and recipient when set).

import { createHmac, timingSafeEqual } from "crypto";

export class SecureLinkError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = "SecureLinkError"; }
}

export type SecureLinkClaims = {
  c: string;            // company_id
  ot: string;           // object_type
  oid: string;          // object_id
  r: string | null;     // recipient_user_id (null = tenant-bound only)
  exp: number;          // epoch seconds
};

function b64url(buf: Buffer): string { return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64urlDecode(s: string): Buffer { return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }

/** Create a signed secure-link token + app-relative path. ttl is short. The secret is injected
 *  (tests) or read from env — never auto-configured. */
export function createSecureLink(input: { company_id: string; object_type: string; object_id: string; recipient_user_id?: string | null; ttl_seconds?: number; now_seconds?: number; secret: string }): { token: string; path: string } {
  if (!input.secret) throw new SecureLinkError("secure link secret not configured", "unconfigured");
  const now = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const claims: SecureLinkClaims = { c: input.company_id, ot: input.object_type, oid: input.object_id, r: input.recipient_user_id ?? null, exp: now + Math.min(Math.max(input.ttl_seconds ?? 86400, 60), 7 * 86400) };
  const payload = b64url(Buffer.from(JSON.stringify(claims), "utf8"));
  const sig = b64url(createHmac("sha256", input.secret).update(payload).digest());
  const token = `${payload}.${sig}`;
  return { token, path: `/agents/pierre/use/secure/${token}` };
}

/** Verify a secure-link token: signature + expiry. Returns the claims or throws. */
export function verifySecureLink(token: string, secret: string, nowSeconds?: number): SecureLinkClaims {
  if (!secret) throw new SecureLinkError("secure link secret not configured", "unconfigured");
  const parts = String(token).split(".");
  if (parts.length !== 2) throw new SecureLinkError("malformed secure link", "malformed");
  const [payload, sig] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let provided: Buffer;
  try { provided = b64urlDecode(sig); } catch { throw new SecureLinkError("bad signature", "bad_signature"); }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new SecureLinkError("bad signature", "bad_signature");
  let claims: SecureLinkClaims;
  try { claims = JSON.parse(b64urlDecode(payload).toString("utf8")); } catch { throw new SecureLinkError("bad payload", "bad_payload"); }
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) throw new SecureLinkError("secure link expired", "expired");
  return claims;
}
