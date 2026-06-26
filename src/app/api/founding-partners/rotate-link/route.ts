// CloneStory — révocation + renouvellement EXPLICITE du lien/code personnel (POST,
// membre authentifié). Invalide l'ancien lien `/r/<ancien-code>` et en émet un nouveau.
// Jamais automatique : déclenché par l'action « Révoquer et renouveler » (confirmée).

import { NextResponse } from "next/server";
import { regenerateCredentials } from "@/lib/clonestory/founding-partners/server/store";
import { readMemberSession } from "@/lib/clonestory/founding-partners/server/session";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req: Request) {
  const partnerId = readMemberSession(req.headers.get("cookie"));
  if (!partnerId) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  const code = await regenerateCredentials(partnerId);
  return NextResponse.json({ ok: Boolean(code) }, { headers: NO_STORE });
}
