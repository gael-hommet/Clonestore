// src/lib/clonestore/production/p15-provider-closure.ts
// P15 §6 — Clôture PROVIDER de signature (Yousign). Réutilise la readiness P11 (fail-closed, jamais
// depuis un bool nu). Définit le repli officiel de lancement : « signature PRÉPARÉE, revue/signature
// manuelle requise » — jamais de fausse revendication de signature live. Le lancement public payant ne
// peut procéder que si LIVE_VERIFIED, OU FALLBACK_APPROVED avec une copie claire « préparée, non exécutée en live ».

import { evaluateProviderReadiness, detectSignatureMode, type ProviderEnv } from "./p11-provider-readiness";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

export type ProviderClosureStatus = "LIVE_VERIFIED" | "FALLBACK_APPROVED" | "SANDBOX_ONLY" | "MISSING" | "BLOCKED";

export interface ProviderClosureResult {
  readonly status: ProviderClosureStatus;
  readonly liveVerified: boolean;
  readonly fallbackApproved: boolean;
  readonly sandboxDetected: boolean;
  readonly apiKeyLiveShaped: boolean;
  readonly providerProofArtifactPresent: boolean;
  readonly publicPaidLaunchAllowed: boolean;      // LIVE_VERIFIED || FALLBACK_APPROVED
  readonly liveSignatureClaimAllowed: boolean;    // UNIQUEMENT si LIVE_VERIFIED
  readonly blockers: string[];
  readonly warnings: string[];
  readonly fallbackDefinition: string;
  readonly copyRequirement: string;
  readonly note: string;
}

/**
 * Évalue la clôture provider. LIVE_VERIFIED exige la readiness P11 live (attestation owner + non-sandbox
 * + clés/webhook) — jamais depuis un bool nu. Sinon SANDBOX_ONLY / MISSING / BLOCKED, avec un repli
 * officiel FALLBACK_APPROVED possible (owner) : Pierre prépare les documents, export/téléchargement humain,
 * signature manuelle/externe hors CloneStore, AUCUNE revendication de signature live. Pur (lit l'env).
 */
export function evaluateProviderClosure(env: ProviderEnv = process.env): ProviderClosureResult {
  const p11 = evaluateProviderReadiness(env);
  const mode = detectSignatureMode(env);
  // P15 durcit (review) : LIVE_VERIFIED exige mode==='live' (URL provider live vérifiée), pas seulement
  // « non-sandbox ». Une clé + webhook + attestation owner SANS URL live (mode 'unknown') ne suffisent pas.
  const liveVerified = p11.signature.live && mode === "live";
  const sandboxDetected = mode === "sandbox";
  const apiKeyLiveShaped = p11.signature.apiKeyPresent && mode !== "sandbox";
  // Preuve provider = attestation owner de vérif live (le seul artefact qui atteste la signature live).
  const providerProofArtifactPresent = flagOn(env.CLONESTORE_SIGNATURE_LIVE_VERIFIED);
  const fallbackApproved = flagOn(env.CLONESTORE_SIGNATURE_FALLBACK_APPROVED);

  const blockers: string[] = [...p11.blockers];
  const warnings: string[] = [...p11.warnings];

  let status: ProviderClosureStatus;
  if (liveVerified) {
    status = "LIVE_VERIFIED";
  } else if (sandboxDetected) {
    status = "SANDBOX_ONLY";
    if (fallbackApproved) warnings.push("Fallback approuvé mais provider en SANDBOX : ne JAMAIS revendiquer une signature live.");
  } else if (fallbackApproved) {
    status = "FALLBACK_APPROVED";
  } else if (!p11.signature.apiKeyPresent && !p11.signature.provider) {
    status = "MISSING";
  } else {
    status = "BLOCKED";
  }

  const publicPaidLaunchAllowed = status === "LIVE_VERIFIED" || status === "FALLBACK_APPROVED";
  const liveSignatureClaimAllowed = status === "LIVE_VERIFIED";

  if (status !== "LIVE_VERIFIED" && status !== "FALLBACK_APPROVED") {
    blockers.push("Signature ni LIVE ni FALLBACK approuvé — lancement public payant bloqué côté signature.");
  }

  return {
    status, liveVerified, fallbackApproved, sandboxDetected, apiKeyLiveShaped, providerProofArtifactPresent,
    publicPaidLaunchAllowed, liveSignatureClaimAllowed, blockers, warnings,
    fallbackDefinition: "Repli officiel : Pierre PRÉPARE les documents RH ; l'humain les exporte/télécharge ; la signature se fait manuellement ou via un outil externe HORS CloneStore. AUCUNE signature électronique live dans le produit ; AUCUNE revendication « Yousign live ».",
    copyRequirement: status === "FALLBACK_APPROVED"
      ? "OBLIGATOIRE : toute la copie/UI doit indiquer « document PRÉPARÉ, à faire signer » et ne JAMAIS afficher « signé/signature live »."
      : status === "LIVE_VERIFIED" ? "Signature live vérifiée — la copie peut refléter une signature électronique réelle."
      : "Aucune revendication de signature (ni live ni préparée-signable) tant que LIVE_VERIFIED ou FALLBACK_APPROVED n'est pas atteint.",
    note: "La readiness provider n'est jamais true depuis un bool nu : LIVE_VERIFIED dérive de la readiness P11 (attestation owner CLONESTORE_SIGNATURE_LIVE_VERIFIED + non-sandbox + clés + webhook). Yousign P8.7.4 reste OPEN par défaut.",
  };
}
