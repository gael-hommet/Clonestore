// src/lib/clonechat/inspector/evidence-json.ts
//
// Analyse JSON STRICTE et sûre : JSON.parse uniquement (aucune évaluation de code), limites de
// profondeur/taille, redaction récursive, détection des clés sensibles, garde anti-pollution de
// prototype, résumé sûr, rejet honnête du JSON invalide. Aucune résolution de chemin externe, aucune
// requête réseau déclenchée par le contenu.

import { redactText } from "@/lib/clonechat/care";

export const MAX_JSON_DEPTH = 8;
export const MAX_JSON_TEXT = 512 * 1024; // 512 Ko

const SENSITIVE_KEY = /(token|secret|password|passwd|pwd|api[_-]?key|apikey|authorization|cookie|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|bearer|signed[_-]?url|session)/i;
const DANGEROUS_KEY = /^(__proto__|prototype|constructor)$/;
const ERROR_CODEISH = /^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+$/; // ex. CHECKOUT_DECLINED

export interface JsonAnalysis {
  readonly ok: boolean;
  readonly invalidReason: string | null;
  readonly topLevelKeys: readonly string[];
  readonly sensitiveKeys: readonly string[];
  readonly errorCodes: readonly string[];
  readonly depthExceeded: boolean;
  readonly prototypePollution: boolean;
  readonly safeSummary: string; // redigé
}

/** Analyse un texte JSON. Ne throw jamais. */
export function analyzeJson(text: string): JsonAnalysis {
  const empty: JsonAnalysis = { ok: false, invalidReason: null, topLevelKeys: [], sensitiveKeys: [], errorCodes: [], depthExceeded: false, prototypePollution: false, safeSummary: "" };
  if (text.length > MAX_JSON_TEXT) return { ...empty, invalidReason: "TOO_LARGE" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ...empty, invalidReason: "INVALID_JSON" };
  }

  const sensitiveKeys = new Set<string>();
  const errorCodes = new Set<string>();
  let depthExceeded = false;
  let prototypePollution = false;

  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_JSON_DEPTH) { depthExceeded = true; return; }
    if (Array.isArray(node)) {
      for (const v of node.slice(0, 500)) walk(v, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      // On LIT uniquement les clés propres (jamais d'assignation → pas de pollution runtime).
      for (const key of Object.keys(node as Record<string, unknown>)) {
        if (DANGEROUS_KEY.test(key)) { prototypePollution = true; continue; } // détecté, JAMAIS traversé/assigné
        if (SENSITIVE_KEY.test(key)) sensitiveKeys.add(key);
        const v = (node as Record<string, unknown>)[key];
        if ((key.toLowerCase() === "code" || key.toLowerCase() === "error" || key.toLowerCase() === "error_code") && typeof v === "string" && ERROR_CODEISH.test(v)) {
          errorCodes.add(v);
        }
        walk(v, depth + 1);
      }
    }
  };
  walk(parsed, 0);

  const topLevelKeys = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? Object.keys(parsed as Record<string, unknown>).filter((k) => !DANGEROUS_KEY.test(k)).slice(0, 40)
    : [];

  // Résumé SÛR : forme (racine + clés de 1er niveau), jamais les valeurs (potentiellement sensibles).
  const shape = Array.isArray(parsed) ? `array[${(parsed as unknown[]).length}]` : (parsed && typeof parsed === "object" ? "object" : typeof parsed);
  const safeSummary = redactText(`JSON ${shape}${topLevelKeys.length ? ` — clés: ${topLevelKeys.join(", ")}` : ""}`).slice(0, 300);

  return {
    ok: true, invalidReason: null,
    topLevelKeys, sensitiveKeys: [...sensitiveKeys], errorCodes: [...errorCodes],
    depthExceeded, prototypePollution, safeSummary,
  };
}
