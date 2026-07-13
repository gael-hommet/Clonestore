// src/lib/clonechat/openai/model-router.ts
// C1.7 §3 — ROUTEUR DE MODÈLE : pur, déterministe, sans le moindre appel IA.
//
// Doctrine :
//   · LUNA (`gpt-5.6-luna`) est le modèle par DÉFAUT — l'écrasante majorité des tours.
//   · TERRA (`gpt-5.6-terra`) n'est atteint QUE si une preuve de complexité l'exige.
//   · La QUALITÉ EST LIÉE À LA TÂCHE, JAMAIS AU COMPTE. Un visiteur anonyme et un client
//     Pierre posant la MÊME question obtiennent EXACTEMENT le même modèle. Aucun signal
//     d'identité, d'entreprise, de droit, ni de « valeur commerciale » n'entre ici — c'est
//     un invariant testé, pas une intention.
//
// « On n'appelle pas une IA pour choisir une IA. »

export type ClonechatReasoningLevel = "none" | "low" | "medium";
export type ClonechatImageDetail = "low" | "high";

/** Signaux OBSERVABLES du tour — jamais qui est l'utilisateur. */
export interface ModelRoutingInput {
  readonly message: string;
  /** Classe de demande (C1.6) — utile pour borner la sortie, jamais pour juger le compte. */
  readonly requestClass?: "CONVERSATIONAL_OR_PUBLIC" | "PRIVATE_CONTEXT_REQUIRED" | "GOVERNED_ACTION_REQUIRED";
  readonly documentCount?: number;
  /** Total des caractères extraits des documents joints. */
  readonly documentChars?: number;
  readonly imageCount?: number;
  /** Feuilles de calcul jointes (denses par nature). */
  readonly spreadsheetCount?: number;
  /** Le tour précédent a signalé des preuves contradictoires / insuffisantes. */
  readonly evidenceConflict?: boolean;
  /** Le modèle par défaut a déclaré ne pas pouvoir synthétiser de façon fiable. */
  readonly defaultModelDeclaredInsufficient?: boolean;
  /** L'image contient du texte fin / un graphique dense (détecté en amont, pas deviné ici). */
  readonly imageNeedsFineDetail?: boolean;
}

export interface ModelRoutingDecision {
  readonly model: string;
  readonly reasoning: ClonechatReasoningLevel;
  readonly maxOutputTokens: number;
  readonly imageDetail: ClonechatImageDetail;
  readonly escalated: boolean;
  /** Preuves EXACTES de l'escalade (vide si aucune). Auditable. */
  readonly reasons: readonly string[];
}

export interface ModelRouterConfig {
  readonly defaultModel: string;
  readonly complexModel: string;
  readonly allowedModels: readonly string[];
}

export const CANONICAL_DEFAULT_MODEL = "gpt-5.6-luna";
export const CANONICAL_COMPLEX_MODEL = "gpt-5.6-terra";

/** Configuration SERVEUR uniquement. Aucune clé ici, aucun modèle inconnu accepté. */
export function loadModelRouterConfig(env: NodeJS.ProcessEnv = process.env): ModelRouterConfig {
  const defaultModel = (env.CLONECHAT_MODEL_DEFAULT ?? "").trim() || CANONICAL_DEFAULT_MODEL;
  const complexModel = (env.CLONECHAT_MODEL_COMPLEX ?? "").trim() || CANONICAL_COMPLEX_MODEL;
  return Object.freeze({
    defaultModel,
    complexModel,
    allowedModels: Object.freeze([defaultModel, complexModel]),
  });
}

// ── Seuils d'escalade (déterministes, testés) ────────────────────────────────
const MANY_DOCUMENTS = 3;              // « plusieurs gros documents à comparer »
const LARGE_CORPUS_CHARS = 40_000;     // corpus documentaire dense
const MANY_IMAGES_WITH_DOCS = 2;       // combinaison image + document complexe

/** Demande EXPLICITE d'analyse stratégique approfondie (l'utilisateur la réclame). */
const EXPLICIT_DEEP_ANALYSIS =
  /\b(analyse|étude|audit)\s+(approfondie?|détaillée?|stratégique|complète)\b|\banalyse\s+en\s+profondeur\b|\bcompare\s+en\s+détail\b|\bsynthèse\s+stratégique\b/iu;

/** Diagnostic métier multi-étapes (« pourquoi X et que faire ensuite »). */
const MULTI_STEP_DIAGNOSIS =
  /\b(diagnostic|plan d'action|feuille de route|arbitrage)\b|\bpourquoi[^.?!]{0,60}\bet\b[^.?!]{0,60}\b(que faire|comment|quelles?\s+(étapes|actions))\b/iu;

/** Question factuelle directe → aucun raisonnement caché à dépenser. */
const DIRECT_FACTUAL =
  /^\s*(quel|quels|quelle|quelles|combien|c['’]est\s+quoi|qu['’]est[- ]ce|où|quand|est[- ]ce\s+que|prix|tarif)/iu;

/**
 * Décide du modèle. AUCUN paramètre d'identité n'existe dans la signature : il est
 * structurellement IMPOSSIBLE de router selon le compte.
 */
export function routeModel(input: ModelRoutingInput, cfg: ModelRouterConfig = loadModelRouterConfig()): ModelRoutingDecision {
  const msg = (input.message ?? "").trim();
  const docs = input.documentCount ?? 0;
  const chars = input.documentChars ?? 0;
  const images = input.imageCount ?? 0;
  const sheets = input.spreadsheetCount ?? 0;

  const reasons: string[] = [];

  // ── Preuves d'escalade — chacune doit être DÉMONTRABLE ──
  if (docs >= MANY_DOCUMENTS) reasons.push(`comparaison de ${docs} documents`);
  if (chars >= LARGE_CORPUS_CHARS) reasons.push(`corpus documentaire dense (${chars} caractères)`);
  if (input.evidenceConflict) reasons.push("preuves contradictoires entre les sources");
  if (sheets >= 1 && chars >= 8_000) reasons.push("interprétation d'un tableur dense");
  if (images >= MANY_IMAGES_WITH_DOCS && docs >= 1) reasons.push("combinaison image + document complexe");
  if (input.defaultModelDeclaredInsufficient) reasons.push("le modèle par défaut a déclaré les preuves insuffisantes");
  if (EXPLICIT_DEEP_ANALYSIS.test(msg)) reasons.push("analyse approfondie explicitement demandée");
  if (MULTI_STEP_DIAGNOSIS.test(msg) && (docs >= 1 || msg.length > 400)) reasons.push("diagnostic métier multi-étapes");

  const escalated = reasons.length > 0;
  const model = escalated ? cfg.complexModel : cfg.defaultModel;

  // ── Raisonnement : jamais dépensé parce que le message est LONG ──
  let reasoning: ClonechatReasoningLevel = "none";
  if (escalated) reasoning = "medium";
  else if (!DIRECT_FACTUAL.test(msg) && (docs > 0 || images > 0 || msg.length > 240)) reasoning = "low";

  // ── Sortie bornée par classe de demande (§6C) ──
  const maxOutputTokens = escalated ? 1600 : input.requestClass === "CONVERSATIONAL_OR_PUBLIC" ? 700 : 900;

  // ── Détail visuel : économique par défaut, fin UNIQUEMENT si justifié ──
  const imageDetail: ClonechatImageDetail = input.imageNeedsFineDetail ? "high" : "low";

  return Object.freeze({
    model,
    reasoning,
    maxOutputTokens,
    imageDetail,
    escalated,
    reasons: Object.freeze(reasons),
  });
}

/** Garde dure : le routeur ne peut JAMAIS produire un modèle hors de la liste autorisée. */
export function isAllowedModel(model: string, cfg: ModelRouterConfig = loadModelRouterConfig()): boolean {
  return cfg.allowedModels.includes(model);
}
