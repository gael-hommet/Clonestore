// Programme partenaires — identités publiques & secrets (server-only).
// Le code de recommandation à forte entropie n'est JAMAIS stocké en clair (SHA-256).
// Le slug public est dérivé du nom, non devinable-mais-lisible, distinct de l'id interne.

import { createHash, randomBytes } from "crypto";

/** Normalise un email (minuscule, trim). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** SHA-256 hex d'une valeur (codes, empreintes). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Slug lisible à partir d'un nom de cabinet (a-z0-9-, borné). */
export function slugifyCabinet(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "cabinet";
}

/**
 * Génère un code de recommandation à forte entropie (base32 sans caractères ambigus).
 * Retourne le code EN CLAIR (à montrer une seule fois) + son hash (à stocker) + un indice.
 */
export function generateReferralCode(): { code: string; hash: string; hint: string } {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans I,L,O,0,1
  const bytes = randomBytes(20);
  let code = "";
  for (let i = 0; i < 16; i++) code += alphabet[bytes[i] % alphabet.length];
  const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
  return { code: formatted, hash: sha256(formatted), hint: code.slice(-4) };
}

/** Génère un jeton de lien opaque (URL-safe). */
export function generateLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Empreinte d'entreprise : normalise nom + domaine email pour détecter les doublons et
 * l'auto-parrainage sans stocker de PII en clair. Domaine prioritaire s'il existe.
 */
export function companyFingerprint(input: { companyName: string; email?: string | null }): string {
  const domain = input.email && input.email.includes("@") ? normalizeEmail(input.email).split("@")[1] : "";
  const name = input.companyName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sarl|sas|sa|eurl|sasu|sci|gmbh|ltd|inc|snc)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return sha256(`${domain}|${name}`);
}

/** Extrait le domaine d'un email (ou null). */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  return normalizeEmail(email).split("@")[1] || null;
}

const GENERIC_DOMAINS = new Set([
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.fr", "orange.fr",
  "free.fr", "wanadoo.fr", "icloud.com", "protonmail.com", "live.fr", "laposte.net",
]);

/** Un domaine email « générique » (grand public) ne permet pas d'identifier une entreprise. */
export function isGenericEmailDomain(domain: string | null): boolean {
  return domain === null || GENERIC_DOMAINS.has(domain);
}
