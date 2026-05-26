// src/app/api/pierre/security/purge/route.ts
// B41 — RGPD purge endpoint. Dry-run by default. No actual deletes without:
//   1. PIERRE_RGPD_PURGE_EXECUTE_ENABLED=true env var
//   2. internal_admin access level
//   3. Correct confirmation phrase

import { NextResponse } from "next/server";
import { buildSecurityHeaders } from "@/lib/security/headers";
import { buildSecurityTenantScope } from "@/lib/security/tenant-scope";
import { evaluateRouteSecurityPolicy, buildBlockedSecurityResponse } from "@/lib/security/route-guard";
import { getPierreRoutePolicy } from "@/lib/pierre/security/pierre-route-policy";
import {
  buildPierreRgpdPurgePlan,
  executePierreRgpdPurge,
  buildFakePurgeAdapters,
  validatePurgeConfirmation,
} from "@/lib/pierre/security/pierre-rgpd-purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLICY = getPierreRoutePolicy("pierre.security.purge")!;
const SECURITY_HEADERS = buildSecurityHeaders({ no_store: true, no_index: true });

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: SECURITY_HEADERS });
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Auth
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Authentification requise.", code: "block_auth_required" }, 401);
  }

  // 2. Token validation
  let userId: string | null = null;
  let accessLevel = "logged_unpaid";

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const token = auth.slice("Bearer ".length).trim();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return jsonResponse({ ok: false, error: "Token invalide.", code: "block_auth_required" }, 401);
      }
      userId = data.user.id;

      // Check admin role (internal_admin required for purge policy)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      accessLevel = profile?.role === "internal_admin" ? "internal_admin" : "logged_unpaid";
    } else {
      return jsonResponse({ ok: false, error: "Service non configuré.", code: "block_emergency_shutdown" }, 501);
    }
  } catch {
    return jsonResponse({ ok: false, error: "Erreur d'authentification.", code: "block_auth_required" }, 401);
  }

  // 3. Scope
  const scope = buildSecurityTenantScope({
    user_id: userId,
    company_id: userId,
    access_level: accessLevel,
    source: "supabase_auth",
  });

  // 4. Route guard
  const decision = evaluateRouteSecurityPolicy(POLICY, scope);
  if (!decision.allowed) {
    const { body, status } = buildBlockedSecurityResponse(decision);
    return jsonResponse(body, status);
  }

  // 5. Parse body
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // 6. Always dry_run by default
  const executeEnabled = process.env.PIERRE_RGPD_PURGE_EXECUTE_ENABLED === "true";
  const requestedExecute = body.execute === true;
  const dry_run = !(executeEnabled && requestedExecute);

  // 7. Build purge plan (always with fake adapters in this route — real adapters injected in prod)
  const adapters = buildFakePurgeAdapters();
  const plan = await buildPierreRgpdPurgePlan(scope, { dry_run, adapters });

  // 8. Dry-run: return plan only
  if (dry_run) {
    return jsonResponse({
      ok: true,
      dry_run: true,
      plan,
      message: "Plan de purge généré. Aucune donnée supprimée (dry_run=true).",
    }, 200);
  }

  // 9. Execute (only if env var + admin + confirmation phrase)
  const confirmation_phrase = typeof body.confirmation_phrase === "string"
    ? body.confirmation_phrase
    : "";
  const understand_irreversible = body.understand_irreversible === true;

  const confirmInput = {
    confirmation_phrase,
    user_id: userId ?? "",
    understand_irreversible,
  };

  const validation = validatePurgeConfirmation(confirmInput, plan);
  if (!validation.valid) {
    return jsonResponse({
      ok: false,
      error: "Validation de confirmation échouée.",
      reasons: validation.reasons,
    }, 400);
  }

  const result = await executePierreRgpdPurge(plan, confirmInput, adapters);
  return jsonResponse({ ok: true, result }, 200);
}
