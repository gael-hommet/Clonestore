// §3 — GET /api/internal/founder-access/live : flux temps réel privé (Server-Sent Events).
// MÊMES protections que le cockpit (porte propriétaire + session Supabase + allowlist via
// guardInternalRequest). Pousse le snapshot agrégé (aucune PII) toutes les ~15 s + au départ.
// Reconnexion/backoff/fallback polling sont gérés côté client.

import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { getFounderCommandCenterSnapshot } from "@/lib/founder-access/command-center";
import { getFounderPhase } from "@/lib/founder-access/commercial";
import { liveConnections } from "@/lib/founder-access/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUSH_INTERVAL_MS = 15_000;

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      liveConnections.inc();
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* flux fermé */ }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        liveConnections.dec();
        try { controller.close(); } catch { /* déjà fermé */ }
      };
      async function push() {
        if (closed) return;
        try {
          const db = await getRuntimeDb();
          const snap = await getFounderCommandCenterSnapshot(db);
          send("snapshot", { ...snap, commercial_phase: getFounderPhase() });
        } catch {
          send("ping", { t: Date.now() }); // garde le flux vivant malgré une erreur passagère
        }
      }
      req.signal.addEventListener("abort", close);
      send("ready", { t: Date.now() });
      await push();
      if (closed) return; // annulé pendant le premier push → ne pas armer d'intervalle
      timer = setInterval(push, PUSH_INTERVAL_MS);
    },
    cancel() {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      liveConnections.dec();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "private, no-cache, no-store, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
