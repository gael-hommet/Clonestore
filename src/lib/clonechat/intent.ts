// src/lib/clonechat/intent.ts
// P9.4 — Classification d'intention DÉTERMINISTE (règles, aucune IA, aucune
// hallucination). Extrait aussi les entités utiles (salarié, document, instruction
// de mission). Pur → testable en node. Une intention ambiguë est marquée pour
// déclencher une CLARIFICATION plutôt qu'une invention.

import type { CloneChatClassification, CloneChatEntities, CloneChatIntent } from "./types";

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents pour la robustesse
    .trim();
}

interface Rule {
  readonly intent: CloneChatIntent;
  readonly any: readonly RegExp[];
  readonly weight: number;
}

// Règles ordonnées par spécificité. Les verbes d'action priment sur la consultation.
const RULES: readonly Rule[] = [
  { intent: "create_mission", weight: 3, any: [/\b(cree|creer|cre[eé]|lance|lancer|confie|confier|prepare|preparer|redige|rediger|organise|organiser|demande a pierre|nouvelle mission)\b/] },
  { intent: "open_mission", weight: 2, any: [/\bouvre?\b.*\bmission\b/, /\bmission\b.*\b(ouvrir|detail|voir)\b/] },
  { intent: "list_missions", weight: 2, any: [/\bmissions?\b/, /\bque fait pierre\b/, /\bou en (est|sont)\b/, /\ben cours\b/] },
  { intent: "explain_validation", weight: 3, any: [/\bpourquoi\b.*\bvalidation\b/, /\bexplique?\b.*\bvalidation\b/] },
  { intent: "open_validation", weight: 2, any: [/\bouvre?\b.*\bvalidation\b/] },
  { intent: "list_validations", weight: 2, any: [/\bvalidations?\b/, /\ba valider\b/, /\bqui attend ma (validation|decision)\b/, /\bmon accord\b/] },
  { intent: "open_employee", weight: 3, any: [/\b(dossier|fiche|profil)\b.*\b(de|du|salarie|employe)\b/, /\bmontre?\b.*\b(salarie|employe)\b/, /\bouvre?\b.*\b(salarie|employe)\b/] },
  { intent: "list_employees", weight: 2, any: [/\bsalaries?\b/, /\bemployes?\b/, /\bequipe\b/, /\beffectif\b/] },
  { intent: "open_document", weight: 3, any: [/\bouvre?\b.*\bdocument\b/, /\btelecharge?\b.*\bdocument\b/] },
  { intent: "find_document", weight: 2, any: [/\bdocuments?\b/, /\bcontrat\b/, /\battestation\b/, /\bretrouve?\b.*\b(document|contrat|fichier)\b/, /\blivrable\b/] },
  { intent: "summarize", weight: 2, any: [/\bresume\b/, /\bsynthese\b/, /\brecapitul/, /\bfais le point\b/] },
  { intent: "status", weight: 1, any: [/\bstatut\b/, /\betat\b/, /\bsante\b/, /\bcomment (ca|ca) va\b/] },
  { intent: "help", weight: 1, any: [/\baide\b/, /\bcomment (faire|utiliser|marche)\b/, /\bque (peux|peut)-?tu faire\b/, /\bque sais-?tu faire\b/] },
  { intent: "explain", weight: 1, any: [/\bqu'?est-?ce que\b/, /\bexplique?\b/, /\bc'?est quoi\b/, /\bpierre\b/, /\bclonestore\b/, /\bemploye ia\b/, /\bcombien\b/, /\btarif\b/, /\bprix\b/] },
];

/** Extraction d'entités simples (sans NLP lourd) : instruction, salarié, document. */
export function extractEntities(raw: string): CloneChatEntities {
  const text = raw.trim();
  const n = norm(text);
  // Salarié : « dossier de X », « fiche de X », « salarié X »
  const empMatch = text.match(/\b(?:dossier|fiche|profil|salari[ée]|employ[ée])\s+(?:de\s+|du\s+|d'\s*)?([A-ZÉÈ][\p{L}'-]+(?:\s+[A-ZÉÈ][\p{L}'-]+)?)/u);
  const employeeQuery = empMatch ? empMatch[1].trim() : null;
  // Document : « document X », « contrat de X », « attestation X »
  const docMatch = text.match(/\b(?:document|contrat|attestation|convention|avenant|lettre)\s+(?:de\s+|du\s+|d'\s*|pour\s+)?([\p{L}0-9'’\- ]{2,40})/u);
  const documentQuery = docMatch ? docMatch[1].trim() : null;
  // Instruction de mission : le texte entier si l'intention est une création.
  const isCreate = /\b(cree|creer|cre[eé]|lance|lancer|confie|confier|prepare|preparer|redige|rediger|organise|organiser|nouvelle mission)\b/.test(n);
  const missionInstruction = isCreate ? text : null;
  return { employeeQuery, documentQuery, missionInstruction, raw: text };
}

/** Classification déterministe. Renvoie `clarify` si vide ou trop ambigu. */
export function classifyIntent(raw: string): CloneChatClassification {
  const text = (raw ?? "").trim();
  const entities = extractEntities(text);
  if (!text) {
    return { intent: "clarify", confidence: 0, entities, ambiguous: true };
  }
  const n = norm(text);
  let best: { intent: CloneChatIntent; weight: number } | null = null;
  let matches = 0;
  for (const rule of RULES) {
    if (rule.any.some((re) => re.test(n))) {
      matches++;
      if (!best || rule.weight > best.weight) best = { intent: rule.intent, weight: rule.weight };
    }
  }
  if (!best) {
    // Aucune règle → orientation générale si question, sinon clarification.
    const looksLikeQuestion = /\?|\b(quoi|comment|pourquoi|qui|quand|ou|combien)\b/.test(n);
    return { intent: looksLikeQuestion ? "explain" : "clarify", confidence: looksLikeQuestion ? 0.4 : 0.1, entities, ambiguous: !looksLikeQuestion };
  }
  // Une règle a matché → on retient son intention (jamais un downgrade en clarify).
  // La confiance reflète le poids ; l'ambiguïté n'est signalée que si plusieurs
  // règles de poids élevé (≥2) rivalisent réellement.
  const confidence = Math.min(1, best.weight / 3);
  const ambiguous = matches > 1 && best.weight <= 1;
  return { intent: best.intent, confidence, entities, ambiguous };
}

/** Intentions autorisées en mode PUBLIC (orientation uniquement). */
export const PUBLIC_INTENTS: ReadonlySet<CloneChatIntent> = new Set(["explain", "help", "clarify"]);

export function isPublicAllowed(intent: CloneChatIntent): boolean {
  return PUBLIC_INTENTS.has(intent);
}
