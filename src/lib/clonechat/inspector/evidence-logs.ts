// src/lib/clonechat/inspector/evidence-logs.ts
//
// Analyse d'erreurs/logs : reconnaît UNIQUEMENT les éléments réellement présents (codes d'erreur,
// statut HTTP, route, provider, timestamp, identifiants sûrs, message redigé). Masque tokens,
// cookies, clés, secrets, en-têtes d'auth, URL signées, mots de passe, e-mails, stack traces brutes,
// contenu d'un autre tenant. Les logs ne sont JAMAIS exécutés ni interprétés comme des commandes ;
// une instruction contenue dans le texte est du contenu NON FIABLE (jamais une instruction système).

import { redactText, safeErrorCode } from "@/lib/clonechat/care";
import { detectPromptInjection } from "@/lib/clonechat/context-boundary";
import { getRouteEntry } from "@/lib/nav/route-registry";

export const MAX_LOG_TEXT = 512 * 1024;

const ERROR_CODE_RE = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g; // CHECKOUT_DECLINED, TRANSCRIPTION_TIMEOUT…
const HTTP_STATUS_RE = /\b(?:status|http|code)\D{0,4}([1-5]\d\d)\b/gi;
const ROUTE_RE = /(?<![\w.])(\/[a-z0-9][a-z0-9/_-]*)/gi;
const ISO_TS_RE = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const PROVIDER_RE = /\b(openai|stripe|supabase|vercel|anthropic|postgres|pg_net|pg_cron)\b/gi;

export interface LogAnalysis {
  readonly errorCodes: readonly string[];
  readonly httpStatuses: readonly string[];
  readonly routes: readonly string[]; // routes RÉELLES (registre) uniquement
  readonly providers: readonly string[];
  readonly timestamps: readonly string[];
  readonly redactedText: string; // extrait sûr, redigé, borné
  readonly untrustedInstructions: boolean; // injection détectée (jamais suivie)
}

function uniqueLimited(matches: Iterable<string>, limit: number, map?: (s: string) => string): string[] {
  const set = new Set<string>();
  for (const m of matches) { set.add(map ? map(m) : m); if (set.size >= limit) break; }
  return [...set];
}

/** Analyse un texte de log/erreur. Ne throw jamais. Ne suit JAMAIS d'instruction du contenu. */
export function analyzeLogs(text: string): LogAnalysis {
  const src = text.length > MAX_LOG_TEXT ? text.slice(0, MAX_LOG_TEXT) : text;

  const errorCodes = uniqueLimited(src.match(ERROR_CODE_RE) ?? [], 20, safeErrorCode)
    .filter((c) => c.length >= 4 && !["HTTP", "JSON", "NULL", "TRUE", "FALSE"].includes(c));

  const httpStatuses = uniqueLimited(
    [...src.matchAll(HTTP_STATUS_RE)].map((m) => m[1]), 10,
  );

  const routes: string[] = [];
  for (const m of src.matchAll(ROUTE_RE)) {
    const candidate = m[1];
    if (getRouteEntry(candidate) && !routes.includes(candidate)) routes.push(candidate); // routes RÉELLES uniquement
    if (routes.length >= 10) break;
  }

  const providers = uniqueLimited([...src.matchAll(PROVIDER_RE)].map((m) => m[1].toLowerCase()), 8);
  const timestamps = uniqueLimited(src.match(ISO_TS_RE) ?? [], 6);

  // Extrait SÛR : redaction déterministe (tokens/cookies/clés/secrets/emails/stack) + borne.
  const redactedText = redactText(src).slice(0, 2000);

  // Le contenu peut CONTENIR une injection : on la DÉTECTE et on la marque non fiable ; jamais suivie.
  const untrustedInstructions = detectPromptInjection(src);

  return { errorCodes, httpStatuses, routes, providers, timestamps, redactedText, untrustedInstructions };
}
