// B44 — GET /api/pierre/empreinte/snapshot
// Returns the combined EnterpriseEmpreinte + PierreEmpreinte snapshot for the
// authenticated user. Server-side auth only — never trusts company_id from client.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readOrCreateEnterpriseEmpreinte } from "../../../../../lib/clonestore/empreinte/enterprise-memory-bridge";
import { readOrCreatePierreEmpreinte } from "../../../../../lib/pierre/empreinte/pierre-memory-bridge";
import { buildPierreEmpreinteVerdict } from "../../../../../lib/pierre/empreinte/pierre-empreinte-verdict";
import type { PierreEmpreinteSnapshot } from "../../../../../lib/pierre/empreinte/types";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function GET(req: NextRequest) {
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

    // Load memory_json from pierre_company_memory
    const { data: memRow } = await supabase
      .from("pierre_company_memory")
      .select("memory_json, agent_slug")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    const memoryJson = (memRow?.memory_json ?? {}) as Record<string, unknown>;

    const enterprise = readOrCreateEnterpriseEmpreinte(memoryJson, userId);
    const pierre = readOrCreatePierreEmpreinte(memoryJson, userId, enterprise.id);
    const verdict = buildPierreEmpreinteVerdict({ pierre, enterprise });

    const overallCompletion = Math.round((enterprise.completion.score * 0.4) + (pierre.completion.score * 0.6));

    const snapshot: PierreEmpreinteSnapshot = {
      enterprise,
      pierre,
      generated_at: new Date().toISOString(),
      user_id: userId,
      company_id: null, // derived server-side only
      overall_completion: overallCompletion,
      ready_to_activate: verdict.safe_to_activate,
    };

    return NextResponse.json(
      { snapshot, verdict },
      { headers: SECURITY_HEADERS },
    );
  } catch (_err) {
    return NextResponse.json({ error: "Failed to load empreinte snapshot." }, { status: 500, headers: SECURITY_HEADERS });
  }
}
