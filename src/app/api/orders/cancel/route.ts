import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const agent_slug = body?.agent_slug;
    const access_token = body?.access_token;

    if (!agent_slug) {
      return NextResponse.json({ error: "agent_slug manquant" }, { status: 400 });
    }
    if (!access_token) {
      return NextResponse.json({ error: "access_token manquant" }, { status: 401 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY manquante côté serveur" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Vérifier l'identité à partir du token Supabase (impossible à tricher)
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const user_id = userRes.user.id;

    // Mettre fin à l’accès (résiliation)
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("agent_slug", agent_slug)
      .eq("status", "active")
      .select("id, user_id, agent_slug, status, started_at, ended_at")
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Aucun accès actif trouvé à résilier." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, cancelled: updated });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erreur résiliation" },
      { status: 500 }
    );
  }
}
