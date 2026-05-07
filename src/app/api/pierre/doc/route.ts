import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Route directe non disponible. Utilisez les routes document spécialisées de Pierre.",
    },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Route directe non disponible. Utilisez les routes document spécialisées de Pierre.",
    },
    { status: 405 }
  );
}
