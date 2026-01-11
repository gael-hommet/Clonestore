import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Petite helper pour réponses JSON
 */
function json(status: number, data: unknown) {
  return NextResponse.json(data, { status });
}

/**
 * Récupération safe des env
 * → AUCUN throw au top-level (Vercel-safe)
 */
function getEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : null;
}

export async function POST(req: Request) {
  try {
    // === 1. ENV (résolues AU RUNTIME, pas au build)
    const supabaseUrl =
      getEnv("SUPABASE_URL") ?? getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon =
      getEnv("SUPABASE_ANON_KEY") ??
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabaseService = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl)
      return json(500, { error: "Missing SUPABASE_URL" });
    if (!supabaseAnon)
      return json(500, { error: "Missing SUPABASE_ANON_KEY" });
    if (!supabaseService)
      return json(500, { error: "Missing SUPABASE_SERVICE_ROLE_KEY" });

    // === 2. Body
    const body = (await req.json().catch(() => ({}))) as {
      agent_slug?: unknown;
      access_token?: unknown;
    };

    const agent_slug =
      typeof body.agent_slug === "string" ? body.agent_slug : null;
    const access_token =
      typeof body.access_token === "string" ? body.access_token : null;

    if (!agent_slug)
      return json(400, { error: "Missing agent_slug" });
    if (!access_token)
      return json(401, { error: "Missing access_token" });

    // === 3. Vérification utilisateur (client ANON + token)
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
    });

    const { data: userRes, error: userErr } =
      await authClient.auth.getUser(access_token);

    if (userErr || !userRes?.user) {
      return json(401, {
        error: userErr?.message || "Invalid user session",
      });
    }

    const user_id = userRes.user.id;

    // === 4. Upsert côté DB (SERVICE ROLE)
    const adminClient = createClient(supabaseUrl, supabaseService, {
      auth: { persistSession: false },
    });

    const now = new Date().toISOString();

    const { error: upsertErr } = await adminClient
      .from("orders")
      .upsert(
        {
          user_id,
          agent_slug,
          status: "active",
          started_at: now,
          ended_at: null,
        },
        {
          onConflict: "user_id,agent_slug",
        }
      );

    if (upsertErr) {
      return json(500, { error: upsertErr.message });
    }

    // === 5. OK
    return json(200, {
      ok: true,
      user_id,
      agent_slug,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "activate failed";
    return json(500, { error: msg });
  }
}


