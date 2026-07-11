// src/lib/clonechat/intelligence/c1-1/parrain-code-index.ts
// C1.1 — Index code interne FOUNDER_INTERNAL uniquement. Manifeste borné de symboles,
// généré par scripts/clonechat-build-code-index.mjs depuis une ALLOWLIST (jamais .env,
// secrets, node_modules, uploads, binaires). Jamais de fichier source brut vers le
// modèle : uniquement des résumés de symboles. Jamais exposé au public/client — pour
// eux, l'évidence interne devient une explication produit sûre.

import { containsSecretMaterial } from "./parrain-visibility";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import { checkSourceFreshness, type FreshnessCheck } from "./parrain-freshness";
import { parrainNormalize, type ParrainKnowledgeChunk } from "./parrain-types";

export interface ParrainCodeSymbol {
  readonly symbolId: string;
  readonly symbolName: string;
  readonly kind: "function" | "const" | "interface" | "type" | "class" | "route" | "component" | "test" | "report";
  readonly filePath: string;
  readonly exported: boolean;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
  readonly summary: string;
  readonly imports: readonly string[];
  readonly relatedTests: readonly string[];
  readonly phaseMarkers: readonly string[];
  readonly contentHash: string;
  readonly visibility: "FOUNDER_INTERNAL";
}

export interface ParrainCodeIndexManifest {
  readonly generatedAt: string;
  readonly allowlistHash: string;
  readonly sourceTreeHash: string;
  readonly symbols: readonly ParrainCodeSymbol[];
}

/** Allowlist canonique (miroir du script de génération — testée). */
export const CODE_INDEX_ALLOWLIST: readonly string[] = Object.freeze([
  "src/lib/clonechat",
  "src/lib/clonestore",
  "src/lib/pierre/v1",
  "src/app/api/assistant",
  "src/app/api/pierre",
  "src/components",
  "scripts",
]);

export const CODE_INDEX_EXCLUDES: readonly RegExp[] = Object.freeze([
  /\.env/i,
  /node_modules/,
  /\.next/,
  /dist\//,
  /\.p\d+-proofs/,
  /\.c1(-1)?-proofs/,
  /uploads?/i,
  /secret|credential|private-?key/i,
  /\.(png|jpg|jpeg|webp|ico|pdf|zip|db|sqlite)$/i,
]);

export function pathAllowedInCodeIndex(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (CODE_INDEX_EXCLUDES.some((rx) => rx.test(normalized))) return false;
  return CODE_INDEX_ALLOWLIST.some((prefix) => normalized.startsWith(prefix));
}

const INDEX_RELATIVE_PATH = ".c1-1-index/code-index.json";

/**
 * Charge le manifeste généré (serveur uniquement — import dynamique de node:fs pour ne
 * jamais entrer dans un bundle client). Absent → null (le command center le signale).
 */
export async function loadCodeIndexManifest(cwd?: string): Promise<ParrainCodeIndexManifest | null> {
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const raw = readFileSync(resolve(cwd ?? process.cwd(), INDEX_RELATIVE_PATH), "utf8");
    const parsed = JSON.parse(raw) as ParrainCodeIndexManifest;
    if (!Array.isArray(parsed.symbols)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Fraîcheur : STALE si le hash d'arbre source enregistré diffère du hash live fourni. */
export function codeIndexFreshness(manifest: ParrainCodeIndexManifest | null, liveTreeHash: string | null): FreshnessCheck {
  return checkSourceFreshness("generated_index", manifest?.sourceTreeHash ?? null, liveTreeHash);
}

/** Recherche bornée de symboles (fondateur uniquement — la visibilité est portée par le chunk). */
export function searchCodeSymbols(
  manifest: ParrainCodeIndexManifest,
  query: string,
  limit = 5,
): readonly ParrainCodeSymbol[] {
  const q = parrainNormalize(query);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return manifest.symbols
    .map((s) => {
      const hay = parrainNormalize(`${s.symbolName} ${s.filePath} ${s.summary} ${s.phaseMarkers.join(" ")}`);
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      if (q.includes(parrainNormalize(s.symbolName))) score += 3;
      return { s, score };
    })
    .filter((x) => x.score > 0 && !containsSecretMaterial(x.s.summary))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, 8))
    .map((x) => x.s);
}

/** Chunks code — TOUJOURS FOUNDER_INTERNAL (le filtre de visibilité fait le reste). */
export function codeSymbolChunks(symbols: readonly ParrainCodeSymbol[]): readonly ParrainKnowledgeChunk[] {
  return symbols.slice(0, 6).map((s) =>
    makeParrainChunk({
      id: `code.${s.symbolId}`,
      sourceId: "src.code_index",
      title: s.symbolName,
      text: `${s.symbolName} (${s.kind}) — ${s.filePath}${s.lineStart ? `:${s.lineStart}` : ""}. ${s.summary}${s.relatedTests.length ? ` Tests liés : ${s.relatedTests.slice(0, 2).join(", ")}.` : ""}`,
      sourceType: "code_symbol",
      authority: "canonical_registry",
      visibility: "FOUNDER_INTERNAL",
      citationLabel: "le code interne",
    }),
  );
}
