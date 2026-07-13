// src/lib/clonechat/intelligence/c1-1/parrain-retrieval.ts
// C1.1 — Moteur de récupération BORNÉ : visibilité d'abord (fail-closed), puis
// pertinence pondérée par l'AUTORITÉ. Ordre de priorité : artefact/fichier exactement
// référencé > contexte entreprise courant > route/page exacte > runtime/registre
// canonique > support validé > rapport vérifié > contenu téléversé > explication
// produit. La connaissance candidate/non vérifiée ne surclasse JAMAIS le canonique.

import { filterVisibleChunks } from "./parrain-visibility";
import {
  authorityRank,
  parrainNormalize,
  type ParrainKnowledgeChunk,
  type ParrainRetrievalResult,
  type ParrainRetrievedChunk,
  type ParrainViewerContext,
} from "./parrain-types";

export interface RetrievalOptions {
  readonly limit?: number;
  readonly maxChars?: number;
  /** Ids d'artefacts/fichiers explicitement référencés par l'utilisateur (priorité 1). */
  readonly referencedIds?: readonly string[];
}

const SOURCE_TYPE_BOOST: Readonly<Partial<Record<ParrainKnowledgeChunk["parrainSourceType"], number>>> = {
  uploaded_document: 1.5,
  generated_document: 1.5,
  company_context: 1.2,
  mission: 1.2,
  validation: 1.2,
  employee: 1.0,
  public_page: 0.8,
  capability_registry: 0.9,
  pricing_registry: 0.9,
  technology_registry: 0.8,
};

function relevance(chunk: ParrainKnowledgeChunk, words: readonly string[], query: string): number {
  const hay = parrainNormalize(`${chunk.title} ${chunk.text} ${(chunk.routes ?? []).join(" ")}`);
  let score = 0;
  for (const w of words) if (hay.includes(w)) score += 1;
  if ((chunk.routes ?? []).some((r) => query.includes(parrainNormalize(r)))) score += 3; // route exacte
  score += SOURCE_TYPE_BOOST[chunk.parrainSourceType] ?? 0;
  return score;
}

export function retrieveParrainChunks(
  question: string,
  candidates: readonly ParrainKnowledgeChunk[],
  viewer: ParrainViewerContext,
  opts?: RetrievalOptions,
): ParrainRetrievalResult {
  const limit = Math.min(opts?.limit ?? 8, 12);
  const maxChars = Math.min(opts?.maxChars ?? 3200, 6000);
  const excluded: { chunkId: string; reason: string }[] = [];

  // 1) VISIBILITÉ D'ABORD — rien d'invisible n'entre même dans le scoring.
  const visible = filterVisibleChunks(candidates, viewer);
  for (const c of candidates) {
    if (!visible.includes(c)) excluded.push({ chunkId: c.id, reason: "visibility_denied" });
  }

  const q = parrainNormalize(question);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const referenced = new Set(opts?.referencedIds ?? []);

  const scored: ParrainRetrievedChunk[] = visible.map((chunk) => {
    const rel = relevance(chunk, words, q) + (referenced.has(chunk.id) || referenced.has(chunk.sourceId) ? 10 : 0);
    return {
      chunk,
      relevance: rel,
      authorityScore: authorityRank(chunk.parrainAuthority),
      fresh: !chunk.stale,
    };
  });

  // 2) Classement : pertinence d'abord, autorité ensuite (le candidat ne surclasse
  //    jamais le canonique à pertinence égale), fraîcheur en dernier départage.
  const ranked = scored
    .filter((s) => s.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.authorityScore - a.authorityScore || Number(b.fresh) - Number(a.fresh));

  // 2bis) Anti-blanchiment : un chunk candidate/unverified ne peut JAMAIS précéder un
  //       chunk canonique qui matche aussi la question.
  const canonical = ranked.filter((s) => s.authorityScore >= 60);
  const weak = ranked.filter((s) => s.authorityScore < 60);
  const ordered = [...canonical, ...weak.filter((w) => w.authorityScore > 10), ...weak.filter((w) => w.authorityScore <= 10)];

  // 2ter) C1.7 — CAPACITÉ RÉSERVÉE À LA PIÈCE À CONVICTION DE L'UTILISATEUR.
  //
  // L'anti-blanchiment (2bis) place le canonique AVANT tout contenu utilisateur : c'est une
  // règle de SÉCURITÉ (un document hostile ne doit jamais surclasser la vérité produit) et elle
  // reste INTACTE. Mais elle avait un effet de bord : les 10 places étaient prises par le
  // canonique, et le fichier que l'utilisateur venait de joindre était éjecté (« limit_reached »).
  // Le modèle répondait alors « je ne vois aucun fichier joint » — alors qu'il était bien ingéré.
  //
  // Correction : les extraits ÉPINGLÉS (le fichier de l'utilisateur) obtiennent une capacité
  // RÉSERVÉE. Leur AUTORITÉ reste basse — ils ne réécrivent donc jamais la vérité produit — mais
  // ils sont PRÉSENTS, car ils sont la preuve de la question posée.
  const RESERVED_PINNED = 4;
  const RESERVED_CHARS = Math.floor(maxChars * 0.5);
  const pinned = scored
    .filter((s) => referenced.has(s.chunk.id) || referenced.has(s.chunk.sourceId))
    .sort((a, b) => b.relevance - a.relevance);

  const selected: ParrainRetrievedChunk[] = [];
  let chars = 0;
  const taken = new Set<string>();

  for (const s of pinned) {
    if (selected.length >= RESERVED_PINNED) { excluded.push({ chunkId: s.chunk.id, reason: "pinned_limit" }); continue; }
    if (chars + s.chunk.text.length > RESERVED_CHARS && selected.length > 0) { excluded.push({ chunkId: s.chunk.id, reason: "char_budget" }); continue; }
    selected.push(s);
    taken.add(s.chunk.id);
    chars += s.chunk.text.length;
  }

  // 3) Bornage caractères + limite (le reste du contexte, canonique d'abord).
  for (const s of ordered) {
    if (taken.has(s.chunk.id)) continue;
    if (selected.length >= limit) { excluded.push({ chunkId: s.chunk.id, reason: "limit_reached" }); continue; }
    if (chars + s.chunk.text.length > maxChars && selected.length > 0) { excluded.push({ chunkId: s.chunk.id, reason: "char_budget" }); continue; }
    selected.push(s);
    chars += s.chunk.text.length;
  }
  // Jamais vide si du visible existe (socle produit).
  if (selected.length === 0 && visible.length > 0) {
    const base = scored.sort((a, b) => b.authorityScore - a.authorityScore).slice(0, 2);
    for (const s of base) { selected.push(s); chars += s.chunk.text.length; }
  }

  // 4) Conflits : deux chunks de même sujet avec statuts contradictoires → surfacé.
  const conflicts: { topic: string; chunkIds: string[] }[] = [];
  const byTitle = new Map<string, ParrainRetrievedChunk[]>();
  for (const s of selected) {
    const key = parrainNormalize(s.chunk.title).slice(0, 40);
    const list = byTitle.get(key) ?? [];
    list.push(s);
    byTitle.set(key, list);
  }
  for (const [topic, list] of byTitle) {
    if (list.length > 1 && new Set(list.map((s) => s.chunk.contentHash)).size > 1) {
      conflicts.push({ topic, chunkIds: list.map((s) => s.chunk.id) });
    }
  }

  return Object.freeze({
    selected: Object.freeze(selected),
    totalChars: chars,
    excluded: Object.freeze(excluded),
    staleSourceIds: Object.freeze([...new Set(selected.filter((s) => !s.fresh).map((s) => s.chunk.sourceId))]),
    conflicts: Object.freeze(conflicts),
  });
}
