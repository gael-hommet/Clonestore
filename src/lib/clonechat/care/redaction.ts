// src/lib/clonechat/care/redaction.ts
//
// Redaction DÉTERMINISTE pour tout contenu destiné à un ticket ou à un log. Supprime tokens,
// cookies, clés API, secrets, en-têtes d'authentification, e-mails, JWT et traces de pile brutes.
// Ne conserve JAMAIS d'audio brut ni de transcript vocal complet (ceux-ci ne transitent tout
// simplement pas par cette couche). Pur, sans réseau, déterministe.

// Marques combinantes non concernées ici ; motifs construits en littéraux sûrs (ASCII).
const PATTERNS: ReadonlyArray<{ readonly re: RegExp; readonly to: string }> = [
  // En-têtes / paires clé-valeur sensibles (authorization, cookie, api-key, token, secret, password…).
  { re: /\b(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|bearer|token|secret|password|passwd|pwd)\b\s*[:=]\s*[^\s,;]+/gi, to: "$1: [redacted]" },
  // Jetons Bearer explicites.
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/g, to: "Bearer [redacted]" },
  // Clés de type OpenAI / Stripe / génériques préfixées.
  { re: /\b(sk|pk|rk|whsec|api|key)[-_][A-Za-z0-9]{10,}/gi, to: "[redacted-key]" },
  // JWT (trois segments base64url).
  { re: /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, to: "[redacted-jwt]" },
  // Adresses e-mail (PII non nécessaire).
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, to: "[email]" },
  // Traces de pile brutes (lignes « at file:line » → jamais destinées à l'utilisateur).
  { re: /\bat\s+[^\s]+\s+\([^)]*:\d+:\d+\)/g, to: "[stack]" },
  { re: /\b[\w./\\-]+\.(?:ts|tsx|js|jsx):\d+:\d+/g, to: "[stack]" },
];

/** Redige une chaîne : supprime tout secret/PII/trace connu. Déterministe. */
export function redactText(input: string): string {
  let out = String(input ?? "");
  for (const { re, to } of PATTERNS) out = out.replace(re, to);
  return out.trim();
}

/** Redige une liste et retire les entrées vidées par la redaction. */
export function redactList(items: readonly string[]): string[] {
  return items.map(redactText).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Un code d'erreur SÛR : court, sans espace suspect, redigé, tronqué. */
export function safeErrorCode(code: string): string {
  return redactText(String(code ?? "")).replace(/\s+/g, "_").slice(0, 80);
}
