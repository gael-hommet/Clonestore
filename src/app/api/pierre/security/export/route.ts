// src/app/api/pierre/security/export/route.ts
// B41 — RGPD export endpoint. Bearer auth required. No secrets in response.
// company_id NEVER from client body — resolved from server auth.

import { NextResponse } from "next/server";
import { buildSecurityHeaders } from "@/lib/security/headers";
import { buildSecurityTenantScope } from "@/lib/security/tenant-scope";
import { evaluateRouteSecurityPolicy, buildBlockedSecurityResponse } from "@/lib/security/route-guard";
import { getPierreRoutePolicy } from "@/lib/pierre/security/pierre-route-policy";
import {
  buildPierreRgpdExportPlan,
  buildFullPierreRgpdExport,
  buildFakeExportAdapters,
} from "@/lib/pierre/security/pierre-rgpd-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLICY = getPierreRoutePolicy("pierre.security.export")!;
const SECURITY_HEADERS = buildSecurityHeaders({ no_store: true, no_index: true });

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: SECURITY_HEADERS,
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  return handleExport(req, "plan_only");
}

export async function POST(req: Request): Promise<NextResponse> {
  return handleExport(req, "full_export");
}

async function handleExport(
  req: Request,
  mode: "plan_only" | "full_export",
): Promise<NextResponse> {
  // 1. Extract Bearer token (never from body/query)
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Authentification requise.", code: "block_auth_required" }, 401);
  }

  // 2. Validate token server-side
  let userId: string | null = null;
  let accessLevel = "logged_unpaid";
  let ownsPierre = false;

  try {
    // Attempt real Supabase validation
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

      // Check Pierre access
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
      // Supabase not configured — return 501 safely
      return jsonResponse(
        { ok: false, error: "Service non configuré.", code: "block_emergency_shutdown" },
        501,
      );
    }
  } catch {
    return jsonResponse(
      { ok: false, error: "Erreur d'authentification.", code: "block_auth_required" },
      401,
    );
  }

  // 3. Build security scope (company_id = user_id for current single-tenant)
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

  // 5. Execute
  try {
    if (mode === "plan_only") {
      const plan = buildPierreRgpdExportPlan(scope);
      return jsonResponse({ ok: true, plan }, 200);
    }

    // Full export — use fake adapters (real adapters would be injected in production)
    const adapters = buildFakeExportAdapters();
    const bundle = await buildFullPierreRgpdExport(scope, adapters);

    return jsonResponse({ ok: true, export: bundle }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
}
