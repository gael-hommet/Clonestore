// src/lib/clonechat/visual/capture.ts
//
// Infrastructure de CAPTURES OFFICIELLES — déterministe et SÛRE. Ce module NE génère AUCUNE image
// (aucun générateur d'images) : il décrit une capture reproductible (route + viewport + état + jour/
// commit + empreinte) et garantit l'absence de contenu sensible dans les métadonnées. La capture
// réelle est prise par le navigateur (e2e/clonechat-visual-targets.spec.ts) hors du repo ; ici on ne
// manipule que des métadonnées redigées. Réutilise la redaction de CloneCare.

import { redactText } from "@/lib/clonechat/care";
import { truthVersionHash } from "@/lib/clonechat/product-truth/types";
import { CLONECHAT_CAPTURE_VERSION, type CaptureRef, type VisualViewport } from "./types";

/** États de page autorisés pour une capture (uniquement public ou synthétique/mocké). */
export const CAPTURE_ALLOWED_STATES: readonly string[] = ["public_rendered", "synthetic_authenticated"];

/** Empreinte déterministe d'une capture : route + viewport + état + ancres présentes (triées). */
export function computeCaptureFingerprint(route: string, viewport: VisualViewport, pageState: string, anchorsPresent: readonly string[]): string {
  const material = [route, viewport, pageState, [...anchorsPresent].sort().join(",")].join("|");
  return `cap_${truthVersionHash(material)}`;
}

/** Motifs interdits dans toute métadonnée de capture (défense en profondeur ; redaction en amont). */
const FORBIDDEN = /(authorization|cookie|set-cookie|bearer|password|secret|api[-_]?key|token)\b/i;

export interface BuildCaptureInput {
  readonly route: string;
  readonly viewport: VisualViewport;
  readonly pageState: string;
  readonly anchorsPresent: readonly string[];
  readonly commit: string | null;
  /** Chemin LOCAL hors-repo (jamais committé) ; null si non produite. */
  readonly path: string | null;
}

export type CaptureBuild =
  | { readonly ok: true; readonly capture: CaptureRef }
  | { readonly ok: false; readonly code: string; readonly reason: string };

/**
 * Construit une référence de capture SÛRE. Refuse un état non autorisé (jamais une entreprise réelle
 * non autorisée). Aucune image ici : uniquement des métadonnées redigées + empreinte reproductible.
 */
export function buildCaptureRef(input: BuildCaptureInput): CaptureBuild {
  if (!CAPTURE_ALLOWED_STATES.includes(input.pageState)) {
    return { ok: false, code: "CAPTURE_STATE_NOT_ALLOWED", reason: `État de page non autorisé pour une capture : ${input.pageState}.` };
  }
  // Défense : aucune ancre/route/commit ne doit contenir de secret (redaction + refus).
  const material = [input.route, input.pageState, input.commit ?? "", ...input.anchorsPresent].join(" ");
  if (FORBIDDEN.test(redactText(material)) || FORBIDDEN.test(material)) {
    return { ok: false, code: "CAPTURE_SENSITIVE_METADATA", reason: "Métadonnée de capture potentiellement sensible refusée." };
  }
  const fingerprint = computeCaptureFingerprint(input.route, input.viewport, input.pageState, input.anchorsPresent);
  const capture: CaptureRef = {
    version: CLONECHAT_CAPTURE_VERSION,
    route: redactText(input.route),
    viewport: input.viewport,
    pageState: input.pageState,
    fingerprint,
    commit: input.commit ? redactText(input.commit) : null,
    redacted: true,
    path: input.path, // hors-repo ; jamais committé (vérifié par le gate)
  };
  return { ok: true, capture };
}

/** Deux captures du MÊME état produisent la MÊME empreinte (reproductibilité). */
export function captureFingerprintsMatch(a: CaptureRef, b: CaptureRef): boolean {
  return a.fingerprint === b.fingerprint;
}
