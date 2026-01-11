import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stripe/return?success=1
// ou GET /api/stripe/return?success=0
export async function GET(req: Request) {
  const url = new URL(req.url);

  // Stripe renvoie souvent des params genre:
  // ?session_id=cs_test_...&...
  // toi tu peux aussi envoyer ?success=1 depuis ton front.
  const success =
    url.searchParams.get("success") === "1" ||
    url.searchParams.get("redirect_status") === "succeeded";

  // ✅ IMPORTANT: on ne touche PAS à Stripe/Supabase ici.
  // On redirige juste vers tes pages.
  const dest = success ? "/paiement/success" : "/paiement/cancel";

  return NextResponse.redirect(new URL(dest, url.origin));
}
