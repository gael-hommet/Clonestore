// src/lib/clonestore/messages/message-center-validation.ts
// PHASE 3.1 — Messages Real Data Read-Only Hook — Validation
//
// Valide les MessageCenterItem et détecte les wordings interdits.
// Ces fonctions sont pures — aucun side effect, aucune DB write.

import type { MessageCenterItem } from "./message-center-types";
import { UNSAFE_WORDING_PATTERNS } from "./message-center-types";

// ── Types résultats ───────────────────────────────────────────────────────────

export type MessageCenterItemValidationResult = {
  valid: boolean;
  issues: string[];
};

export type MessageCenterBatchValidationResult = {
  valid: boolean;
  invalid_count: number;
  issues_by_id: Record<string, string[]>;
};

// ── Validation d'un item ──────────────────────────────────────────────────────

export function validateMessageCenterItem(
  item: MessageCenterItem
): MessageCenterItemValidationResult {
  const issues: string[] = [];

  // id obligatoire
  if (!item.id || typeof item.id !== "string" || !item.id.trim()) {
    issues.push("id est requis et doit être non vide");
  }

  // tab : 4 onglets uniquement
  const validTabs = ["suivis", "briefings", "livraisons", "alertes"];
  if (!validTabs.includes(item.tab)) {
    issues.push(`tab invalide : "${item.tab}" — attendu : ${validTabs.join(" | ")}`);
  }

  // title obligatoire
  if (!item.title || typeof item.title !== "string" || !item.title.trim()) {
    issues.push("title est requis et doit être non vide");
  }

  // read_only doit être true pour les données réelles
  if (item.is_real_data && item.read_only !== true) {
    issues.push("read_only doit être true pour les données réelles");
  }

  // Détecter les wordings interdits dans title + summary
  const textToCheck = `${item.title} ${item.summary}`.toLowerCase();
  const unsafeWording = detectUnsafeMessageCenterWording(textToCheck);
  if (unsafeWording) {
    issues.push(`wording interdit détecté : "${unsafeWording}"`);
  }

  return { valid: issues.length === 0, issues };
}

// ── Validation en lot ─────────────────────────────────────────────────────────

export function validateMessageCenterItems(
  items: MessageCenterItem[]
): MessageCenterBatchValidationResult {
  let invalid_count = 0;
  const issues_by_id: Record<string, string[]> = {};

  for (const item of items) {
    const result = validateMessageCenterItem(item);
    if (!result.valid) {
      invalid_count++;
      issues_by_id[item.id] = result.issues;
    }
  }

  return {
    valid: invalid_count === 0,
    invalid_count,
    issues_by_id,
  };
}

// ── Assertion read-only ───────────────────────────────────────────────────────
// Vérifie que tous les items réels ont read_only = true.

export function assertMessageCenterReadOnly(
  items: MessageCenterItem[]
): boolean {
  return items
    .filter((item) => item.is_real_data)
    .every((item) => item.read_only === true);
}

// ── Détection de wording interdit ────────────────────────────────────────────
// Détecte les phrases interdites dans un texte.
// Retourne la première phrase trouvée ou null.
//
// Phrases interdites :
//   - "public launch go"         → ne pas affirmer que le lancement est autorisé
//   - "zéro erreur"              → ne pas faire de fausses garanties
//   - "conformité garantie"      → ne pas promettre la conformité
//   - "clonevoice actif production" → CloneVoice n'est pas actif en production
//   - "mission exécutée avec succès" → jamais de fausse exécution
//   - "document généré avec succès"  → jamais de fausse génération
//   - "email envoyé avec succès"     → jamais de faux envoi

export function detectUnsafeMessageCenterWording(
  text: string
): string | null {
  const normalized = text.toLowerCase();
  for (const pattern of UNSAFE_WORDING_PATTERNS) {
    if (normalized.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

// ── PHASE 3.4 — Helpers CloneOS History items ─────────────────────────────────

/**
 * Compte les items provenant de CloneOS History (source = "cloneos").
 */
export function countCloneOSHistoryMessageItems(
  items: MessageCenterItem[]
): number {
  return items.filter((item) => item.source === "cloneos").length;
}

/**
 * Vérifie si des items CloneOS History sont présents.
 */
export function hasCloneOSHistoryMessageItems(
  items: MessageCenterItem[]
): boolean {
  return items.some((item) => item.source === "cloneos");
}

/**
 * Vérifie qu'aucun item n'est une action d'écriture déguisée.
 * Les actions des items CloneOS History doivent être read_only ou open_cockpit.
 */
export function assertMessageCenterNoWriteActions(
  items: MessageCenterItem[]
): boolean {
  const cloneOSItems = items.filter((item) => item.source === "cloneos");
  return cloneOSItems.every((item) => {
    // Vérifier read_only
    if (!item.read_only) return false;
    // Vérifier aucun wording d'exécution dans title/summary
    const text = `${item.title} ${item.summary}`;
    const unsafe = detectUnsafeMessageCenterWording(text);
    return unsafe === null;
  });
}
