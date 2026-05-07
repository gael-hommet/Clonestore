import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin;

    const response = await fetch(`${origin}/api/pierre/queue/run-next`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    return json(
      payload ?? {
        ok: false,
        error: "Réponse queue invalide.",
      },
      response.status
    );
  } catch (error) {
    console.error("[pierre/queue/process-next][POST]", error);

    return json(
      {
        ok: false,
        error: "Impossible de traiter la prochaine tâche Pierre.",
      },
      500
    );
  }
}