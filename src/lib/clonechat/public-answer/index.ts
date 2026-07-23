// src/lib/clonechat/public-answer/index.ts
// C1.8 A2 — POINT D'ENTRÉE de la voie publique : message ⇒ réponse honnête + destination unique.
//
// C'est la seule autorité de composition pour un visiteur non connecté. Elle remplace la
// concurrence entre le routeur de catégories hérité (texte) et la taxonomie de navigation (CTA) :
// une situation, un texte, une destination — et une garde fail-closed avant émission.

import { isRealDestinationRoute } from "../navigation/destination-registry";
import { ROUTE_LABEL, type PublicRoute } from "./public-canon";
import { classifyPublicSituation, type PublicSituation } from "./public-situation";
import { composePublicAnswer, hostilePrefix } from "./public-composer";
import { PUBLIC_GUARD_FALLBACK, checkPublicOutput } from "./public-output-guard";

export interface PublicAnswerLink {
  readonly route: string;
  readonly label: string;
}

export interface PublicAnswerResult {
  readonly answer: string;
  readonly cta: PublicAnswerLink | null;
  readonly links: readonly PublicAnswerLink[];
  readonly situation: PublicSituation["kind"];
  readonly reason: string;
  readonly escalate: boolean;
  readonly confidence: "high" | "medium" | "low";
  readonly commercialForbidden: boolean;
  readonly guardViolations: readonly string[];
}

function toLink(route: PublicRoute): PublicAnswerLink | null {
  // Anti-invention : une destination est émise seulement si la route existe réellement.
  if (!isRealDestinationRoute(route)) return null;
  return { route, label: ROUTE_LABEL[route] };
}

/** Résout la réponse publique d'un message. Déterministe, sans réseau, sans compte. */
export function resolvePublicAnswer(message: string): PublicAnswerResult {
  const situation = classifyPublicSituation(message);
  const composed = composePublicAnswer(situation, message);
  const prefix = hostilePrefix(situation);
  const text = prefix ? `${prefix} ${composed.answer}` : composed.answer;

  const cta = composed.route ? toLink(composed.route) : null;
  const links = composed.links.map(toLink).filter((l): l is PublicAnswerLink => l !== null);

  const verdict = checkPublicOutput({
    text,
    ctaRoute: cta?.route ?? null,
    linkRoutes: links.map((l) => l.route),
    commercialForbidden: composed.commercialForbidden,
  });

  if (!verdict.ok) {
    // Fail-closed : une composition non conforme n'est jamais émise telle quelle.
    return Object.freeze({
      answer: PUBLIC_GUARD_FALLBACK,
      cta: null,
      links: Object.freeze([]),
      situation: situation.kind,
      reason: `${situation.reason} — garde: ${verdict.violations.join(",")}`,
      escalate: true,
      confidence: "low" as const,
      commercialForbidden: composed.commercialForbidden,
      guardViolations: verdict.violations,
    });
  }

  return Object.freeze({
    answer: text,
    cta,
    links: Object.freeze(links),
    situation: situation.kind,
    reason: situation.reason,
    escalate: composed.escalate,
    confidence: composed.confidence,
    commercialForbidden: composed.commercialForbidden,
    guardViolations: Object.freeze([]),
  });
}

export { classifyPublicSituation } from "./public-situation";
export type { PublicSituation, PublicSituationKind } from "./public-situation";
export { checkPublicOutput, sanitizePublicText, PUBLIC_GUARD_FALLBACK, COMMERCIAL_ROUTES } from "./public-output-guard";
export * from "./public-canon";
