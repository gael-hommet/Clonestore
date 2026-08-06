// src/lib/clonechat/analytics/envelope.ts
//
// Construction + validation STRICTE de l'enveloppe d'événement. Rien n'est accepté qui ne corresponde
// à un événement du registre, avec un résultat possible, des champs autorisés, une route réelle et une
// taille bornée. Temps, identifiants et pseudonymisation INJECTÉS (tests déterministes).

import { getRouteEntry } from "@/lib/nav/route-registry";
import { redactText } from "@/lib/clonechat/care";
import { hash } from "@/lib/clonechat/actions/keys";
import { getEventSpec } from "./registry";
import { validateAndMinimizeMeta, MAX_ENVELOPE_BYTES, type Pseudonymizer } from "./privacy";
import {
  CLONECHAT_ANALYTICS_VERSION, FORBIDDEN_RESULTS, type AnalyticsEnvelope, type AnalyticsResult,
  type ConsentMode, type PipelineStage, type ValidatedEnvelope,
} from "./types";

export interface EmitInput {
  readonly eventName: string;
  /** Version DEMANDÉE (facultative). Si fournie et ≠ analytics-1 → rejet `invalid_version`. */
  readonly version?: string;
  readonly result: AnalyticsResult;
  readonly surface: string;
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly sessionId?: string | null;
  readonly route?: string | null;
  readonly durationMs?: number | null;
  readonly attempt?: number | null;
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly errorCode?: string | null;
  readonly viewerKey?: string | null; // clé SÛRE ; jamais stockée telle quelle
  readonly tenantKey?: string | null; // clé SÛRE ; jamais stockée telle quelle
  readonly meta?: Record<string, unknown>;
  readonly stage?: PipelineStage; // par défaut : celui du spec
}

export interface EnvelopeDeps {
  readonly nowMs: number;
  readonly environment: string;
  readonly pseudonymizer: Pseudonymizer;
  readonly consent: ConsentMode;
  readonly idFactory?: (material: string) => string;
}

function dedupKeyFor(strategy: string, eventName: string, correlationId: string, result: string, meta: Record<string, unknown>, eventIdSeed: string): string {
  switch (strategy) {
    case "per_correlation": return `${eventName}:${correlationId}`;
    case "per_dedup_key": return `${eventName}:${correlationId}:${result}:${String(meta.action ?? meta.journey ?? "")}`;
    default: return `${eventName}:${eventIdSeed}`; // "none" → unique, ne déduplique jamais
  }
}

/** Construit et VALIDE une enveloppe. Renvoie un rejet typé (jamais une exception). */
export function buildEnvelope(input: EmitInput, deps: EnvelopeDeps): ValidatedEnvelope {
  // Version DEMANDÉE : un événement d'une version inconnue est rejeté (n'atteint jamais sink/agrégateur).
  if (input.version !== undefined && input.version !== CLONECHAT_ANALYTICS_VERSION) {
    return { ok: false, reason: `invalid_version:${input.version}` };
  }

  const spec = getEventSpec(input.eventName);
  if (!spec) return { ok: false, reason: `unknown_event:${input.eventName}` };

  // Résultat : possible pour ce spec, et jamais un faux-succès interdit.
  if (FORBIDDEN_RESULTS.has(input.result)) return { ok: false, reason: `forbidden_result:${input.result}` };
  if (!spec.allowedResults.includes(input.result)) return { ok: false, reason: `impossible_result:${input.result}` };

  // Preuve observable obligatoire (ex. action.executed).
  if (spec.requiresObservableProof && (input.meta?.observable !== true)) {
    return { ok: false, reason: "missing_observable_proof" };
  }

  // Route : réelle (registre) ou null — jamais inventée.
  const route = input.route ?? null;
  if (route !== null && !getRouteEntry(route)) return { ok: false, reason: `unknown_route:${route}` };

  // Méta : allowlist stricte + minimisation.
  const allowed = new Set<string>([...spec.requiredMeta, ...spec.allowedMeta]);
  const metaV = validateAndMinimizeMeta(input.meta, allowed, spec.requiredMeta);
  if (!metaV.ok) return { ok: false, reason: metaV.reason };

  // Pseudonymisation (viewer/request/session tenant-scopés → distincts entre tenants ; aucun id brut).
  const tenantScope = input.tenantKey ?? "none";
  const tenantPseudo = input.tenantKey ? deps.pseudonymizer.pseudonymize("tenant", input.tenantKey) : null;
  const viewerPseudo = input.viewerKey ? deps.pseudonymizer.pseudonymize("viewer", `${input.viewerKey}@@${tenantScope}`) : null;
  // requestId/sessionId : JAMAIS conservés bruts (un e-mail / user-id / token ne doit pas transiter).
  // Toujours pseudonymisés (opaque, stable, tenant-scopé). Le tronquage seul serait insuffisant.
  const hasVal = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;
  const requestId = hasVal(input.requestId) ? deps.pseudonymizer.pseudonymize("request", `${input.requestId}@@${tenantScope}`) : null;
  const sessionId = hasVal(input.sessionId) ? deps.pseudonymizer.pseudonymize("session", `${input.sessionId}@@${tenantScope}`) : null;

  const occurredAtMs = deps.nowMs;
  const idFactory = deps.idFactory ?? ((m: string) => "evt_" + hash(m));
  const eventIdSeed = [input.eventName, input.correlationId, String(occurredAtMs), input.result, JSON.stringify(metaV.meta)].join("|");
  const eventId = idFactory(eventIdSeed);
  const dedupKey = dedupKeyFor(spec.dedup, input.eventName, input.correlationId, input.result, input.meta ?? {}, eventId);

  const envelope: AnalyticsEnvelope = Object.freeze({
    eventId,
    eventName: spec.name,
    version: CLONECHAT_ANALYTICS_VERSION,
    category: spec.category,
    stage: input.stage ?? spec.stage,
    nature: spec.nature,
    occurredAtMs,
    at: new Date(occurredAtMs).toISOString(),
    correlationId: input.correlationId,
    requestId,
    sessionId,
    route,
    surface: String(input.surface).slice(0, 40),
    environment: deps.environment,
    result: input.result,
    durationMs: typeof input.durationMs === "number" && Number.isFinite(input.durationMs) && input.durationMs >= 0 ? input.durationMs : null,
    attempt: typeof input.attempt === "number" && Number.isFinite(input.attempt) ? input.attempt : null,
    provider: input.provider ? String(input.provider).slice(0, 40) : null, // seulement si réellement connu
    model: input.model ? String(input.model).slice(0, 60) : null,
    errorCode: input.errorCode ? redactText(String(input.errorCode)).replace(/\s+/g, "_").slice(0, 80) : null,
    viewerPseudo,
    tenantPseudo,
    consent: deps.consent,
    dedupKey,
    meta: metaV.meta,
  });

  // Taille totale bornée (aucune sérialisation accidentelle d'objets volumineux).
  if (JSON.stringify(envelope).length > MAX_ENVELOPE_BYTES) return { ok: false, reason: "envelope_too_large" };

  return { ok: true, envelope, dedupKey };
}
