// src/app/api/cloneos/landing/route.ts
// P12 — Cible d'atterrissage CloneOS (JSON fiable). Réutilise le resolver serveur (auth réelle).
// Le garde client interroge cette route pour un routage fin fiable (achat/setup) quand le
// redirect() serveur RSC n'est pas fiable. no-store.
import { NextResponse } from "next/server";
import { resolveLandingTarget } from "@/lib/clonestore/cloneos/client-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const target = await resolveLandingTarget();
  return NextResponse.json(target, { headers: { "Cache-Control": "no-store" } });
}
