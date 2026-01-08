import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.redirect(new URL("/paiement/cancel", req.url));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.redirect(new URL("/paiement/cancel", req.url));
    }

    const userId = session.metadata?.user_id;
    const agentSlug = session.metadata?.agent_slug;

    // Si metadata absente, on redirige quand même (UX OK), mais pas d’activation.
    if (!userId || !agentSlug) {
      return NextResponse.redirect(new URL("/paiement/success", req.url));
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin.from("orders").upsert(
      { user_id: userId, agent_slug: agentSlug },
      { onConflict: "user_id,agent_slug" }
    );

    if (error) {
      console.error("[return] upsert orders error:", error);
      // On n’empêche pas l’UX, on redirige quand même.
    }

    return NextResponse.redirect(new URL("/paiement/success", req.url));
  } catch (e) {
    console.error("[return]", e);
    return NextResponse.redirect(new URL("/paiement/success", req.url));
  }
}
