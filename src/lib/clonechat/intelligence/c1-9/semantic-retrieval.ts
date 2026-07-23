// C1.9 — RÉCUPÉRATION HYBRIDE.
//
// Remplace `relevance()` (comptage de SOUS-CHAÎNES, sans mots vides, sans frontière de
// mot, sans IDF, sans normalisation) qui produisait trois défauts mesurés :
//   D-lex  « paperasse / recruter / gérer » → 0 chunk ; le n°1 était CloneLearn,
//           retrouvé sur « eviter » + le mot vide « pour ».
//   D8     éviction par budget de caractères : `continue` au lieu d'un emballage, donc
//           le meilleur chunk (long) était jeté et remplacé par du bruit court.
//   D9     jamais vide : sur zéro correspondance le classement dégénérait vers l'ordre
//           des bonus de source, et le pipeline ne pouvait pas dire « rien trouvé ».
//
// La requête n'est plus faite des mots de l'utilisateur : elle est faite des BESOINS DE
// CONNAISSANCE écrits par le modèle à l'étape de compréhension, augmentés des entités
// et des faits de la conversation. C'est ce qui règle le problème de la paraphrase à la
// source plutôt que par des ancres écrites à la main.
import type { ParrainKnowledgeChunk, ParrainRetrievedChunk, ParrainViewerContext } from "../c1-1/parrain-types";
import { parrainNormalize } from "../c1-1/parrain-types";
import { filterVisibleChunks } from "../c1-1/parrain-visibility";

/** Mots vides français + interrogatifs. Absents de l'ancien moteur : c'est la cause de D-lex. */
const STOPWORDS = new Set([
  "alors", "aussi", "autre", "autres", "avec", "avoir", "bien", "cela", "celle", "celles", "celui",
  "cette", "ceux", "chaque", "chez", "comme", "comment", "dans", "depuis", "deux", "dire", "donc",
  "dont", "elle", "elles", "encore", "entre", "etre", "faire", "fait", "faut", "leur", "leurs",
  "mais", "meme", "moins", "notre", "nous", "parce", "pareil", "partir", "pas", "peut", "peuvent",
  "plus", "pour", "pourquoi", "pouvez", "pouvoir", "quand", "quel", "quelle", "quelles", "quels",
  "quelque", "quelques", "qui", "quoi", "sans", "sera", "seront", "ses", "son", "sont", "sous",
  "suis", "sur", "tous", "tout", "toute", "toutes", "trop", "tres", "une", "vers", "voir", "vos",
  "votre", "vous", "est", "les", "des", "aux", "que", "par", "ete", "ont", "cet", "ces", "mon",
  "ma", "mes", "ils", "elle", "lui", "eux", "ici", "la", "le", "de", "du", "un", "et", "ou",
  "combien", "besoin", "veux", "voudrais", "peux", "sais", "dit", "juste", "vraiment", "surtout",
  "faire", "fais", "ca", "cest", "jai", "nest", "yat",
]);

/**
 * Racinisation légère du français. Volontairement PRUDENTE : elle coupe les suffixes
 * flexionnels courants, pas les radicaux. Objectif : que « recruter » et « recrutement »,
 * « administratif » et « administrative » se rejoignent, sans fusionner des sens distincts.
 */
export function lightStem(w: string): string {
  let s = w;
  for (const suf of ["ements", "ement", "ations", "ation", "aient", "erais", "eront", "ance", "ence",
                     "ives", "ive", "ifs", "if", "eurs", "eur", "euse", "ees", "ee", "es", "er",
                     "ir", "ent", "ons", "ez", "s"]) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  }
  return s;
}

/** Tokenisation à frontière de mot, mots vides filtrés, racinisée. */
export function tokenize(text: string): readonly string[] {
  return Object.freeze(
    parrainNormalize(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(lightStem)
      .filter((w) => w.length > 2),
  );
}

export interface RetrievalQuery {
  /** Besoins de connaissance écrits par le modèle — le signal PRIMAIRE. */
  readonly knowledgeNeeds: readonly string[];
  /** Entités et faits de la conversation — le signal de CONTEXTE. */
  readonly contextTerms: readonly string[];
  /** Message brut — signal SECONDAIRE seulement, jamais l'autorité. */
  readonly rawMessage: string;
  /** Identifiants explicitement référencés (pièce jointe, document nommé). */
  readonly referencedIds?: readonly string[];
}

export type Sufficiency = "strong" | "weak" | "none";

export interface SemanticRetrievalResult {
  readonly selected: readonly ParrainRetrievedChunk[];
  readonly totalChars: number;
  readonly excluded: readonly { readonly chunkId: string; readonly reason: string }[];
  readonly staleSourceIds: readonly string[];
  /**
   * D9 corrigé : la récupération DIT ce qu'elle vaut. « none » autorise le pipeline à
   * demander une précision au lieu de grounder sur du bruit.
   */
  readonly sufficiency: Sufficiency;
  readonly matchedTerms: readonly string[];
  readonly unmatchedNeeds: readonly string[];
}

export interface SemanticRetrievalOptions {
  readonly maxChunks?: number;
  readonly maxChars?: number;
}

/**
 * Budget de contexte.
 *
 * `maxChars` relevé de 3 400 à 5 200 après mesure : sur « mes données restent privées ? »
 * et « qu'est-ce qui m'assure qu'il ne dira pas n'importe quoi ? », les énoncés de
 * politique (isolation des données, proposition puis confirmation) étaient CLASSÉS mais
 * évincés par le budget de caractères — sept chunks retenus, la politique en huitième. La
 * réponse omettait alors la garantie qu'on lui demandait, faute de l'avoir reçue. Un
 * contexte trop serré ne rend pas la réponse plus précise : il la rend incomplète.
 */
const DEFAULTS = { maxChunks: 10, maxChars: 5200 } as const;

/** Autorité → rang numérique (départage, jamais autorité principale). */
function authorityRank(chunk: ParrainKnowledgeChunk): number {
  const a = chunk.parrainAuthority as unknown as string;
  if (a === "canonical") return 100;
  if (a === "verified") return 80;
  if (a === "declared") return 60;
  return 40;
}

interface Scored {
  readonly chunk: ParrainKnowledgeChunk;
  readonly score: number;
  readonly matched: readonly string[];
}

/**
 * Fréquence documentaire inverse sur le corpus VISIBLE. Un terme présent partout ne
 * discrimine rien ; un terme rare porte le sens. C'est ce qui empêche un mot passe-partout
 * de faire remonter cinq encarts technologiques sans rapport.
 */
function buildIdf(chunks: readonly ParrainKnowledgeChunk[]): ReadonlyMap<string, number> {
  const df = new Map<string, number>();
  for (const c of chunks) {
    const seen = new Set(tokenize(`${c.title} ${c.text}`));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = Math.max(1, chunks.length);
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + n / (1 + d)));
  return idf;
}

function scoreChunk(
  chunk: ParrainKnowledgeChunk,
  weighted: ReadonlyMap<string, number>,
  idf: ReadonlyMap<string, number>,
  query: RetrievalQuery,
): Scored {
  const chunkTokens = tokenize(`${chunk.title} ${chunk.text} ${(chunk.routes ?? []).join(" ")}`);
  const present = new Set(chunkTokens);
  const matched: string[] = [];
  let score = 0;

  for (const [term, weight] of weighted) {
    if (!present.has(term)) continue;
    matched.push(term);
    // Pertinence = poids du signal × pouvoir discriminant du terme.
    score += weight * (idf.get(term) ?? 1);
  }

  // Normalisation par longueur : un chunk long ne gagne pas en accumulant des banalités.
  // Racine carrée plutôt que division directe, pour ne pas pénaliser à l'excès une source
  // riche et légitime.
  if (chunkTokens.length > 0) score = score / Math.sqrt(chunkTokens.length / 40 + 1);

  // Un identifiant explicitement référencé est une demande directe, pas une devinette.
  if (query.referencedIds?.some((id) => id === chunk.id || id === chunk.sourceId)) score += 25;

  // Route citée telle quelle dans le message : signal fort et non ambigu.
  const normMsg = parrainNormalize(query.rawMessage);
  if ((chunk.routes ?? []).some((r) => r.length > 3 && normMsg.includes(parrainNormalize(r)))) score += 4;

  return { chunk, score, matched: Object.freeze(matched) };
}

/**
 * Emballage sous contrainte de caractères — corrige D8.
 *
 * L'ancien code faisait `continue` : un chunk trop gros pour le reste du budget était
 * ÉVINCÉ, puis des chunks plus courts et moins pertinents remplissaient l'espace. On
 * retient ici l'ensemble de meilleure valeur : on parcourt par pertinence décroissante et
 * on n'autorise un chunk moins pertinent à occuper la place d'un meilleur que si ce
 * dernier ne rentre dans AUCUN budget restant. Concrètement : le meilleur chunk est
 * toujours pris en premier, donc jamais évincé par un moins bon.
 */
/**
 * Une entrée de PLAN DE SITE décrit une destination, pas une connaissance. Elle ne peut
 * déjà plus couvrir un besoin à elle seule ; elle ne doit pas non plus occuper la place
 * d'un énoncé de fond.
 *
 * Mesuré : sur « mes données restent privées ? », cinq des dix chunks retenus étaient des
 * noms de pages (/legal/dpa, /legal/confidentialite, /questions…). L'énoncé d'isolation
 * des données, pourtant public et pertinent, n'entrait plus — et la réponse omettait
 * précisément la garantie demandée. Deux destinations suffisent à proposer un lien juste.
 */
const MAX_NAVIGATIONAL_CHUNKS = 2;

function packWithinBudget(
  ranked: readonly Scored[],
  maxChunks: number,
  maxChars: number,
): { readonly kept: readonly Scored[]; readonly excluded: readonly { chunkId: string; reason: string }[] } {
  const kept: Scored[] = [];
  const excluded: { chunkId: string; reason: string }[] = [];
  let chars = 0;
  let navigational = 0;
  for (const s of ranked) {
    if (kept.length >= maxChunks) { excluded.push({ chunkId: s.chunk.id, reason: "max_chunks" }); continue; }
    if (s.chunk.sourceId === "src.site_index") {
      if (navigational >= MAX_NAVIGATIONAL_CHUNKS) {
        excluded.push({ chunkId: s.chunk.id, reason: "navigational_quota" });
        continue;
      }
      navigational += 1;
    }
    const len = s.chunk.text.length;
    if (chars + len > maxChars) {
      // Le budget est plein pour ce chunk. On ne remplit PAS avec du bruit : on s'arrête
      // dès qu'il ne reste pas de place utile, pour ne pas diluer le contexte.
      if (maxChars - chars < 400) { excluded.push({ chunkId: s.chunk.id, reason: "char_budget" }); continue; }
      excluded.push({ chunkId: s.chunk.id, reason: "char_budget" });
      continue;
    }
    kept.push(s);
    chars += len;
  }
  return { kept, excluded };
}

export function retrieveSemantic(
  candidates: readonly ParrainKnowledgeChunk[],
  viewer: ParrainViewerContext,
  query: RetrievalQuery,
  options: SemanticRetrievalOptions = {},
): SemanticRetrievalResult {
  const maxChunks = options.maxChunks ?? DEFAULTS.maxChunks;
  const maxChars = options.maxChars ?? DEFAULTS.maxChars;

  // VISIBILITÉ D'ABORD — inchangé, et volontairement : c'est la partie solide de l'existant.
  const visible = filterVisibleChunks(candidates, viewer);
  if (visible.length === 0) {
    return Object.freeze({
      selected: Object.freeze([]), totalChars: 0,
      excluded: Object.freeze(candidates.map((c) => ({ chunkId: c.id, reason: "visibility_denied" }))),
      staleSourceIds: Object.freeze([]), sufficiency: "none" as const,
      matchedTerms: Object.freeze([]), unmatchedNeeds: Object.freeze(query.knowledgeNeeds),
    });
  }

  // Pondération des trois signaux. Les besoins écrits par le modèle dominent ; le message
  // brut est un appoint. C'est l'inversion exacte de l'ancien comportement.
  const weighted = new Map<string, number>();
  const bump = (text: string, w: number) => {
    for (const t of tokenize(text)) weighted.set(t, Math.max(weighted.get(t) ?? 0, w));
  };
  for (const need of query.knowledgeNeeds) bump(need, 3);
  for (const term of query.contextTerms) bump(term, 2);
  bump(query.rawMessage, 1);

  const idf = buildIdf(visible);
  const scored = visible
    .map((c) => scoreChunk(c, weighted, idf, query))
    .filter((s) => s.score > 0);

  // D9 : aucune correspondance réelle → on le DIT, on ne retombe pas sur l'ordre des bonus.
  if (scored.length === 0) {
    return Object.freeze({
      selected: Object.freeze([]), totalChars: 0,
      excluded: Object.freeze(visible.map((c) => ({ chunkId: c.id, reason: "no_match" }))),
      staleSourceIds: Object.freeze([]), sufficiency: "none" as const,
      matchedTerms: Object.freeze([]), unmatchedNeeds: Object.freeze(query.knowledgeNeeds),
    });
  }

  const ranked = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ar = authorityRank(a.chunk), br = authorityRank(b.chunk);
    if (br !== ar) return br - ar;
    if (a.chunk.stale !== b.chunk.stale) return a.chunk.stale ? 1 : -1;
    return a.chunk.id.localeCompare(b.chunk.id); // départage STABLE, jamais l'ordre d'insertion
  });

  const { kept, excluded } = packWithinBudget(ranked, maxChunks, maxChars);

  // Une entrée de PLAN DE SITE décrit une destination, pas un fait. « /legal/dpa — DPA.
  // Data Processing Agreement. » contient le mot « données » et satisfaisait donc le besoin
  // « isolation des données » — la récupération se déclarait alors `strong` en n'ayant
  // trouvé que des noms de pages, et le modèle, croyant être documenté, complétait de
  // lui-même. Ces entrées restent SÉLECTIONNÉES (elles servent à proposer un lien juste),
  // mais elles ne peuvent plus, à elles seules, déclarer un besoin de connaissance couvert.
  const isNavigational = (c: { sourceId: string }) => c.sourceId === "src.site_index";
  const substantiveMatchedTerms = [...new Set(kept.filter((s) => !isNavigational(s.chunk)).flatMap((s) => s.matched))];
  const matchedTerms = [...new Set(kept.flatMap((s) => s.matched))];
  const needTokens = new Map<string, readonly string[]>();
  for (const need of query.knowledgeNeeds) needTokens.set(need, tokenize(need));
  const unmatchedNeeds = query.knowledgeNeeds.filter((need) => {
    const toks = needTokens.get(need) ?? [];
    return toks.length > 0 && !toks.some((t) => substantiveMatchedTerms.includes(t));
  });

  const top = kept[0]?.score ?? 0;
  // La suffisance se juge sur la COUVERTURE DES BESOINS, pas sur des correspondances
  // incidentes du message brut. « Explique-moi la photosynthèse » peut faire résonner le
  // mot « explique » dans une source produit : ce n'est pas une réponse au besoin, et le
  // pipeline doit pouvoir le dire au lieu de grounder sur du bruit.
  const coverage = query.knowledgeNeeds.length === 0
    ? (top > 0 ? 1 : 0)
    : 1 - unmatchedNeeds.length / query.knowledgeNeeds.length;
  const sufficiency: Sufficiency =
    coverage === 0 ? "none" : top >= 2 && coverage >= 0.5 ? "strong" : "weak";

  // Aucun besoin couvert : on ne remet PAS de contexte au modèle. Un contexte hors sujet
  // est pire qu'un contexte vide — c'est exactement ce qui faisait répondre « pays non
  // couvert » à une question de géographie.
  const final = coverage === 0 ? [] : kept;

  return Object.freeze({
    selected: Object.freeze(final.map((s) => Object.freeze({
      chunk: s.chunk,
      relevance: Number(s.score.toFixed(4)),
      authorityScore: authorityRank(s.chunk),
      fresh: !s.chunk.stale,
    }))) as readonly ParrainRetrievedChunk[],
    totalChars: final.reduce((a, s) => a + s.chunk.text.length, 0),
    excluded: Object.freeze(
      coverage === 0
        ? [...excluded, ...kept.map((s) => ({ chunkId: s.chunk.id, reason: "need_not_covered" }))]
        : excluded,
    ),
    staleSourceIds: Object.freeze(final.filter((s) => s.chunk.stale).map((s) => s.chunk.sourceId)),
    sufficiency,
    matchedTerms: Object.freeze(matchedTerms),
    unmatchedNeeds: Object.freeze(unmatchedNeeds),
  });
}
