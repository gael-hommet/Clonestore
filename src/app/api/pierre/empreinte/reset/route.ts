// B44 — POST /api/pierre/empreinte/reset
// Resets enterprise and/or pierre empreinte to factory defaults.
// Requires authentication. Accepts { target: "enterprise" | "pierre" | "all" }.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  readOrCreateEnterpriseEmpreinte,
  buildEnterpriseEmpreinteMemoryPatch,
  resetEnterpriseEmpreinteInMemory,
} from "../../../../../lib/clonestore/empreinte/enterprise-memory-bridge";
import {
  buildPierreEmpreinteMemoryPatch,
  resetPierreEmpreinteInMemory,
} from "../../../../../lib/pierre/empreinte/pierre-memory-bridge";

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

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* default */ }

    const target = typeof body.target === "string" ? body.target : "all";
    if (!["enterprise", "pierre", "all"].includes(target)) {
      return NextResponse.json({ error: "target must be 'enterprise', 'pierre', or 'all'." }, { status: 400, headers: SECURITY_HEADERS });
    }

    const { data: memRow } = await supabase
      .from("pierre_company_memory")
      .select("memory_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    let memoryJson = (memRow?.memory_json ?? {}) as Record<string, unknown>;
    const resetSummary: Record<string, unknown> = {};

    if (target === "enterprise" || target === "all") {
      const { reset, newMemoryJson } = resetEnterpriseEmpreinteInMemory(memoryJson, userId);
      memoryJson = newMemoryJson;
      resetSummary.enterprise = { reset: true, id: reset.id };
    }

    if (target === "pierre" || target === "all") {
      const enterprise = readOrCreateEnterpriseEmpreinte(memoryJson, userId);
      const { reset, newMemoryJson } = resetPierreEmpreinteInMemory(memoryJson, userId, enterprise.id);
      memoryJson = newMemoryJson;
      resetSummary.pierre = { reset: true, id: reset.id };
    }

    const { error: upsertError } = await supabase
      .from("pierre_company_memory")
      .upsert(
        { user_id: userId, agent_slug: "pierre", memory_json: memoryJson, updated_at: new Date().toISOString() },
        { onConflict: "user_id,agent_slug" },
      );

    if (upsertError) {
      return NextResponse.json({ error: "Failed to persist reset." }, { status: 500, headers: SECURITY_HEADERS });
    }

    return NextResponse.json(
      { reset: true, target, ...resetSummary },
      { headers: SECURITY_HEADERS },
    );
  } catch (_err) {
    return NextResponse.json({ error: "Reset failed." }, { status: 500, headers: SECURITY_HEADERS });
  }
}
