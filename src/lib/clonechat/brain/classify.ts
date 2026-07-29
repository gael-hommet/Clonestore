// src/lib/clonechat/brain/classify.ts
//
// Cœur DÉTERMINISTE du Brain : classification en 8 modes, résolution de route (validée contre le
// registre RÉEL — jamais inventée), et récupération de vérités depuis le Product Truth Engine.
// Aucun appel modèle : ces décisions sont l'autorité, le modèle ne fait que de la prose.

import { getRouteEntry } from "@/lib/nav/route-registry";
import { classifyCloneChatRequest } from "@/lib/clonechat/server/universal-access";
import { activeProductTruth } from "@/lib/clonechat/product-truth/registry";
import type { BrainAccountContext, BrainMode } from "./types";

// Marques combinantes (U+0300–U+036F) construites via new RegExp (gotcha connu du dépôt).
const COMBINING_MARKS_RE = new RegExp("[̀-ͯ]", "g");
export function norm(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(COMBINING_MARKS_RE, "").replace(/\s+/g, " ").trim();
}

// ── Résolution de route (déterministe, validée contre le registre RÉEL) ───────
// Chaque candidat est vérifié via getRouteEntry : une route absente du registre → jamais suggérée.
const ROUTE_INTENTS: ReadonlyArray<{ readonly re: RegExp; readonly path: string }> = [
  { re: /\breserv/, path: "/reserver/pierre" },
  { re: /\b(payer|paye|paiement|checkout|souscri|achet|regler|regl)/, path: "/checkout" },
  { re: /\b(demo|essayer|essai|tester)\b/, path: "/demo/pierre" },
  { re: /\b(connexion|connecter|login|me connecter|se connecter)\b/, path: "/login" },
  { re: /\b(cr[ée]er un compte|inscription|s'?inscrire|signup)\b/, path: "/signup" },
  { re: /\b(mon espace|mon compte|mon clonestore|mon profil|profil|espace client)\b/, path: "/profile" },
  { re: /\b(boutique|catalogue|employes ia|les employes|liste des employes)\b/, path: "/agents" },
  { re: /\b(support|assistance|contacter|une question|des questions|aide|probleme)\b/, path: "/questions" },
  { re: /\b(assistant|clonechat)\b/, path: "/assistant" },
  { re: /\b(cgv|conditions de vente)\b/, path: "/legal/cgv" },
  { re: /\b(cgu|conditions d'?utilisation)\b/, path: "/legal/cgu" },
  { re: /\b(confidentialite|vie privee|donnees personnelles|rgpd)\b/, path: "/legal/confidentialite" },
  { re: /\b(mentions legales)\b/, path: "/legal/mentions" },
  { re: /\bpierre\b/, path: "/agents/pierre" }, // défaut faible (dernier)
];

/** Résout la route la plus pertinente, VALIDÉE contre le registre réel. null si aucune vraie route. */
export function resolveRoute(message: string): string | null {
  const m = norm(message);
  for (const { re, path } of ROUTE_INTENTS) {
    if (re.test(m)) {
      const entry = getRouteEntry(path);
      if (entry && (entry.audience === "public" || entry.audience === "authenticated") && entry.status !== "deprecated" && entry.status !== "stub") {
        return entry.path;
      }
    }
  }
  return null;
}

// ── Récupération de vérités produit (lexicale, sur les vérités ACTIVES) ───────
const STOP = new Set(["le", "la", "les", "de", "des", "du", "un", "une", "et", "est", "que", "qui", "pour", "dans", "sur", "avec", "ce", "ca", "vous", "je", "tu", "il", "elle", "au", "aux", "en", "a", "sa", "son", "mes", "mon", "ma", "quel", "quelle", "comment", "pourquoi", "ou", "puis"]);

export interface TruthHit { readonly id: string; readonly evidence: string; }

export function retrieveTruths(message: string, limit = 5): TruthHit[] {
  const words = norm(message).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length === 0) return [];
  const scored: Array<{ id: string; evidence: string; score: number }> = [];
  for (const t of activeProductTruth()) {
    const hay = norm(`${t.key} ${t.id} ${t.value}`);
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (score > 0) scored.push({ id: t.id, evidence: t.evidence, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ id, evidence }) => ({ id, evidence }));
}

// ── Classification des 8 modes (déterministe, ordre de priorité) ──────────────
const RE_QUESTION_WHERE = /\b(ou\s+(aller|est|se trouve|puis-je|dois-je|je (peux|dois)|reserv|payer|paye|voir|acheter|trouver|configur|activ|m'?inscrire|me connecter|s'?inscrire)|sur quelle page|quelle page|vers quelle page|montre-?moi la page|je vais ou|je dois aller ou)/;
const RE_GUIDE = /\b(guide-?moi|accompagne-?moi|montre-?moi comment|aide-?moi a|pas a pas|etape par etape|comment (faire pour |je fais pour |proceder pour )?(reserv|payer|activ|configur|utilis|mettre en place))/;
const RE_EXPLAIN = /\b(explique|expliquer|expliquez|c'?est quoi|qu'?est-?ce que|qu'?est-?ce qu'|en quoi consiste|comment (ca |cela )?(marche|fonctionne)|quelle (est la )?difference|peux-?tu m'?expliquer|presente-?moi)\b/;
const RE_DIAGNOSE = /\b(pourquoi je (ne )?(peux|arrive|parviens) (pas|plus)|je (ne )?(peux|arrive|parviens) (pas|plus)|je suis bloque|je suis coince|(mon )?compte (est )?bloque|(est )?bloquee?\b|ca (ne )?(marche|fonctionne) pas|ne fonctionne pas|n'?arrive pas a|impossible de|j'?ai (une|un) (erreur|souci|probleme|bug)|erreur \d|refuse de)\b|pourquoi[^.?!]{0,40}\b(bloque|bloquee|ne (marche|fonctionne)|refuse|echoue|impossible)\b/;
const RE_ESCALATE = /\b(bug|plante|plantage|erreur 500|erreur serveur|rien ne (marche|fonctionne)|tout est casse|page blanche|ca marche pas du tout|completement bloque)\b/;
// Impératif d'ACTION opérationnelle adressé à l'assistant (« fais X pour moi »), pas une question.
const RE_ACT_IMPERATIVE = /\b(reserve|reserve-?moi|paie|paye|paye-?moi|active|active-?moi|achete|souscris|execute|lance|cree|cree-?moi|envoie|inscris-?moi|configure|configure-?moi|met|mets)\b/;
const RE_FOR_ME = /\b(pour moi|a ma place|a mon compte|de ma part)\b/;
const RE_QUESTIONISH = /\?|\b(est-?ce que|peux-?tu|pourrais-?tu|combien|quel|quelle|quels|quelles|qui|quand|comment|pourquoi|ou)\b/;

/** Message trop court/vague pour agir sans une question de clarification. */
function isVague(m: string): boolean {
  const words = m.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  if (words.length === 0) return true;
  if (m.length <= 3) return true;
  if (/^(aide|help|hello|salut|bonjour|coucou|hein|quoi|je sais pas|sais pas|euh)$/.test(m)) return true;
  return words.length < 2 && !RE_QUESTIONISH.test(m) && resolveRouteBare(m) === null;
}
function resolveRouteBare(m: string): string | null {
  for (const { re, path } of ROUTE_INTENTS) if (re.test(m) && path !== "/agents/pierre") return path;
  return null;
}

export interface ModeResult { readonly mode: BrainMode; readonly confidence: "high" | "medium" | "low"; readonly intent: string; }

/**
 * Classe le message dans exactement un mode (l'injection est traitée en amont dans brain.ts).
 * Ordre de priorité pensé pour lever les ambiguïtés réelles (guide vs orient vs act vs explain).
 */
export function classifyMode(message: string, account?: BrainAccountContext): ModeResult {
  const m = norm(message);
  const requestClass = classifyCloneChatRequest(message);

  if (isVague(m)) return { mode: "clarify", confidence: "high", intent: "ambiguous" };

  // ACT : demande d'exécuter une opération pour l'utilisateur, formulée à l'impératif (pas une
  // question). Signal renforcé par le classifieur existant (GOVERNED_ACTION_REQUIRED).
  const looksImperativeAction = RE_ACT_IMPERATIVE.test(m) && (RE_FOR_ME.test(m) || !RE_QUESTIONISH.test(m));
  if (looksImperativeAction || requestClass === "GOVERNED_ACTION_REQUIRED") {
    // « où réserver ? » / « comment réserver ? » ne sont PAS des actes (voir gardes ci-dessous).
    if (!RE_QUESTION_WHERE.test(m) && !RE_GUIDE.test(m)) {
      return { mode: "act", confidence: "high", intent: "operational_action_requested" };
    }
  }

  if (RE_ESCALATE.test(m)) return { mode: "escalate", confidence: "high", intent: "unresolved_or_bug" };
  if (RE_DIAGNOSE.test(m)) return { mode: "diagnose", confidence: "high", intent: "account_or_flow_blocker" };
  if (RE_GUIDE.test(m)) return { mode: "guide", confidence: "high", intent: "step_by_step_guidance" };
  if (RE_QUESTION_WHERE.test(m)) return { mode: "orient", confidence: "high", intent: "navigation" };
  if (RE_EXPLAIN.test(m)) return { mode: "explain", confidence: "high", intent: "explanation" };

  // Défaut : une question factuelle CloneStore/générale → answer.
  void account;
  const conf = RE_QUESTIONISH.test(m) ? "medium" : "low";
  return { mode: "answer", confidence: conf, intent: requestClass === "PRIVATE_CONTEXT_REQUIRED" ? "private_context_question" : "factual_question" };
}
