// src/app/api/billing/activate/route.ts
// B41 FIX: user_id ALWAYS resolved from Bearer token — NEVER from request body.
// Previous version accepted user_id from body (critical security vulnerability).

import { NextResponse } from "next/server";
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
    // 1. Extract Bearer token — ONLY from Authorization header
    const authHeader =
      req.headers.get("authorization") ||
      req.headers.get("Authorization") ||
      "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentification requise. Token Bearer manquant." },
        { status: 401 },
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return NextResponse.json(
        { error: "Token Bearer vide." },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Validate token — user_id comes from Supabase auth, NEVER from body
    const { data, error: authError } = await supabase.auth.getUser(token);

    if (authError || !data.user) {
      return NextResponse.json(
        { error: "Token invalide ou expiré." },
        { status: 401 },
      );
    }

    const user_id = data.user.id; // Server-resolved, never from client

    // 3. agent_slug from body (non-sensitive — does not affect identity)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const agent_slug =
      typeof body.agent_slug === "string" && body.agent_slug.trim()
        ? body.agent_slug.trim()
        : null;

    if (!agent_slug) {
      return NextResponse.json(
        { error: "agent_slug requis dans le body." },
        { status: 400 },
      );
    }

    // 4. Activate (user_id from server auth, never from client body)
    const { error } = await supabase
      .from("orders")
      .upsert(
        { user_id, agent_slug, status: "active", ended_at: null },
        { onConflict: "user_id,agent_slug" },
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
