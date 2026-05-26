// src/lib/security/errors.ts
// B41 — Standard security error responses. No external deps.

import type { SecurityDecisionStatus } from "./types";

export type SecurityErrorResponse = {
  ok: false;
  error: string;
  code: SecurityDecisionStatus;
  status: number;
};

const DECISION_TO_HTTP: Record<SecurityDecisionStatus, number> = {
  allow: 200,
  block_auth_required: 401,
  block_not_paid: 403,
  block_no_company: 403,
  block_no_agent_access: 403,
  block_tenant_mismatch: 403,
  block_sensitive_scope: 403,
  block_rate_limited: 429,
  block_service_role_required: 403,
  block_invalid_payload: 400,
  block_emergency_shutdown: 503,
};

const DECISION_TO_MESSAGE: Record<SecurityDecisionStatus, string> = {
  allow: "Accès autorisé.",
  block_auth_required: "Authentification requise.",
  block_not_paid: "Abonnement actif requis.",
  block_no_company: "Aucune entreprise associée à ce compte.",
  block_no_agent_access: "Accès Pierre requis.",
  block_tenant_mismatch: "Accès non autorisé pour ce tenant.",
  block_sensitive_scope: "Portée sensible — accès restreint.",
  block_rate_limited: "Trop de requêtes — réessayez dans quelques instants.",
  block_service_role_required: "Route réservée au service interne.",
  block_invalid_payload: "Payload invalide ou champs interdits détectés.",
  block_emergency_shutdown: "Service temporairement indisponible.",
};

export function buildSecurityErrorResponse(
  code: SecurityDecisionStatus,
  overrideMessage?: string,
): SecurityErrorResponse {
  return {
    ok: false,
    error: overrideMessage ?? DECISION_TO_MESSAGE[code] ?? "Accès refusé.",
    code,
    status: DECISION_TO_HTTP[code] ?? 403,
  };
}

export function getHttpStatusForDecision(code: SecurityDecisionStatus): number {
  return DECISION_TO_HTTP[code] ?? 403;
}

export function getMessageForDecision(code: SecurityDecisionStatus): string {
  return DECISION_TO_MESSAGE[code] ?? "Accès refusé.";
}
