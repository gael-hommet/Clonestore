// C1.9 — MÉMOIRE DE CONVERSATION.
//
// Corrige le défaut D3 : l'historique atteignait le modèle en messages bruts, mais la
// RÉCUPÉRATION ne recevait que le tour courant. Une relance elliptique était donc
// groundée sur une phrase sans contenu récupérable.
//
// Ici, les faits énoncés au fil de la conversation deviennent une valeur de première
// classe : ils entrent dans la requête de récupération ET dans le prompt de
// compréhension. Rien n'est deviné — un fait n'existe que si un tour l'a énoncé.
import type { Understanding } from "./understanding-schema";

export interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

/** Un fait tenu pour acquis dans CETTE conversation. Jamais persisté ici. */
export interface SessionFact {
  /** Ce que le fait désigne (texte libre issu de la compréhension). */
  readonly kind: string;
  readonly value: string;
  /** Index du tour où il a été énoncé — permet à une correction de le remplacer. */
  readonly statedAtTurn: number;
  /** Vrai si déduit plutôt qu'énoncé explicitement. */
  readonly inferred: boolean;
}

export interface ConversationMemory {
  readonly facts: readonly SessionFact[];
  readonly openQuestions: readonly string[];
  readonly assumptions: readonly string[];
  readonly corrections: readonly string[];
  readonly turnCount: number;
}

export const EMPTY_MEMORY: ConversationMemory = Object.freeze({
  facts: Object.freeze([]),
  openQuestions: Object.freeze([]),
  assumptions: Object.freeze([]),
  corrections: Object.freeze([]),
  turnCount: 0,
});

/**
 * Catégories de faits qu'on ne conserve JAMAIS en mémoire de session, même si le
 * modèle les extrait. Le filtre porte sur la NATURE déclarée du fait, pas sur une
 * détection de contenu — la détection de secret reste au niveau des chunks.
 */
const NEVER_REMEMBER = /\b(mot\s*de\s*passe|password|carte\s+bancaire|iban|num[ée]ro\s+de\s+s[ée]curit[ée]|nir|token|secret|api[_\s-]?key)\b/i;

function isRemembrable(f: SessionFact): boolean {
  return !NEVER_REMEMBER.test(f.kind) && !NEVER_REMEMBER.test(f.value);
}

/**
 * Intègre la compréhension d'un tour dans la mémoire.
 *
 * Règle de remplacement : un fait de même `kind` énoncé plus tard REMPLACE le
 * précédent. C'est ce qui fait qu'« on est plutôt 40 » corrige « on est 22 » sans
 * qu'aucune règle ne mentionne les effectifs.
 */
export function absorbTurn(
  memory: ConversationMemory,
  understanding: Understanding,
  turnIndex: number,
): ConversationMemory {
  const byKind = new Map<string, SessionFact>();
  for (const f of memory.facts) byKind.set(f.kind.toLowerCase(), f);

  // Valeurs qu'un fait plus récent a écartées, par racine de `kind`.
  const superseded = new Map<string, Set<string>>();

  for (const e of understanding.entities) {
    const fact: SessionFact = {
      kind: e.kind,
      value: e.value,
      statedAtTurn: turnIndex,
      inferred: e.inferred,
    };
    if (!isRemembrable(fact)) continue;
    const key = e.kind.toLowerCase();
    const prev = byKind.get(key);
    // Un fait ÉNONCÉ l'emporte toujours sur un fait déduit ; à statut égal, le plus récent gagne.
    if (!prev || !e.inferred || prev.inferred) {
      if (prev && prev.value.trim() !== fact.value.trim()) {
        const s = superseded.get(key) ?? new Set<string>();
        s.add(prev.value.trim().toLowerCase());
        superseded.set(key, s);
      }
      byKind.set(key, fact);
    }
  }

  // ── Purge des valeurs corrigées qui survivent sous un autre `kind` ─────────
  // Corriger « deux personnes » en « trois » remplaçait bien `effectif_RH`, mais le modèle
  // émettait AUSSI `effectif_RH_précédemment_indiqué = 2`. L'ancienne valeur restait donc
  // sous les yeux du rédacteur, qui continuait de compter 2. On écarte tout fait dont le
  // `kind` DÉRIVE d'un kind corrigé et qui porte précisément la valeur écartée.
  // Le critère est structurel (préfixe de kind + valeur identique), sans aucune liste de
  // mots : une mémoire d'état courant n'a pas à conserver l'état précédent, que
  // `memory.corrections` trace déjà.
  for (const [key, oldValues] of superseded) {
    for (const [k, f] of [...byKind]) {
      if (k === key) continue;
      const derived = k.startsWith(key) && k.length > key.length;
      if (derived && oldValues.has(f.value.trim().toLowerCase())) byKind.delete(k);
    }
  }

  const stillOpen = understanding.requires_clarification && understanding.clarification_question
    ? [understanding.clarification_question]
    : [];

  return Object.freeze({
    facts: Object.freeze([...byKind.values()]),
    openQuestions: Object.freeze([...new Set([...memory.openQuestions, ...stillOpen, ...understanding.missing_information])].slice(-8)),
    assumptions: Object.freeze([...new Set([...memory.assumptions, ...understanding.assumptions])].slice(-8)),
    corrections: Object.freeze(
      understanding.is_correction
        ? [...memory.corrections, understanding.summary].slice(-4)
        : memory.corrections,
    ),
    turnCount: turnIndex + 1,
  });
}

/**
 * Reconstruit la mémoire à partir d'un historique brut, SANS appel modèle.
 *
 * Utilisé quand la route ne dispose que de `history: [{role, text}]` (le cas actuel).
 * On n'extrait aucun fait ici — deviner serait pire que rien. On fournit seulement le
 * matériau textuel que la compréhension utilisera pour poser ses propres faits.
 */
export function memoryFromHistory(history: readonly ConversationTurn[]): ConversationMemory {
  return Object.freeze({ ...EMPTY_MEMORY, turnCount: history.length });
}

/** Rendu compact destiné au prompt. Vide si la mémoire est vide — jamais de bruit. */
export function renderMemoryForPrompt(memory: ConversationMemory): string {
  const parts: string[] = [];
  if (memory.facts.length > 0) {
    parts.push(
      "Éléments déjà donnés par l'utilisateur dans cette conversation :\n" +
        memory.facts.map((f) => `- ${f.kind} : ${f.value}${f.inferred ? " (déduit)" : ""}`).join("\n"),
    );
  }
  if (memory.openQuestions.length > 0) {
    parts.push("Restent à préciser : " + memory.openQuestions.join(" · "));
  }
  if (memory.assumptions.length > 0) {
    parts.push("Hypothèses en cours : " + memory.assumptions.join(" · "));
  }
  if (memory.corrections.length > 0) {
    parts.push("L'utilisateur a corrigé : " + memory.corrections.join(" · "));
  }
  return parts.join("\n\n");
}

/**
 * Termes issus de la mémoire à ajouter à la requête de récupération.
 * C'est le correctif direct de D3 : « tu l'estimes à combien ? » récupère désormais
 * sur « effectif 22 », « temps RH deux jours », et non sur une phrase creuse.
 */
export function memoryRetrievalTerms(memory: ConversationMemory): readonly string[] {
  return Object.freeze(memory.facts.flatMap((f) => [f.kind, f.value]));
}
