import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const user_id = typeof body.user_id === "string" ? body.user_id : null;
    const agent_slug = typeof body.agent_slug === "string" ? body.agent_slug : null;

    if (!user_id || !agent_slug) {
      return NextResponse.json({ error: "Missing user_id or agent_slug" }, { status: 400 });
    }

    // ✅ instanciation seulement à l’exécution (pas au build)
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();

    // âš ️ Ici tu mets ta logique réelle d’activation.
    // Exemple simple : activer dans orders (à adapter à ton schéma)
    const { error } = await supabase
      .from("orders")
      .upsert({ user_id, agent_slug, status: "active", ended_at: null }, { onConflict: "user_id,agent_slug" });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

