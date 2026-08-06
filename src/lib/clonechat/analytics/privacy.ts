// src/lib/clonechat/analytics/privacy.ts
//
// Confidentialité & minimisation DÉTERMINISTES. Aucune donnée sensible ne peut entrer dans un
// événement : message/prompt/réponse/transcript/audio/binaire/contenu extrait, mot de passe, token,
// cookie, clé API, header d'auth, URL signée, donnée bancaire, e-mail, téléphone, nom de salarié,
// nom d'entreprise inutile, user/tenant ID brut, stack brute, donnée d'un autre tenant. Politique :
// allowlist stricte des clés, rejet de tout champ inconnu ou interdit, redaction récursive des
// valeurs, pseudonymisation injectable, taille et profondeur bornées.

import { redactText } from "@/lib/clonechat/care";
import { hash } from "@/lib/clonechat/actions/keys";
import type { MetaValue } from "./types";

export const MAX_META_KEYS = 24;
export const MAX_FIELD_LEN = 200; // longueur max d'une valeur string (après quoi = rejet)
export const MAX_ENVELOPE_BYTES = 4096;

/** Clés de méta TOUJOURS interdites (défense en profondeur, même si un spec les allowlistait par erreur). */
const BANNED_KEY_PATTERN =
  /(message|prompt|response|answer|transcript|audio|image|binary|attachment|content|token|secret|password|passwd|pwd|cookie|api[_-]?key|apikey|bearer|authorization|signed[_-]?url|iban|rib|card|e?mail|phone|tel|firstname|lastname|fullname|employee|company[_-]?name|company[_-]?id|user[_-]?id|tenant[_-]?id|stack|raw|payload|ssn)/i;

export function isBannedMetaKey(key: string): boolean {
  return BANNED_KEY_PATTERN.test(key);
}

/** Pseudonymiseur injectable : transforme une clé SÛRE (viewer/tenant) en identifiant opaque stable. */
export interface Pseudonymizer {
  pseudonymize(kind: "viewer" | "tenant", key: string): string;
}

/**
 * Pseudonymiseur déterministe par défaut : hash(salt|kind|key). Le viewer est pseudonymisé avec une
 * clé COMPOSITE incluant le tenant (voir envelope), de sorte qu'un même utilisateur obtienne un
 * pseudonyme DISTINCT selon le tenant → aucune corrélation inter-tenant.
 */
export function createDefaultPseudonymizer(salt: string): Pseudonymizer {
  return {
    pseudonymize(kind, key) {
      const prefix = kind === "viewer" ? "vp_" : "tp_";
      return prefix + hash([salt, kind, key].join("|"));
    },
  };
}

export type MetaValidation =
  | { readonly ok: true; readonly meta: Readonly<Record<string, MetaValue>> }
  | { readonly ok: false; readonly reason: string };

/**
 * Valide + minimise une méta : chaque clé doit être dans l'allowlist ET non interdite ; chaque valeur
 * doit être une primitive (string/number/boolean/null), redigée et bornée. Rejet strict sinon.
 */
export function validateAndMinimizeMeta(
  raw: Record<string, unknown> | undefined,
  allowed: ReadonlySet<string>,
  required: readonly string[],
): MetaValidation {
  const out: Record<string, MetaValue> = {};
  const entries = Object.entries(raw ?? {});
  if (entries.length > MAX_META_KEYS) return { ok: false, reason: "too_many_fields" };

  for (const [key, value] of entries) {
    if (!allowed.has(key)) return { ok: false, reason: `unknown_field:${key}` };
    if (isBannedMetaKey(key)) return { ok: false, reason: `forbidden_field:${key}` };
    if (value === null) { out[key] = null; continue; }
    const t = typeof value;
    if (t === "number") {
      if (!Number.isFinite(value as number)) return { ok: false, reason: `invalid_number:${key}` };
      out[key] = value as number; continue;
    }
    if (t === "boolean") { out[key] = value as boolean; continue; }
    if (t === "string") {
      const s = value as string;
      if (s.length > MAX_FIELD_LEN) return { ok: false, reason: `field_too_large:${key}` };
      out[key] = redactText(s).slice(0, MAX_FIELD_LEN); // redaction récursive (chaîne plate)
      continue;
    }
    // objet / array / fonction / symbole → jamais (profondeur/objets du pipeline interdits)
    return { ok: false, reason: `invalid_field_type:${key}` };
  }

  for (const r of required) {
    if (!(r in out)) return { ok: false, reason: `missing_required_field:${r}` };
  }
  return { ok: true, meta: Object.freeze(out) };
}
