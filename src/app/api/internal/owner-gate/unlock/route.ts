// Phase E §4.4/§4.5 — POST /api/internal/owner-gate/unlock
// Déverrouille la porte propriétaire : vérifie le slug (optionnel sur /founder), limite le
// débit (anti-bruteforce), vérifie le mot de passe en temps constant, pose un cookie signé.
// Message générique en cas d'échec — ne révèle jamais quel contrôle a échoué AU CLIENT.
// Un diagnostic SERVEUR opt-in (CLONESTORE_OWNER_GATE_DIAG=1) journalise la raison exacte
// (jamais le mot de passe, le hash, le cookie ni les secrets — seulement métadonnées + raison).

import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { verifyOwnerPassword, isOwnerGateConfigured } from "@/lib/founder-access/owner-gate";
import { loadOwnerPasswordHash } from "@/lib/founder-access/owner-password-config";
import { buildOwnerGateCookie } from "@/lib/founder-access/signed-cookie";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";
import { recordAdminAudit } from "@/lib/founder-access/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DenyReason =
  | "gate_misconfigured" | "database_error" | "rate_limited" | "missing_password"
  | "slug_mismatch" | "hash_missing" | "hash_format_invalid" | "password_mismatch"
  | "cookie_build_failed" | "success";

// Diagnostic SERVEUR uniquement, inerte sauf CLONESTORE_OWNER_GATE_DIAG=1. Aucune valeur
// sensible : seulement présence/longueur/segments/empreinte tronquée du hash + la raison.
function diag(reason: DenyReason, extra: Record<string, unknown> = {}) {
  if (process.env.CLONESTORE_OWNER_GATE_DIAG !== "1") return;
  const h = loadOwnerPasswordHash();
  console.warn("[owner-gate-unlock-diag]", JSON.stringify({
    reason,
    hash_present: h.present,
    hash_length: h.length,
    hash_parts: h.parts,
    hash_format_valid: h.formatValid,
    hash_fingerprint: h.fingerprint,
    ...extra,
  }));
}

const DENIED = { error: "Accès refusé" };
function denied(reason: DenyReason, status = 401, retryAfter?: number, extra: Record<string, unknown> = {}) {
  diag(reason, extra);
  return NextResponse.json(DENIED, { status, headers: { "cache-control": "private, no-store", ...(retryAfter ? { "retry-after": String(retryAfter) } : {}) } });
}

export async function POST(req: Request) {
  // FAIL-CLOSED : toute condition manquante → refus, sans révéler laquelle au client.
  // 1) configuration complète obligatoire (hash NON vide + secret cookie + slug).
  if (!isOwnerGateConfigured()) return denied("gate_misconfigured");

  // 2) base indispensable : sans elle, l'anti-bruteforce ne s'applique pas → refus 503.
  const db = await getRuntimeDb().catch(() => null);
  if (!db) return denied("database_error", 503);

  // 3) §4.5 — anti-bruteforce : 5 tentatives / 15 min, clé sur IP hashée → 429 (jamais 401).
  const ipHash = hashIp(getClientIp(req)) ?? "anon";
  const rl = await distributedRateLimit(db, `owner-gate-unlock:${ipHash}`, 5, 15 * 60_000);
  if (!rl.ok) {
    await recordAdminAudit(db, { actor_email: "(owner-gate)", action: "owner_gate.unlock", result: "rate_limited" }).catch(() => {});
    return denied("rate_limited", 429, rl.retryAfter, { retry_after: rl.retryAfter });
  }

  const body = await readJsonBounded<{ password?: unknown; slug?: unknown }>(req);
  if (body === null) return denied("missing_password", 400);

  // 4) §4.6 — la porte est CONFIGURÉE (slug en env, garanti par isOwnerGateConfigured). Le
  //    client peut OMETTRE le slug (entrée /founder, slug non exposé) : le mot de passe est
  //    le secret réel. S'il en fournit un (URL au slug), il DOIT correspondre exactement.
  const slug = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
  if (!slug || (body.slug !== undefined && body.slug !== slug)) {
    await recordAdminAudit(db, { actor_email: "(owner-gate)", action: "owner_gate.unlock", result: "denied" }).catch(() => {});
    return denied("slug_mismatch", 401, undefined, { slug_provided: body.slug !== undefined });
  }

  // 5) mot de passe présent + hash chargé valide + vérification temps constant.
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length === 0) {
    await recordAdminAudit(db, { actor_email: "(owner-gate)", action: "owner_gate.unlock", result: "denied" }).catch(() => {});
    return denied("missing_password");
  }
  const hashInfo = loadOwnerPasswordHash();
  if (!hashInfo.present) return denied("hash_missing");
  if (!hashInfo.formatValid) return denied("hash_format_invalid");
  if (!verifyOwnerPassword(password)) {
    await recordAdminAudit(db, { actor_email: "(owner-gate)", action: "owner_gate.unlock", result: "denied" }).catch(() => {});
    return denied("password_mismatch");
  }

  const cookie = buildOwnerGateCookie();
  if (!cookie) return denied("cookie_build_failed", 503); // secret cookie absent → fail closed

  await recordAdminAudit(db, { actor_email: "(owner-gate)", action: "owner_gate.unlock", result: "ok" }).catch(() => {});
  diag("success");
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
  res.headers.append("set-cookie", cookie);
  return res;
}
