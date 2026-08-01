// src/lib/clonechat/actions/trace.ts
//
// CloneTrace : trace structurée, versionnée, immutable et SÛRE. Réutilise la redaction déterministe
// de CloneCare. Interdits : token, cookie, clé API, secret, header d'auth, données d'un autre
// tenant, audio brut, transcript vocal complet, stack trace brute, PII inutile.

import { redactText } from "@/lib/clonechat/care";
import { hash } from "./keys";
import {
  CLONECHAT_TRACE_VERSION, type CloneTrace, type GuardDecision, type ActionState, type StructuredActionError,
} from "./types";

function safeAt(nowMs: number): string {
  // Temps INJECTÉ → ISO déterministe (jamais Date.now au niveau module).
  return new Date(nowMs).toISOString();
}

function safeError(e: StructuredActionError | null): StructuredActionError | null {
  if (!e) return null;
  return { code: redactText(e.code).slice(0, 80), message: redactText(e.message).slice(0, 300) };
}

export interface TraceInput {
  readonly actionId: string;
  readonly actionVersion: string;
  readonly nowMs: number;
  readonly viewerKey: string;
  readonly tenantKey: string;
  readonly guardDecision: GuardDecision;
  readonly confirmationToken: string | null;
  readonly idempotencyKey: string | null;
  readonly transitions: readonly ActionState[];
  readonly adapterId: string | null;
  readonly observableResult: string | null;
  readonly error: StructuredActionError | null;
  readonly finalStatus: ActionState;
}

export function buildTrace(input: TraceInput): CloneTrace {
  const traceId = `trc_${hash([input.actionId, input.actionVersion, input.viewerKey, input.tenantKey, String(input.nowMs), input.finalStatus].join("|"))}`;
  return Object.freeze({
    version: CLONECHAT_TRACE_VERSION,
    traceId,
    actionId: input.actionId,
    actionVersion: input.actionVersion,
    at: safeAt(input.nowMs),
    viewer: input.viewerKey, // déjà une clé sûre (jamais un secret)
    tenant: input.tenantKey, // déjà scopée
    guardDecision: input.guardDecision,
    confirmationToken: input.confirmationToken, // id (hash), jamais un secret brut
    idempotencyKey: input.idempotencyKey,
    transitions: Object.freeze([...input.transitions]),
    adapterId: input.adapterId,
    observableResult: input.observableResult ? redactText(input.observableResult).slice(0, 300) : null,
    error: safeError(input.error),
    finalStatus: input.finalStatus,
  });
}
