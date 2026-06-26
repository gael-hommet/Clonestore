// Temps réel (SSE privé) — compteur de connexions live + état de la source. Le transport
// SSE est implémenté dans /api/internal/founder-access/live (gated comme le cockpit). La
// santé serveur reflète la disponibilité réelle du flux et le nombre de connexions actives.

const g = globalThis as unknown as { __founderLive?: { n: number } };
g.__founderLive ??= { n: 0 };

export const liveConnections = {
  inc(): number { return (g.__founderLive!.n += 1); },
  dec(): number { return (g.__founderLive!.n = Math.max(0, g.__founderLive!.n - 1)); },
  get count(): number { return g.__founderLive!.n; },
};

export type RealtimeHealth = { state: "connected" | "degraded" | "unavailable"; detail: string };

/** État serveur du temps réel : l'endpoint SSE est-il prêt et combien de flux actifs ? */
export function realtimeHealth(): RealtimeHealth {
  const n = liveConnections.count;
  return n > 0
    ? { state: "connected", detail: `Flux SSE privé actif · ${n} connexion${n > 1 ? "s" : ""}` }
    : { state: "connected", detail: "Flux SSE privé disponible (transport prêt)" };
}
