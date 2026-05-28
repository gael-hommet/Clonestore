// B44 — POST /api/pierre/empreinte/save
// Saves patches to EnterpriseEmpreinte and/or PierreEmpreinte.
// Never trusts company_id from client — always derived from server-side auth.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  readOrCreateEnterpriseEmpreinte,
  buildEnterpriseEmpreinteMemoryPatch,
} from "../../../../../lib/clonestore/empreinte/enterprise-memory-bridge";
import { applyEnterpriseEmpreintePatch } from "../../../../../lib/clonestore/empreinte/enterprise-normalizer";
import { validateEnterpriseEmpreintePatch } from "../../../../../lib/clonestore/empreinte/enterprise-validation";
import {
  readOrCreatePierreEmpreinte,
  buildPierreEmpreinteMemoryPatch,
} from "../../../../../lib/pierre/empreinte/pierre-memory-bridge";
import { applyPierreEmpreintePatch } from "../../../../../lib/pierre/empreinte/pierre-normalizer";
import { validatePierreEmpreintePatch } from "../../../../../lib/pierre/empreinte/pierre-validation";
import type { EnterpriseEmpreintePatch } from "../../../../../lib/clonestore/empreinte/types";
import type { PierreEmpreintePatch } from "../../../../../lib/pierre/empreinte/types";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: SECURITY_HEADERS });
    }
    const token = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503, headers: SECURITY_HEADERS });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401, headers: SECURITY_HEADERS });
    }
    const userId = user.id;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: SECURITY_HEADERS });
    }

    // Strip tenant spoofing fields — server-side auth only
    const { company_id: _ci, user_id: _ui, organization_id: _oi, ...safeBody } = body as Record<string, unknown>;

    const enterprisePatch = safeBody.enterprise as EnterpriseEmpreintePatch | undefined;
    const pierrePatch = safeBody.pierre as PierreEmpreintePatch | undefined;

    if (!enterprisePatch && !pierrePatch) {
      return NextResponse.json({ error: "No patch provided. Supply 'enterprise' or 'pierre'." }, { status: 400, headers: SECURITY_HEADERS });
    }

    // Validate patches
    if (enterprisePatch) {
      const ev = validateEnterpriseEmpreintePatch(enterprisePatch);
      if (!ev.valid) {
        return NextResponse.json({ error: "Enterprise patch validation failed.", issues: ev.issues }, { status: 422, headers: SECURITY_HEADERS });
      }
    }
    if (pierrePatch) {
      const pv = validatePierreEmpreintePatch(pierrePatch);
      if (!pv.valid) {
        return NextResponse.json({ error: "Pierre patch validation failed.", issues: pv.issues }, { status: 422, headers: SECURITY_HEADERS });
      }
    }

    // Load existing memory
    const { data: memRow } = await supabase
      .from("pierre_company_memory")
      .select("memory_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    let memoryJson = (memRow?.memory_json ?? {}) as Record<string, unknown>;

    // Apply enterprise patch
    let updatedEnterprise = readOrCreateEnterpriseEmpreinte(memoryJson, userId);
    if (enterprisePatch) {
      updatedEnterprise = applyEnterpriseEmpreintePatch(updatedEnterprise, enterprisePatch);
      memoryJson = buildEnterpriseEmpreinteMemoryPatch(memoryJson, updatedEnterprise);
    }

    // Apply pierre patch
    let updatedPierre = readOrCreatePierreEmpreinte(memoryJson, userId, updatedEnterprise.id);
    if (pierrePatch) {
      updatedPierre = applyPierreEmpreintePatch(updatedPierre, pierrePatch);
      memoryJson = buildPierreEmpreinteMemoryPatch(memoryJson, updatedPierre);
    }

    // Persist
    const { error: upsertError } = await supabase
      .from("pierre_company_memory")
      .upsert(
        { user_id: userId, agent_slug: "pierre", memory_json: memoryJson, updated_at: new Date().toISOString() },
        { onConflict: "user_id,agent_slug" },
      );

    if (upsertError) {
      return NextResponse.json({ error: "Failed to persist empreinte." }, { status: 500, headers: SECURITY_HEADERS });
    }

    return NextResponse.json(
      {
        saved: true,
        enterprise: updatedEnterprise,
        pierre: updatedPierre,
      },
      { headers: SECURITY_HEADERS },
    );
  } catch (_err) {
    return NextResponse.json({ error: "Failed to save empreinte." }, { status: 500, headers: SECURITY_HEADERS });
  }
}
