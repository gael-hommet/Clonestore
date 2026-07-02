// src/lib/pierre/v1/hr-canon/country-packs/rule-snapshot.ts
// PHASE 8.12 — a versioned, immutable snapshot of the exact rule versions a mission uses. Freezing
// the rule set at mission start means the mission executes against a known legal state, and the
// evidence records exactly which rule versions (+ statuses) applied — reproducible + auditable.

import { createHash } from "crypto";
import type { CountryRule, Jurisdiction } from "./types";

export type FrozenRule = { key: string; family: string; status: CountryRule["status"]; version: number; hasValue: boolean; sourceCitation: string | null; reviewedBy: string | null };
export type RuleSnapshot = {
  snapshotId: string;
  jurisdiction: Jurisdiction;
  createdAt: string;         // ISO supplied by caller
  rules: FrozenRule[];
  fingerprint: string;       // stable hash of the frozen rule set
  allVerified: boolean;
};

function canonical(rules: FrozenRule[]): string {
  return JSON.stringify([...rules].sort((a, b) => a.key.localeCompare(b.key)).map((r) => [r.key, r.family, r.status, r.version]));
}

export function freezeRules(jurisdiction: Jurisdiction, entries: { rule: CountryRule; family: string; version?: number }[], createdAt: string): RuleSnapshot {
  const rules: FrozenRule[] = entries.map(({ rule, family, version }) => ({
    key: rule.key, family, status: rule.status, version: version ?? 1,
    hasValue: rule.value !== null && rule.value !== undefined, sourceCitation: rule.sourceCitation ?? null, reviewedBy: rule.reviewedBy ?? null,
  }));
  const fingerprint = createHash("sha256").update(canonical(rules)).digest("hex").slice(0, 32);
  return { snapshotId: `${jurisdiction}-${fingerprint}`, jurisdiction, createdAt, rules, fingerprint, allVerified: rules.length > 0 && rules.every((r) => r.status === "VERIFIED") };
}
