import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin;

    // Read body once so it can be forwarded to run-next
    const bodyText = await request.text().catch(() => "");

    // Forward all auth-relevant headers so run-next can authenticate the caller
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const workerSecret = request.headers.get("x-pierre-worker-secret");
    if (workerSecret) forwardHeaders["x-pierre-worker-secret"] = workerSecret;

    const authorization = request.headers.get("authorization");
    if (authorization) forwardHeaders["authorization"] = authorization;

    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders["cookie"] = cookie;

    const response = await fetch(`${origin}/api/pierre/queue/run-next`, {
      method: "POST",
      headers: forwardHeaders,
      body: bodyText || undefined,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    return json(
      payload ?? { ok: false, error: "Réponse queue invalide." },
      response.status,
    );
  } catch (error) {
    console.error("[pierre/queue/process-next][POST]", error);

    return json(
      {
        ok: false,
        error: "Impossible de traiter la prochaine tâche Pierre.",
      },
      500,
    );
  }
}
