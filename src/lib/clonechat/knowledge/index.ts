// src/lib/clonechat/knowledge/index.ts
// P9.4.1 — Cerveau de connaissance : récupération BORNÉE + filtre de visibilité +
// citations validées serveur + porte de couverture + prompt grounded. SERVER-ONLY.

import {
  knowledgeChunks, invalidateKnowledgeCache,
} from "./sources";
import {
  allowedVisibilities, normalizeText, REQUIRED_CATEGORIES,
  type KnowledgeChunk, type KnowledgeViewer, type KnowledgeCategory,
} from "./types";

export * from "./types";
export { knowledgeChunks, invalidateKnowledgeCache, buildKnowledgeChunks } from "./sources";

const STOPWORDS = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "et", "que", "qui", "pour", "avec", "est", "sur", "dans", "mes", "vos", "quoi", "comment", "quel", "quelle"]);

/** Récupération BORNÉE : chunks pertinents et VISIBLES pour le viewer (top-k). */
export function retrieveKnowledge(query: string, viewer: KnowledgeViewer, limit = 6): KnowledgeChunk[] {
  const allowed = new Set(allowedVisibilities(viewer));
  const visible = knowledgeChunks().filter((k) => allowed.has(k.visibility));
  const words = normalizeText(query).split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const scored = visible.map((k) => {
    const hay = normalizeText(`${k.title} ${k.category} ${k.text} ${(k.routes ?? []).join(" ")}`);
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (k.category === "vision" || k.id.startsWith("employee.pierre")) score += 0.4; // socle utile
    if ((k.routes ?? []).some((r) => normalizeText(query).includes(normalizeText(r)))) score += 2; // route exacte prioritaire
    return { k, score };
  });
  const ranked = scored.sort((a, b) => b.score - a.score);
  // Toujours renvoyer au moins le socle si rien ne matche (jamais vide en public).
  const top = ranked.filter((s) => s.score > 0).slice(0, limit).map((s) => s.k);
  if (top.length === 0) return ranked.slice(0, Math.min(3, limit)).map((s) => s.k);
  return top;
}

/** Récupération sous budget de caractères (coût minimal) — tronque au chunk près. */
export function retrieveWithBudget(query: string, viewer: KnowledgeViewer, opts?: { limit?: number; maxChars?: number }): KnowledgeChunk[] {
  const limit = opts?.limit ?? 6;
  const maxChars = opts?.maxChars ?? 1800;
  const picked: KnowledgeChunk[] = [];
  let chars = 0;
  for (const k of retrieveKnowledge(query, viewer, limit)) {
    if (chars + k.text.length > maxChars && picked.length > 0) break;
    picked.push(k); chars += k.text.length;
  }
  return picked;
}

/** Étiquette de citation DISCRÈTE (jamais de chemin de fichier / table / hash au client). */
export function citationLabelFor(id: string): string | null {
  const k = knowledgeChunks().find((c) => c.id === id);
  return k ? k.citationLabel : null;
}

/**
 * Validation serveur des citations : ne garde que les IDs réellement présents dans le
 * contexte envoyé (et visibles). Toute citation inconnue est SUPPRIMÉE et signalée.
 */
export function validateCitations(ids: readonly string[], contextChunks: readonly KnowledgeChunk[]): { valid: string[]; labels: string[]; malformed: string[] } {
  const present = new Set(contextChunks.map((c) => c.id));
  const valid: string[] = [], labels: string[] = [], malformed: string[] = [];
  for (const id of ids ?? []) {
    if (present.has(id)) { valid.push(id); const l = citationLabelFor(id); if (l && !labels.includes(l)) labels.push(l); }
    else malformed.push(id);
  }
  return { valid, labels, malformed };
}

// ── Porte de couverture (§2) ─────────────────────────────────────────────────
export interface CategoryCoverage {
  readonly category: KnowledgeCategory;
  readonly indexedSources: number;
  readonly freshSources: number;
  readonly coveragePercent: number;
  readonly missing: boolean;
}
export interface CoverageReport {
  readonly categories: CategoryCoverage[];
  readonly totalChunks: number;
  readonly missingCategories: KnowledgeCategory[];
  readonly complete: boolean;
}

/** Calcule dynamiquement la couverture par catégorie obligatoire. */
export function computeCoverage(): CoverageReport {
  const chunks = knowledgeChunks();
  const categories = REQUIRED_CATEGORIES.map((category): CategoryCoverage => {
    const inCat = chunks.filter((c) => c.category === category);
    const fresh = inCat.filter((c) => c.freshnessStatus === "CURRENT").length;
    return {
      category, indexedSources: inCat.length, freshSources: fresh,
      coveragePercent: inCat.length === 0 ? 0 : Math.round((fresh / inCat.length) * 100),
      missing: inCat.length === 0,
    };
  });
  const missingCategories = categories.filter((c) => c.missing).map((c) => c.category);
  return { categories, totalChunks: chunks.length, missingCategories, complete: missingCategories.length === 0 };
}

// ── Instantané / invalidation (fraîcheur & intégrité) ────────────────────────
export function knowledgeSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const k of knowledgeChunks()) snap[k.id] = k.contentHash;
  return snap;
}
export function diffKnowledge(previous: Readonly<Record<string, string>>): { changed: string[]; added: string[]; removed: string[] } {
  const current = knowledgeSnapshot();
  const changed: string[] = [], added: string[] = [];
  for (const [id, hash] of Object.entries(current)) {
    if (!(id in previous)) added.push(id); else if (previous[id] !== hash) changed.push(id);
  }
  const removed = Object.keys(previous).filter((id) => !(id in current));
  return { changed, added, removed };
}

// ── Prompt grounded (borné, cité) ────────────────────────────────────────────
export function buildGroundedSystemPrompt(viewer: KnowledgeViewer, query: string): { system: string; contextChunks: KnowledgeChunk[] } {
  const contextChunks = retrieveWithBudget(query, viewer, { limit: 6, maxChars: 1800 });
  const facts = contextChunks.map((c) => `- [${c.id}] ${c.text}`).join("\n");
  const role = "Tu es CloneChat, l'assistant de CloneStore. Réponds en français, clair, chaleureux, sans jargon technique (jamais de mots comme runtime, queue, tenant, JSON, worker, table, SQL).";
  const grounding = `Base-toi UNIQUEMENT sur ces faits approuvés pour parler du produit :\n${facts}\nSi une question sort de ce cadre ou des données de l'utilisateur, dis honnêtement que tu ne sais pas plutôt que d'inventer. N'invente JAMAIS un prix, une route, un employé ou une fonctionnalité. Cite les faits utilisés par leur identifiant entre crochets dans "citations" (uniquement des identifiants présents ci-dessus).`;
  const honesty = "Distingue toujours : disponible / à venir / non disponible. Ne prétends jamais qu'une action a été exécutée sans confirmation réelle. Ne dis « je m'en souviendrai » que si une mémoire durable existe.";
  const toolGuidance = viewer === "authenticated"
    ? "Quand l'utilisateur veut préparer/créer/rédiger (contrat, attestation, e-mail, relance), propose l'outil prepare_mission. Pour consulter : list_missions, list_validations, list_employees, find_document, company_summary. Pour décider une validation : decide_validation (confirmation requise). Pour un problème : find_known_issue puis report_issue / create_support_case. Tu proposes, l'humain confirme, le système exécute."
    : "Tu es en mode orientation (utilisateur non connecté) : explique et oriente (navigate vers /demo/pierre, /agents/pierre, /login), mais n'accède à aucune donnée d'entreprise.";
  return { system: `${role}\n\n${grounding}\n\n${honesty}\n\n${toolGuidance}`, contextChunks };
}
