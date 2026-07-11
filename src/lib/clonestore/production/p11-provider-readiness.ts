// src/lib/clonestore/production/p11-provider-readiness.ts
// P11 §6 — Readiness FOURNISSEURS, en particulier signature (Yousign). FAIL-CLOSED. Réutilise la
// certification providers existante (final-certification/provider-readiness) — source de vérité du
// liveGrade + blockedReason (Yousign bloqué par P8.7.4). Si la signature n'est pas LIVE →
// PROVIDER_SIGNATURE_NOT_LIVE et le go-live reste bloqué. N'ACTIVE aucun provider, n'appelle rien.

import { providerReadiness as certProviderReadiness, type ProviderReadiness as CertProvider } from "@/lib/pierre/v1/final-certification/provider-readiness";

export type ProviderEnv = NodeJS.ProcessEnv;
export type SignatureMode = "sandbox" | "live" | "unknown";

const present = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;
const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

/** Détecte le mode du provider de signature à partir de l'URL API (jamais depuis une clé secrète). */
export function detectSignatureMode(env: ProviderEnv = process.env): SignatureMode {
  const url = (env.CLONESTORE_SIGNATURE_API_URL ?? "").toLowerCase();
  if (!url) return "unknown";
  if (url.includes("sandbox") || url.includes("staging") || url.includes("test")) return "sandbox";
  if (url.includes("yousign")) return "live"; // hôte yousign sans marqueur sandbox
  return "unknown";
}

export interface SignatureReadiness {
  provider: string | null;
  mode: SignatureMode;
  live: boolean;
  apiKeyPresent: boolean;
  webhookConfigured: boolean;
  manualPathAvailable: boolean;
  blockedReason: string | null;
  countryCoverage: Record<string, boolean>; // FR/BE/LU/CH
}

export interface P11ProviderReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  signature: SignatureReadiness;
  providers: CertProvider[];
  liveProviderCount: number;
  note: string;
}

/**
 * Évalue la readiness fournisseurs. La signature (Yousign) doit être LIVE et non bloquée. En
 * sandbox / bloqué → PROVIDER_SIGNATURE_NOT_LIVE. Un provider sandbox en « production » est un
 * bloqueur (jamais de provider test en prod). Le chemin manuel gouverné existe (warning, pas une
 * readiness live).
 */
export function evaluateProviderReadiness(env: ProviderEnv = process.env): P11ProviderReadiness {
  const cert = certProviderReadiness(env);
  const mode = detectSignatureMode(env);
  const apiKeyPresent = present(env.CLONESTORE_SIGNATURE_API_KEY);
  const webhookConfigured = present(env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET);
  const providerName = env.CLONESTORE_SIGNATURE_PROVIDER ?? null;

  // Provider de signature dans la certification (id contenant "yousign"/"signature").
  const sig = cert.providers.find((p) => /yousign|signature|sign/i.test(p.provider)) ?? null;
  const manualPathAvailable = !!sig?.manualPathAvailable;
  // LIVE n'est considéré que si l'owner ATTESTE (CLONESTORE_SIGNATURE_LIVE_VERIFIED) après avoir
  // levé P8.7.4 et vérifié la signature en production — ET config non-sandbox + clés/webhook présents.
  const ownerAttestsLive = flagOn(env.CLONESTORE_SIGNATURE_LIVE_VERIFIED);
  const live = ownerAttestsLive && mode !== "sandbox" && apiKeyPresent && webhookConfigured;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!live) blockers.push("PROVIDER_SIGNATURE_NOT_LIVE — la signature (Yousign) n'est pas en mode LIVE / non attestée / bloquée.");
  if (mode === "sandbox") blockers.push("Provider signature en SANDBOX — jamais de provider test/sandbox en production.");
  if (sig?.blockedReason && !ownerAttestsLive) blockers.push(`Signature bloquée : ${sig.blockedReason}`);
  if (!apiKeyPresent) blockers.push("CLONESTORE_SIGNATURE_API_KEY absent.");
  if (!webhookConfigured) blockers.push("CLONESTORE_SIGNATURE_WEBHOOK_SECRET absent — webhook signature non vérifié.");
  if (!ownerAttestsLive) blockers.push("Attestation owner de signature LIVE absente (CLONESTORE_SIGNATURE_LIVE_VERIFIED) — P8.7.4 à lever + vérif live.");
  if (manualPathAvailable) warnings.push("Chemin manuel gouverné disponible — NE constitue PAS une readiness d'intégration live.");
  if (cert.liveGrade === 0) warnings.push("0 provider live à l'échelle de la certification (cf. P8.13/P8.7.4).");

  const signature: SignatureReadiness = {
    provider: providerName, mode, live, apiKeyPresent, webhookConfigured, manualPathAvailable,
    blockedReason: sig?.blockedReason ?? null,
    // Couverture pays revendiquée par Yousign (documentaire) — sans valeur tant que non live.
    countryCoverage: { FR: true, BE: true, LU: true, CH: true },
  };

  return {
    ready: blockers.length === 0,
    blockers, warnings,
    signature,
    providers: cert.providers,
    liveProviderCount: cert.liveGrade,
    note: "P11 n'active aucun provider et n'appelle aucun provider live. La signature doit être LIVE + non bloquée pour lever le blocage go-live.",
  };
}
