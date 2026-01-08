import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return NextResponse.json({ error: "session_id manquant" }, { status: 400 });
    }

    // 1. Vérifier la session Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Paiement non validé" }, { status: 400 });
    }

    // 2. Récupérer l'utilisateur Supabase
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } =
      await supabaseAuth.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    const userId = userData.user.id;

    // 3. Écrire l’accès (Pierre)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: insertErr } = await supabaseAdmin
      .from("entitlements")
      .insert({
        user_id: userId,
        agent: "pierre",
        status: "active",
      });

    if (insertErr) {
      throw insertErr;
    }

    return NextResponse.json({ status: "activated" });
  } catch (e: any) {
    console.error("[activate]", e);
    return NextResponse.json(
      { error: e.message || "Erreur activation" },
      { status: 500 }
    );
  }
}
