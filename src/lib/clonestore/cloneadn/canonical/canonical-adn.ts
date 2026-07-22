// src/lib/clonestore/cloneadn/canonical/canonical-adn.ts
// P19 — CLONEADN CANONICAL MODEL ("Empreinte Entreprise vivante"). The single company-scoped, entity-aware
// representation of how the system must work for THIS company. It is NOT a new store: it is a canonical
// PROJECTION that deterministically maps the three legacy substrates (B28 clone_adn, B44
// enterprise_empreinte/pierre_empreinte, TECH-05 in-memory GlobalEnterpriseMemory) into one value, records
// CONFLICTS explicitly (no silent overwrite), preserves PROVENANCE + confidence, and takes the LEGAL COUNTRY
// only from the P18 geo resolver (never the legacy "FR" seed, never a silent France default).
//
// Write path: only CloneLearn (human-reviewed, versioned) may propose changes — see learning-loop.ts.
// In-memory TECH-05 is treated as the LOWEST-confidence, NON-AUTHORITATIVE reader (never a company's truth).

import type { VersionedAdnLike, AdnProvenanceEntry } from "../../clonelearn/canonical/learning-loop";

export type CanonicalAdnFieldKey =
  | "identity_name" | "tone" | "formality" | "default_language" | "document_language"
  | "validation_mode" | "validation_circuits" | "autonomy_mode" | "sensitive_topics" | "vocabulary";

/** A legacy substrate mapped into canonical fields, with an origin tag + trust weight. */
export type CanonicalAdnSource = {
  readonly provenance: "B28:clone_adn" | "B44:enterprise_empreinte" | "B44:pierre_empreinte" | "TECH-05:global_memory";
  readonly durable: boolean;                 // false for in-memory TECH-05 → lowest confidence, non-authoritative
  readonly fields: Partial<Record<CanonicalAdnFieldKey, unknown>>;
  readonly declaredCountry?: string | null;  // legacy self-declared country (e.g. FR seed) — NEVER authoritative
};

export type CanonicalAdnConflict = {
  readonly field: string;
  readonly chosen: { value: unknown; provenance: string };
  readonly rejected: ReadonlyArray<{ value: unknown; provenance: string }>;
};

export type CanonicalAdn = VersionedAdnLike & {
  readonly entity_id: string | null;
  readonly legal_country: string | null;     // ONLY from geo resolver, never the legacy FR seed
  readonly field_provenance: Record<string, { provenance: string; confidence: number }>;
  readonly conflicts: ReadonlyArray<CanonicalAdnConflict>;
  readonly nonAuthoritativeIgnored: ReadonlyArray<string>; // fields where in-memory-only data was ignored
};

const SOURCE_CONFIDENCE: Record<CanonicalAdnSource["provenance"], number> = {
  "B28:clone_adn": 0.8, "B44:enterprise_empreinte": 0.85, "B44:pierre_empreinte": 0.8, "TECH-05:global_memory": 0.2,
};

function obj(v: unknown): Record<string, unknown> { return (typeof v === "object" && v !== null && !Array.isArray(v)) ? v as Record<string, unknown> : {}; }
function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : null; }

// ── Deterministic legacy mappers (defensive — legacy blobs are heterogeneous) ────────────────────────────

/** B28 CloneADN (`reusable_rh_context_json.clone_adn`). */
export function fromCloneAdnB28(raw: unknown): CanonicalAdnSource {
  const r = obj(raw);
  const identity = obj(r.company_identity);
  const communication = obj(r.communication);
  const document = obj(r.document);
  const validation = obj(r.validation);
  return {
    provenance: "B28:clone_adn", durable: true,
    declaredCountry: str(identity.country_code) ?? str(r.country_code),
    fields: {
      identity_name: str(identity.name),
      tone: str(communication.tone),
      default_language: str(communication.preferred_language),
      document_language: str(document.language),
      validation_mode: str(validation.mode),
      autonomy_mode: str(obj(r.autonomy).mode) ?? str(r.autonomy_mode),
    },
  };
}

/** B44 EnterpriseEmpreinte (`memory_json.enterprise_empreinte`). */
export function fromEnterpriseEmpreinteB44(raw: unknown): CanonicalAdnSource {
  const r = obj(raw);
  const identity = obj(r.company_identity);
  const communication = obj(r.communication);
  const gov = obj(r.data_governance);
  const docPrefs = obj(r.document_preferences);
  return {
    provenance: "B44:enterprise_empreinte", durable: true,
    declaredCountry: str(identity.country_code) ?? str(gov.region),
    fields: {
      identity_name: str(identity.name),
      tone: str(communication.tone),
      formality: str(communication.formality),
      default_language: str(communication.main_language),
      document_language: str(docPrefs.document_language),
      validation_circuits: Array.isArray(r.validation_circuits) ? r.validation_circuits : undefined,
    },
  };
}

/** TECH-05 in-memory GlobalEnterpriseMemory — LOWEST confidence, non-authoritative (never a company's truth). */
export function fromGlobalEnterpriseMemoryTech05(raw: unknown): CanonicalAdnSource {
  const r = obj(raw);
  return {
    provenance: "TECH-05:global_memory", durable: false,
    declaredCountry: str(r.country),
    fields: {
      identity_name: str(obj(r.identity).name) ?? str(r.company_name),
      default_language: str(r.language),
    },
  };
}

/**
 * Resolve the canonical CloneADN for a company/entity by merging legacy sources.
 * - legal_country comes ONLY from `geoLegalCountry` (P18 resolver). The legacy FR seed is never authoritative.
 * - highest-confidence non-null wins per field; a differing non-null value is recorded as an explicit CONFLICT.
 * - in-memory-only (TECH-05) values are recorded but never chosen over durable data, and never invent a value
 *   that no durable source has when the field is authoritative-sensitive (kept but flagged).
 * Pure.
 */
export function resolveCanonicalAdn(params: {
  company_id: string;
  entity_id?: string | null;
  geoLegalCountry: string | null;
  sources: readonly CanonicalAdnSource[];
}): CanonicalAdn {
  const { company_id, geoLegalCountry } = params;
  const entity_id = params.entity_id ?? null;

  const fields: Record<string, unknown> = {};
  const field_provenance: Record<string, { provenance: string; confidence: number }> = {};
  const conflicts: CanonicalAdnConflict[] = [];
  const nonAuthoritativeIgnored: string[] = [];

  // Collect all field keys present across sources.
  const keys = new Set<string>();
  for (const s of params.sources) for (const k of Object.keys(s.fields)) if (s.fields[k as CanonicalAdnFieldKey] != null) keys.add(k);

  for (const key of keys) {
    // Candidates: (value, provenance, confidence, durable), sorted by confidence desc.
    const cands = params.sources
      .map((s) => ({ value: s.fields[key as CanonicalAdnFieldKey], provenance: s.provenance, confidence: SOURCE_CONFIDENCE[s.provenance], durable: s.durable }))
      .filter((c) => c.value != null)
      .sort((a, b) => b.confidence - a.confidence);
    if (cands.length === 0) continue;

    const chosen = cands[0];
    // If the only source(s) providing a value are non-durable (in-memory), keep but flag as non-authoritative.
    if (!cands.some((c) => c.durable)) nonAuthoritativeIgnored.push(key);

    fields[key] = chosen.value;
    field_provenance[key] = { provenance: chosen.provenance, confidence: chosen.confidence };

    // Conflict: any other candidate with a DIFFERENT (stringified) value.
    const differing = cands.slice(1).filter((c) => JSON.stringify(c.value) !== JSON.stringify(chosen.value));
    if (differing.length > 0) {
      conflicts.push({
        field: key,
        chosen: { value: chosen.value, provenance: chosen.provenance },
        rejected: differing.map((c) => ({ value: c.value, provenance: c.provenance })),
      });
    }
  }

  // Country conflict: a legacy source declaring a country that disagrees with the geo authority.
  for (const s of params.sources) {
    if (s.declaredCountry && geoLegalCountry && s.declaredCountry.toUpperCase().slice(0, 2) !== geoLegalCountry.toUpperCase().slice(0, 2)) {
      conflicts.push({
        field: "legal_country",
        chosen: { value: geoLegalCountry, provenance: "geo:resolver" },
        rejected: [{ value: s.declaredCountry, provenance: s.provenance }],
      });
    }
  }

  const provenance: AdnProvenanceEntry[] = [];
  return {
    company_id, entity_id, version: 1,
    legal_country: geoLegalCountry,     // never the legacy FR seed
    fields, field_provenance, conflicts, provenance, nonAuthoritativeIgnored,
  };
}
