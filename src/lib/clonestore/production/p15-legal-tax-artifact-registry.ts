// src/lib/clonestore/production/p15-legal-tax-artifact-registry.ts
// P15 §5 — Registre des ARTEFACTS légaux/fiscaux. Empêche une fausse readiness depuis un simple
// booléen d'env. Une readiness n'est vraie que soutenue par un artefact signé/revu (avocat/comptable)
// avec hash + date + source, OU une attestation OWNER explicite (DISCLOSED comme owner-attested, pas
// une preuve juridique externe). Ne fournit AUCUN conseil juridique — structure la readiness + liste les manques.

export type ArtifactSourceType = "external_lawyer" | "accountant" | "owner_attestation" | "internal_draft";
export type ArtifactStatus = "missing" | "draft" | "reviewed" | "approved" | "rejected" | "expired";

export const REQUIRED_ARTIFACT_IDS = [
  "legal_review_fr", "legal_review_be", "legal_review_lu", "legal_review_ch",
  "tax_vat_review_fr", "tax_vat_review_be", "tax_vat_review_lu", "tax_vat_review_ch",
  "cgu_review", "cgv_review", "dpa_review", "privacy_review", "mentions_legales_review",
  "hr_claims_review", "ai_sensitive_use_review",
] as const;
export type ArtifactId = (typeof REQUIRED_ARTIFACT_IDS)[number];

export interface ArtifactDefinition { readonly artifact_id: ArtifactId; readonly country: string | null; readonly title: string }

export const ARTIFACT_DEFINITIONS: readonly ArtifactDefinition[] = [
  { artifact_id: "legal_review_fr", country: "FR", title: "Revue juridique France" },
  { artifact_id: "legal_review_be", country: "BE", title: "Revue juridique Belgique" },
  { artifact_id: "legal_review_lu", country: "LU", title: "Revue juridique Luxembourg" },
  { artifact_id: "legal_review_ch", country: "CH", title: "Revue juridique Suisse" },
  { artifact_id: "tax_vat_review_fr", country: "FR", title: "Revue fiscale/TVA France" },
  { artifact_id: "tax_vat_review_be", country: "BE", title: "Revue fiscale/TVA Belgique" },
  { artifact_id: "tax_vat_review_lu", country: "LU", title: "Revue fiscale/TVA Luxembourg" },
  { artifact_id: "tax_vat_review_ch", country: "CH", title: "Revue fiscale/TVA Suisse" },
  { artifact_id: "cgu_review", country: null, title: "Revue CGU" },
  { artifact_id: "cgv_review", country: null, title: "Revue CGV" },
  { artifact_id: "dpa_review", country: null, title: "Revue DPA / RGPD" },
  { artifact_id: "privacy_review", country: null, title: "Revue politique de confidentialité" },
  { artifact_id: "mentions_legales_review", country: null, title: "Revue mentions légales" },
  { artifact_id: "hr_claims_review", country: null, title: "Revue des claims commerciaux RH (P14)" },
  { artifact_id: "ai_sensitive_use_review", country: null, title: "Revue usage IA/RH sensible (AI Act)" },
];

export interface LegalTaxArtifact {
  readonly artifact_id: ArtifactId;
  readonly country?: string | null;
  readonly title?: string;
  readonly source_type: ArtifactSourceType;
  readonly status: ArtifactStatus;
  readonly reviewed_at?: string | null;    // ISO
  readonly reviewer?: string | null;
  readonly file_hash?: string | null;      // hash du fichier/contenu revu
  readonly content_hash?: string | null;
  readonly notes?: string | null;
  readonly expires_at?: string | null;     // ISO
}

export interface ArtifactReadiness {
  readonly artifact_id: ArtifactId;
  readonly present: boolean;
  readonly ready: boolean;              // externe reviewed/approved + hash + non expiré
  readonly ownerAttestedOnly: boolean;  // couvert seulement par une attestation owner (disclosed)
  readonly reason: string;
}

export interface LegalTaxRegistryResult {
  readonly legalTaxReady: boolean;      // TOUS les artefacts requis prêts (externe) — jamais depuis un bool nu
  readonly externallyReviewedCount: number;
  readonly ownerAttestedCount: number;
  readonly missing: ArtifactId[];
  readonly draftOnly: ArtifactId[];
  readonly expired: ArtifactId[];
  readonly rejected: ArtifactId[];
  readonly ownerAttestedOnly: ArtifactId[];
  readonly byArtifact: ArtifactReadiness[];
  readonly allExternallyReviewed: boolean;
  readonly note: string;
}

function isExpired(a: LegalTaxArtifact, nowMs: number): boolean {
  if (!a.expires_at) return false;
  const t = Date.parse(a.expires_at);
  return Number.isFinite(t) && t <= nowMs;
}

/**
 * Évalue le registre. RÈGLES :
 *  - external_lawyer/accountant + status reviewed|approved + (file_hash|content_hash) + non expiré → ready (externe).
 *  - owner_attestation → ownerAttestedOnly (autorisé mais DISCLOSED comme owner-attested, PAS preuve externe).
 *  - internal_draft seul → jamais ready.
 *  - missing / expired / rejected → jamais ready (bloque le lancement public).
 * legalTaxReady (externe) n'est true QUE si TOUS les artefacts requis sont externally-reviewed. Pur.
 */
export function evaluateLegalTaxArtifactRegistry(artifacts: readonly LegalTaxArtifact[] = [], opts: { nowMs?: number } = {}): LegalTaxRegistryResult {
  const nowMs = opts.nowMs ?? Date.now();
  const byId = new Map(artifacts.map((a) => [a.artifact_id, a]));
  const byArtifact: ArtifactReadiness[] = [];
  const missing: ArtifactId[] = [], draftOnly: ArtifactId[] = [], expired: ArtifactId[] = [], rejected: ArtifactId[] = [], ownerAttestedOnly: ArtifactId[] = [];

  for (const def of ARTIFACT_DEFINITIONS) {
    const a = byId.get(def.artifact_id);
    if (!a) { missing.push(def.artifact_id); byArtifact.push({ artifact_id: def.artifact_id, present: false, ready: false, ownerAttestedOnly: false, reason: "Artefact absent — bloque le lancement public." }); continue; }

    const hasHash = !!(a.file_hash?.trim() || a.content_hash?.trim());
    const exp = isExpired(a, nowMs);
    if (exp) expired.push(def.artifact_id);
    if (a.status === "rejected") rejected.push(def.artifact_id);

    const isExternal = a.source_type === "external_lawyer" || a.source_type === "accountant";
    const externalReady = isExternal && (a.status === "reviewed" || a.status === "approved") && hasHash && !exp;
    const ownerAttested = a.source_type === "owner_attestation" && (a.status === "reviewed" || a.status === "approved") && hasHash && !exp;

    if (externalReady) {
      byArtifact.push({ artifact_id: def.artifact_id, present: true, ready: true, ownerAttestedOnly: false, reason: `Revu/approuvé par ${a.source_type} + hash + non expiré.` });
    } else if (ownerAttested) {
      ownerAttestedOnly.push(def.artifact_id);
      byArtifact.push({ artifact_id: def.artifact_id, present: true, ready: false, ownerAttestedOnly: true, reason: "Attestation OWNER uniquement (disclosed — PAS une preuve juridique externe)." });
    } else {
      if (a.source_type === "internal_draft" || a.status === "draft") draftOnly.push(def.artifact_id);
      const why = exp ? "expiré" : a.status === "rejected" ? "rejeté" : !hasHash ? "sans hash" : a.status === "draft" || a.source_type === "internal_draft" ? "brouillon interne seul" : "non revu/approuvé";
      byArtifact.push({ artifact_id: def.artifact_id, present: true, ready: false, ownerAttestedOnly: false, reason: `Non prêt (${why}).` });
    }
  }

  const externallyReviewedCount = byArtifact.filter((x) => x.ready).length;
  const ownerAttestedCount = ownerAttestedOnly.length;
  const allExternallyReviewed = externallyReviewedCount === ARTIFACT_DEFINITIONS.length;

  return {
    legalTaxReady: allExternallyReviewed,   // externe complet uniquement
    externallyReviewedCount, ownerAttestedCount,
    missing, draftOnly, expired, rejected, ownerAttestedOnly, byArtifact, allExternallyReviewed,
    note: "legalTaxReady n'est true QUE si TOUS les artefacts sont externally-reviewed (avocat/comptable) avec hash + non expirés. Les attestations owner sont autorisées mais DISCLOSED comme owner-attested (pas une preuve juridique externe) ; un brouillon interne seul ne suffit jamais ; artefact absent/expiré/rejeté bloque le lancement public. Aucun conseil juridique fourni.",
  };
}

/** Un lancement public peut-il procéder côté légal ? Externe complet OU owner-accepté explicite (disclosed risk). Pur. */
export function legalTaxLaunchDecision(result: LegalTaxRegistryResult, ownerAcceptedWithDisclosedRisk = false): { allowed: boolean; mode: "external_complete" | "owner_accepted_disclosed_risk" | "blocked"; reason: string } {
  if (result.allExternallyReviewed) return { allowed: true, mode: "external_complete", reason: "Tous les artefacts légaux/fiscaux externally-reviewed." };
  const noHardMissing = result.missing.length === 0 && result.expired.length === 0 && result.rejected.length === 0;
  if (ownerAcceptedWithDisclosedRisk && noHardMissing) {
    return { allowed: true, mode: "owner_accepted_disclosed_risk", reason: "Owner a explicitement accepté le risque (attestations owner présentes ; PAS une revue externe) — disclosed." };
  }
  return { allowed: false, mode: "blocked", reason: `Bloqué : ${result.missing.length} manquant(s), ${result.expired.length} expiré(s), ${result.rejected.length} rejeté(s) ; owner non-accepté ou hard-missing présent.` };
}
