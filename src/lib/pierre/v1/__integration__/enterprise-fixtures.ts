// src/lib/pierre/v1/__integration__/enterprise-fixtures.ts
// P16E §5 — DETERMINISTIC synthetic enterprise fixtures (NOT a test file). Seeded generation:
// same seed -> same ids/records. No model calls, no PII, no remote DB. Used by the enterprise
// simulation (§6) and the manifest generator. Every string is synthetic.

export type FixtureScale = "small" | "pme" | "eti" | "group";

export type FixtureSpec = {
  scale: FixtureScale;
  companies: number;
  legal_entities: number;
  sites: number;
  employees: number;
  managers: number;
  countries: number;
  currencies: number;
  duplicate_first_names: boolean;
  stale_records: boolean;
  seeded_anomalies: string[];
};

export const FIXTURE_SPECS: Record<FixtureScale, FixtureSpec> = {
  small: { scale: "small", companies: 1, legal_entities: 1, sites: 1, employees: 15, managers: 1, countries: 1, currencies: 1, duplicate_first_names: false, stale_records: true, seeded_anomalies: ["incomplete_records", "missing_documents", "one_contract_expiry"] },
  pme: { scale: "pme", companies: 1, legal_entities: 1, sites: 2, employees: 120, managers: 8, countries: 1, currencies: 1, duplicate_first_names: true, stale_records: true, seeded_anomalies: ["onboarding", "absences", "training", "pending_validations", "duplicate_first_names"] },
  eti: { scale: "eti", companies: 1, legal_entities: 3, sites: 6, employees: 1500, managers: 60, countries: 1, currencies: 1, duplicate_first_names: true, stale_records: true, seeded_anomalies: ["delegated_approvals", "site_scoped_permissions", "concurrent_workflows", "document_version_changes", "role_revocations"] },
  group: { scale: "group", companies: 1, legal_entities: 8, sites: 40, employees: 10000, managers: 400, countries: 4, currencies: 3, duplicate_first_names: true, stale_records: true, seeded_anomalies: ["duplicate_names", "stale_records", "large_imports", "conflicting_local_rules", "high_concurrency", "provider_uncertainty", "worker_restarts"] },
};

// Deterministic PRNG (mulberry32) — reproducible without Math.random.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FIRST = ["Marie", "Paul", "Sarah", "Marc", "Julie", "Claire", "Nadia", "Ada", "Sophie", "Lukas", "Nguyen", "Dvorak"];
const LAST = ["Martin", "Durand", "Bernard", "Petit", "Robert", "Richard", "Moreau", "Simon", "Laurent", "Michel"];

export type SynthEmployee = { ref: string; first_name: string; last_name: string; site_idx: number; status: string; has_address: boolean; contract_type: string; contract_end: string | null };

/** Generate the employee roster for a scale deterministically (no DB). */
export function generateRoster(scale: FixtureScale, seed = 42): SynthEmployee[] {
  const spec = FIXTURE_SPECS[scale];
  const rnd = mulberry32(seed + spec.employees);
  const out: SynthEmployee[] = [];
  for (let i = 0; i < spec.employees; i++) {
    const first = FIRST[Math.floor(rnd() * FIRST.length)];
    const last = spec.duplicate_first_names ? LAST[Math.floor(rnd() * LAST.length)] : LAST[i % LAST.length];
    const site_idx = Math.floor(rnd() * spec.sites);
    // seeded anomalies: some incomplete (no address), some stale (left), some expiring contracts.
    const r = rnd();
    const status = spec.stale_records && r < 0.03 ? "left" : r < 0.1 ? "onboarding" : "active";
    const has_address = r > 0.15;                                  // ~15% incomplete
    const contract_type = r < 0.2 ? "CDD" : "CDI_FULL_TIME";
    const contract_end = contract_type === "CDD" ? "2026-08-31" : null;
    out.push({ ref: `${scale}-emp-${i}`, first_name: first, last_name: last, site_idx, status, has_address, contract_type, contract_end });
  }
  return out;
}

/** Deterministic manifest of a scale (counts + expected anomalies), no DB. */
export function fixtureManifest(scale: FixtureScale, seed = 42) {
  const spec = FIXTURE_SPECS[scale];
  const roster = generateRoster(scale, seed);
  return {
    scale, spec,
    generated: { employees: roster.length,
      incomplete_records: roster.filter((e) => !e.has_address).length,
      stale_left: roster.filter((e) => e.status === "left").length,
      onboarding: roster.filter((e) => e.status === "onboarding").length,
      expiring_contracts: roster.filter((e) => e.contract_end !== null).length,
      distinct_first_names: new Set(roster.map((e) => e.first_name)).size,
    },
  };
}
