import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.session_id;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, step: "env", error: "SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur" },
        { status: 500 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, step: "input", error: "session_id manquant" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { ok: false, step: "stripe", error: "Paiement non validé", payment_status: session.payment_status },
        { status: 400 }
      );
    }

    const userId = session.metadata?.user_id;
    const agentSlug = session.metadata?.agent_slug;

    if (!userId || !agentSlug) {
      return NextResponse.json(
        { ok: false, step: "metadata", error: "metadata manquante (user_id / agent_slug)", metadata: session.metadata || null },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // IMPORTANT : on force la réactivation même si une ligne "cancelled" existe déjà
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("orders")
      .upsert(
        {
          user_id: userId,
          agent_slug: agentSlug,
          status: "active",
          started_at: now,
          ended_at: null,
        },
        { onConflict: "user_id,agent_slug" }
      )
      .select("id, user_id, agent_slug, status, started_at, ended_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, step: "db", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, step: "done", inserted: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, step: "catch", error: e?.message || "Erreur inconnue" },
      { status: 500 }
    );
  }
}
