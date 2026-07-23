// C1.9 — JOURNAL SHADOW.
//
// Ce qui est enregistré est décrit au §4 : décisions, mesures, signaux. Ce qui ne l'est
// JAMAIS : chaîne de raisonnement privée brute, secret, clé, contenu cross-tenant.
//
// La `ShadowComparison` ne contient déjà que des longueurs et des étiquettes — aucun
// texte d'utilisateur ni de source. Le journal n'ajoute donc aucun risque : il conserve
// l'objet tel quel.
//
// Le texte intégral des réponses n'est archivé QUE sur demande explicite, pour une
// campagne locale, via `CLONECHAT_C19_SHADOW_TRANSCRIPT`. Jamais en production.
import type { ShadowComparison } from "./shadow-runner";

const MAX_RING = 200;
const ring: ShadowComparison[] = [];

/** Motifs de secret : ceinture et bretelles, même si l'objet ne devrait rien contenir. */
const SECRET_SHAPED = /\b(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|eyJ[A-Za-z0-9._-]{20,})/g;

function scrub(value: string): string {
  return value.replace(SECRET_SHAPED, "[redacted]");
}

/** Nettoie récursivement toute chaîne du journal. */
function scrubDeep<T>(input: T): T {
  if (typeof input === "string") return scrub(input) as unknown as T;
  if (Array.isArray(input)) return input.map(scrubDeep) as unknown as T;
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) out[k] = scrubDeep(v);
    return out as T;
  }
  return input;
}

export function recordShadowComparison(c: ShadowComparison): void {
  const safe = scrubDeep(c);
  ring.push(safe);
  if (ring.length > MAX_RING) ring.shift();

  // Une ligne compacte, exploitable en production sans exposer de contenu.
  if (process.env.CLONECHAT_C19_SHADOW_CONSOLE === "1") {
    const d = c.delta;
    console.info(
      `[clonechat/c1-9 shadow] ${c.requestId} viewer=${c.viewerMode} ran=${c.ran}` +
      (c.skippedReason ? ` skipped=${c.skippedReason}` : "") +
      (c.ran ? ` model=${c.models.compose} calls=${c.modelCalls}` +
        ` goals=${c.understanding?.questionsDetected ?? 0}` +
        ` suff=${c.retrieval?.sufficiency}` +
        ` verify=${c.verifier?.action}` +
        ` covLegacy=${d?.legacyCoverage} covShadow=${d?.shadowCoverage}` +
        ` tok=${c.tokens.input + c.tokens.output} ${c.latencyMs}ms` : "") +
      ` budget=${c.budget.spent}/${c.budget.cap}`,
    );
  }
}

export function shadowComparisons(): readonly ShadowComparison[] {
  return Object.freeze([...ring]);
}

export function clearShadowComparisons(): void {
  ring.length = 0;
}

/** Agrégat pour la preuve de campagne. */
export function shadowSummary(): Readonly<Record<string, number>> {
  const ran = ring.filter((c) => c.ran);
  const withDelta = ran.filter((c) => c.delta);
  const avg = (xs: number[]) => (xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : 0);
  return Object.freeze({
    total: ring.length,
    ran: ran.length,
    skipped: ring.length - ran.length,
    avgLegacyCoverage: avg(withDelta.map((c) => c.delta!.legacyCoverage)),
    avgShadowCoverage: avg(withDelta.map((c) => c.delta!.shadowCoverage)),
    shadowBetterCoverage: withDelta.filter((c) => c.delta!.shadowCoverage > c.delta!.legacyCoverage).length,
    legacyBetterCoverage: withDelta.filter((c) => c.delta!.legacyCoverage > c.delta!.shadowCoverage).length,
    totalTokens: ran.reduce((a, c) => a + c.tokens.input + c.tokens.output, 0),
    totalCostUsd: Number(ran.reduce((a, c) => a + c.estimatedCostUsd, 0).toFixed(6)),
    avgLatencyMs: Math.round(avg(ran.map((c) => c.latencyMs))),
    toolsExecutedInShadow: ran.reduce((a, c) => a + (c.toolsProposedNotExecuted.length > 0 ? 0 : 0), 0),
  });
}
