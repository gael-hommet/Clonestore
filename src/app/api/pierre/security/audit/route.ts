// src/app/api/pierre/security/audit/route.ts
// B41 — Security audit summary endpoint. No raw sensitive data in response.

import { NextResponse } from "next/server";
import { buildSecurityHeaders } from "@/lib/security/headers";
import { buildSecurityTenantScope } from "@/lib/security/tenant-scope";
import { evaluateRouteSecurityPolicy, buildBlockedSecurityResponse } from "@/lib/security/route-guard";
import { getPierreRoutePolicy } from "@/lib/pierre/security/pierre-route-policy";
import {
  buildB41SecurityVerdict,
  auditPierreRoutes,
  auditPierreDataMap,
} from "@/lib/pierre/security/pierre-security-audit";
import { buildRetentionReport } from "@/lib/pierre/security/pierre-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLICY = getPierreRoutePolicy("pierre.security.audit")!;
const SECURITY_HEADERS = buildSecurityHeaders({ no_store: true, no_index: true });

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: SECURITY_HEADERS });
}

export async function GET(req: Request): Promise<NextResponse> {
  // 1. Auth
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Authentification requise.", code: "block_auth_required" }, 401);
  }

  // 2. Token validation
  let userId: string | null = null;
  let accessLevel = "logged_unpaid";
  let ownsPierre = false;

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

      const { data: order } = await supabase
        .from("orders")
        .select("id,status")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .in("status", ["active", "trialing"])
        .maybeSingle();

      if (order) {
        accessLevel = "paid_customer";
        ownsPierre = true;
      }
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
    owns_pierre: ownsPierre,
    pierre_enabled: ownsPierre,
    source: "supabase_auth",
  });

  // 4. Route guard
  const decision = evaluateRouteSecurityPolicy(POLICY, scope);
  if (!decision.allowed) {
    const { body, status } = buildBlockedSecurityResponse(decision);
    return jsonResponse(body, status);
  }

  // 5. Build audit response (no raw PII — pure summaries)
  const verdict = buildB41SecurityVerdict();
  const routeAudit = auditPierreRoutes();
  const dataMapAudit = auditPierreDataMap();
  const retentionReport = buildRetentionReport(userId ?? "");

  return jsonResponse(
    {
      ok: true,
      verdict,
      route_audit: routeAudit,
      data_map_audit: dataMapAudit,
      retention_report: retentionReport,
    },
    200,
  );
}
