import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Endpoint "index" pour /api/pierre
 * (évite que Next/TS plante si le dossier a une route racine vide)
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "pierre",
      endpoints: [
        "/api/pierre/execute",
        "/api/pierre/run",
        "/api/pierre/tick",
        "/api/pierre/enqueue",
        "/api/pierre/generate",
      ],
    },
    { status: 200 }
  );
}

// Optionnel : POST sur /api/pierre → 404 propre
export async function POST() {
  return NextResponse.json(
    { ok: false, error: { code: "NOT_FOUND", message: "Use /api/pierre/execute" } },
    { status: 404 }
  );
}
