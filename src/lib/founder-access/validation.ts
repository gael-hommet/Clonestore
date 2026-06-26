// Phase E — Founder Access : validation, normalisation, sanitation (sans zod).
// Fonctions pures, testables, sûres côté serveur.

import { COMPANY_SIZES, type CompanySize, type EmailDomainType, type ReservationStep1, type ReservationStep2 } from "./types";

const MAX = { email: 254, company: 160, name: 120, role: 120, need: 400, sector: 120, website: 200, phone: 40 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.fr", "live.com", "live.fr",
  "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "free.fr", "orange.fr", "sfr.fr", "laposte.net",
  "wanadoo.fr", "proton.me", "protonmail.com", "gmx.com", "aol.com",
]);
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com", "trashmail.com",
  "tempmail.com", "getnada.com", "discard.email", "sharklasers.com",
]);
const ROLE_LOCALPARTS = new Set([
  "info", "contact", "admin", "hello", "support", "sales", "rh", "hr", "compta", "no-reply", "noreply",
]);

export function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

export function classifyEmailDomain(email: string): EmailDomainType {
  const e = normalizeEmail(email);
  if (!EMAIL_RE.test(e)) return "unknown";
  const domain = emailDomain(e);
  const local = e.slice(0, e.indexOf("@"));
  if (DISPOSABLE_DOMAINS.has(domain)) return "disposable";
  if (PERSONAL_DOMAINS.has(domain)) return "personal";
  if (ROLE_LOCALPARTS.has(local)) return "role_based";
  return "professional";
}

/** Clé de déduplication idempotente : email normalisé. */
export function dedupeKey(email: string): string {
  return normalizeEmail(email);
}

/** Retire les caractères de contrôle (par code point) + compacte les espaces. */
function clean(s: unknown, max: number): string {
  const src = String(s ?? "");
  let out = "";
  for (const ch of src) {
    const c = ch.codePointAt(0) ?? 32;
    out += c < 32 || c === 127 ? " " : ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

export function validateStep1(input: unknown): ValidationResult<{
  email: string;
  company_name: string;
  company_size: CompanySize;
  email_domain_type: EmailDomainType;
}> {
  const raw = (input ?? {}) as Partial<ReservationStep1>;
  const errors: Record<string, string> = {};

  // honeypot : si rempli, on le signale (la route renverra un faux succès silencieux)
  if (raw.website_hp && String(raw.website_hp).trim() !== "") {
    return { ok: false, errors: { honeypot: "rejected" } };
  }

  const email = normalizeEmail(raw.email ?? "");
  if (!email) errors.email = "Indiquez votre adresse email professionnelle.";
  else if (email.length > MAX.email || !EMAIL_RE.test(email)) errors.email = "Cette adresse email ne semble pas valide.";

  const company_name = clean(raw.company_name, MAX.company);
  if (!company_name) errors.company_name = "Indiquez le nom de votre entreprise.";

  const company_size = String(raw.company_size ?? "") as CompanySize;
  if (!COMPANY_SIZES.includes(company_size)) errors.company_size = "Sélectionnez la taille de votre entreprise.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, company_name, company_size, email_domain_type: classifyEmailDomain(email) } };
}

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
const PHONE_RE = /^[+()\d\s.-]{6,40}$/;

export function validateStep2(
  input: unknown,
): ValidationResult<Required<Pick<ReservationStep2, "contact_requested">> & ReservationStep2> {
  const raw = (input ?? {}) as Partial<ReservationStep2>;
  const errors: Record<string, string> = {};

  const website = clean(raw.website, MAX.website);
  if (website && !URL_RE.test(website)) errors.website = "Cette adresse de site ne semble pas valide.";
  const phone = clean(raw.phone, MAX.phone);
  if (phone && !PHONE_RE.test(phone)) errors.phone = "Ce numéro ne semble pas valide.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      full_name: clean(raw.full_name, MAX.name) || undefined,
      role: clean(raw.role, MAX.role) || undefined,
      primary_hr_need: clean(raw.primary_hr_need, MAX.need) || undefined,
      sector: clean(raw.sector, MAX.sector) || undefined,
      website: website || undefined,
      phone: phone || undefined,
      contact_requested: Boolean(raw.contact_requested),
    },
  };
}

/** Résumé non identifiant du User-Agent (anti-abus / qualif, pas de fingerprint). */
export function summarizeUserAgent(ua: string | null | undefined): string {
  const s = String(ua ?? "");
  const m = /(Chrome|Firefox|Safari|Edg|Mobile|Android|iPhone|iPad)/i.exec(s);
  return (m ? m[0] : "unknown").slice(0, 40);
}
