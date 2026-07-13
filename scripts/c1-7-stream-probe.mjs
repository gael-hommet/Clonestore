// Preuve DIRECTE du streaming serveur : on horodate CHAQUE morceau reçu.
// Un vrai flux arrive étalé dans le temps ; un flux bufferisé arrive d'un bloc.
const BASE = process.env.C1_7_BASE ?? "http://localhost:3140";
const t0 = Date.now();
const res = await fetch(`${BASE}/api/assistant/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Explique en détail comment Pierre aide un dirigeant à gagner du temps sur les contrats, l'onboarding et les relances.", stream: true }),
});
console.log("status:", res.status, "| content-type:", res.headers.get("content-type"));
const reader = res.body.getReader();
const dec = new TextDecoder();
const arrivals = [];
let deltas = 0, chars = 0;
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  const txt = dec.decode(value, { stream: true });
  const n = (txt.match(/event: delta/g) ?? []).length;
  if (n > 0) { deltas += n; chars += txt.length; arrivals.push({ tMs: Date.now() - t0, deltasInChunk: n }); }
}
const first = arrivals[0]?.tMs ?? null;
const last = arrivals.at(-1)?.tMs ?? null;
console.log(JSON.stringify({
  deltaEvents: deltas,
  networkChunksCarryingDeltas: arrivals.length,
  firstDeltaMs: first,
  lastDeltaMs: last,
  spreadMs: first !== null && last !== null ? last - first : null,
  arrivals: arrivals.slice(0, 10),
}, null, 2));
