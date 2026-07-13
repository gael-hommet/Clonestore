// src/lib/clonechat/server/no-company-gate.ts
// C1.3 — Porte « pas d'entreprise active ». Un utilisateur AUTHENTIFIÉ sans entreprise
// active peut toujours poser des questions PUBLIQUES (produit, Pierre, prix, pays, vente,
// navigation, support général) via le mode découverte. Seules les questions/actions
// qui touchent aux DONNÉES ou aux ACTIONS de l'entreprise exigent une entreprise active.
//
// Ce classifieur est PUR et déterministe : il aide UNIQUEMENT à choisir le mode.
// Il ne décide JAMAIS d'une autorisation tenant — l'accès aux données d'entreprise reste
// résolu côté serveur et permission-scopé. Le mode public n'expose aucune source tenant,
// donc une erreur de classification ne peut pas fuiter de donnée : le défaut est PUBLIC.

import { routeCloneChatQuestion } from "../intelligence/c1/clonechat-answer-router";

export type NoCompanyIntent = "public" | "company" | "ambiguous";

// Référence possessive à l'entreprise / ses données → exige une entreprise.
const COMPANY_POSSESSIVE =
  /\b(mon|ma|mes|notre|nos)\s+(entreprise|soci[eé]t[eé]|salari[eé]s?|employ[eé]s?|[eé]quipe|missions?|validations?|documents?|dossiers?|contrats?|donn[eé]es)\b/iu;

// « les/des documents|salariés|… de <Nom propre> » → données d'un membre de l'entreprise.
const COMPANY_DATA_REF =
  /\b(le|la|les|des|un|une)\s+(documents?|salari[eé]s?|employ[eé]s?|missions?|validations?|dossiers?|contrats?|avenants?|attestations?)\s+(de|du|des|pour)\s+\p{Lu}|\b(document|dossier|contrat|mission|avenant|attestation|salari[eé]|employ[eé])s?\s+de\s+\p{Lu}/iu;

// Question SUR une capacité / le produit (« comment… », « que peut… », « quels prix… »)
// → publique, même si un verbe d'action apparaît (« comment préparer un onboarding ? »).
const CAPABILITY_QUESTION =
  /^\s*(comment|pourquoi|que\b|qu['’e]|quel|quels|quelle|quelles|est[- ]ce|peux[- ]tu|peut[- ]on|pouvez[- ]vous|as[- ]tu|avez[- ]vous|combien|c['’]est\s+quoi|qu['’]est[- ]ce|à\s+quoi|où\b|puis[- ]je|dois[- ]je)/iu;

// Action RH IMPÉRATIVE + objet RH → exige une entreprise (effet sur le tenant).
const COMPANY_ACTION =
  /(pr[eé]pare|cr[eé]e|r[eé]dige|g[eé]n[eè]re|lance|organise|planifie|envoie|corrige|montre|affiche|analyse|continue|met[s]?\s+en\s+place|termine|finalise)\b[^.?!]{0,48}\b(onboarding|offboarding|contrat|avenant|attestation|document|dossier|mission|relance|courrier|salari[eé]|employ[eé]|absence|validation)\b/iu;

// « onboarding de <Nom propre> » (ex. « Prépare l'onboarding de Sarah »).
const COMPANY_NAMED = /\bonboarding\s+de\s+\p{Lu}/u;

// Verbe d'action nu, sans objet (≤ 3 mots) → ambigu (demander une clarification).
const BARE_ACTION =
  /^\s*(continue|montre|affiche|envoie|analyse|pr[eé]pare|cr[eé]e|corrige|lance|organise|r[eé]dige|g[eé]n[eè]re|termine|finalise)\b/iu;

const PUBLIC_CATEGORIES = new Set([
  "pricing",
  "country_availability",
  "product_explanation",
  "pierre_explanation",
  "technology_explanation",
  "demo_or_reservation",
  "sales_objection",
  "site_navigation",
  "roadmap",
  "legal_or_compliance",
  "support_bug",
]);

/**
 * Classe une requête d'un utilisateur AUTHENTIFIÉ SANS entreprise active.
 * Ordre : données/possessif tenant → question de capacité → action RH → verbe nu → public.
 */
export function classifyNoCompanyIntent(message: string): NoCompanyIntent {
  const m = (message ?? "").trim();
  if (m.length === 0) return "ambiguous";

  // 1) Données ou possessif d'entreprise → company (même formulé en question).
  if (COMPANY_POSSESSIVE.test(m) || COMPANY_DATA_REF.test(m) || COMPANY_NAMED.test(m)) return "company";

  // 2) Question SUR le produit/une capacité → public.
  if (CAPABILITY_QUESTION.test(m)) return "public";

  // 3) Action RH impérative + objet → company.
  if (COMPANY_ACTION.test(m)) return "company";

  // 4) Verbe d'action nu sans objet → ambigu.
  if (BARE_ACTION.test(m) && m.split(/\s+/).length <= 3) return "ambiguous";

  // 5) Sinon : catégorie publique connue → public ; défaut sûr → public (aucune donnée tenant).
  const routed = routeCloneChatQuestion(m, "visitor");
  if (PUBLIC_CATEGORIES.has(routed.category)) return "public";
  return "public";
}

/** Message honnête (données) quand une entreprise active est requise. */
export const NO_COMPANY_ACTION_MESSAGE =
  "Pour agir sur votre entreprise, sélectionnez ou créez d'abord une entreprise active.";

/** Message de clarification pour une demande ambiguë (sans blocage automatique). */
export const NO_COMPANY_CLARIFY_MESSAGE =
  "Voulez-vous une information générale sur CloneStore et Pierre, ou agir sur une entreprise ? " +
  "Pour agir sur vos missions et vos données, connectez d'abord une entreprise active — sinon, posez librement votre question.";

/** Bannière subtile « mode découverte » (UI). */
export const DISCOVERY_MODE_HINT =
  "Mode découverte — connectez une entreprise pour que Pierre puisse agir sur vos données et vos missions.";
