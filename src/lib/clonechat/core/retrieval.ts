// src/lib/clonechat/core/retrieval.ts
//
// CloneChat Unified Intelligence — récupération locale, lexicale, déterministe. AUCUN appel
// modèle : la récupération fournit du CONTEXTE au cerveau conversationnel, elle ne choisit
// jamais la réponse à sa place.
import { corpus, type CorpusUnit } from "./knowledge-corpus";

// Synonymes produit : chaque question est étendue par ses variantes avant le score lexical.
const SYNONYMS: readonly (readonly string[])[] = [
  ["pierre", "employe", "rh", "drh", "directeur"],
  ["clonechat", "assistant", "chat", "toi"],
  ["prix", "tarif", "cout", "abonnement", "combien"],
  ["gagner", "economiser", "rentabiliser", "gain", "rentable", "rentabilite", "roi"],
  ["entreprise", "societe", "cabinet", "boite", "pme"],
  ["mission", "tache", "demande"],
  ["validation", "approbation", "gouvernance", "controle"],
  ["reserver", "reservation", "activer"],
  ["payer", "paiement", "checkout", "facturation"],
  ["cockpit", "espace", "tableau"],
];

// Marques diacritiques combinantes (U+0300–U+036F) : construites via `new RegExp` depuis une
// chaîne, jamais un littéral `/[̀-ͯ]/` — un littéral regex contenant des marques combinantes
// brutes peut être mal interprété selon l'encodage/l'outillage (défaut déjà rencontré ailleurs
// dans ce dépôt sur l'inférence de documents Pierre).
const COMBINING_MARKS_RE = new RegExp("[̀-ͯ]", "g");

function normalizeFr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "") // retire les accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandTerms(words: readonly string[]): Set<string> {
  const out = new Set(words);
  for (const w of words) {
    for (const group of SYNONYMS) {
      if (group.includes(w)) for (const alt of group) out.add(alt);
    }
  }
  return out;
}

export interface RetrievalResult {
  readonly unit: CorpusUnit;
  readonly score: number;
}

const STOPWORDS = new Set(["le", "la", "les", "de", "des", "du", "un", "une", "et", "est", "que", "qui", "pour", "dans", "sur", "avec", "ce", "ca", "vous", "je", "tu", "il", "elle", "a", "au", "aux"]);

/**
 * Retourne les `limit` unités du corpus les plus pertinentes pour `question`, par score
 * lexical (occurrences de termes, expressions exactes bonus, synonymes produit). Pur.
 */
export function retrieve(question: string, limit = 6): readonly RetrievalResult[] {
  const norm = normalizeFr(question);
  const rawWords = norm.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (rawWords.length === 0) return [];
  const terms = expandTerms(rawWords);

  const scored: RetrievalResult[] = [];
  for (const u of corpus()) {
    const hay = normalizeFr(`${u.title} ${u.text}`);
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 1;
    }
    // Bonus expression exacte (2+ mots consécutifs de la question retrouvés tels quels).
    if (rawWords.length >= 2) {
      for (let i = 0; i < rawWords.length - 1; i++) {
        if (hay.includes(`${rawWords[i]} ${rawWords[i + 1]}`)) score += 2;
      }
    }
    // Priorité de source : la config runtime (1) pèse plus que les faits dérivés (4).
    if (score > 0) score += (5 - u.priority) * 0.25;
    if (score > 0) scored.push({ unit: u, score });
  }

  scored.sort((a, b) => b.score - a.score);
  // Déduplication par catégorie proche : évite de saturer le budget avec 5 variantes du même fait.
  const seenIds = new Set<string>();
  const out: RetrievalResult[] = [];
  for (const s of scored) {
    if (seenIds.has(s.unit.id)) continue;
    seenIds.add(s.unit.id);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Budget de caractères pour le contexte injecté au modèle — borne le coût par tour. */
const MAX_CONTEXT_CHARS = 4000;

/** Formate les passages récupérés en un bloc de contexte compact pour le prompt système. */
export function formatRetrievedContext(results: readonly RetrievalResult[]): string {
  if (results.length === 0) return "";
  let budget = MAX_CONTEXT_CHARS;
  const lines: string[] = [];
  for (const r of results) {
    const line = `[${r.unit.category}] ${r.unit.title} — ${r.unit.text}`;
    if (line.length > budget) break;
    lines.push(line);
    budget -= line.length;
  }
  return lines.join("\n");
}
