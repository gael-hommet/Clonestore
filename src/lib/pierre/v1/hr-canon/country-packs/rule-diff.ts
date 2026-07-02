// src/lib/pierre/v1/hr-canon/country-packs/rule-diff.ts
// PHASE 8.12 — diff two rule snapshots to detect legal drift between what a past mission used and the
// current rule set. Any change to a rule a mission relied on flags a re-evaluation. Pure.

import type { RuleSnapshot, FrozenRule } from "./rule-snapshot";

export type RuleChange = { key: string; kind: "added" | "removed" | "status_changed" | "version_changed"; from?: string; to?: string };
export type RuleDiff = { fromId: string; toId: string; changes: RuleChange[]; hasChanges: boolean };

export function diffSnapshots(a: RuleSnapshot, b: RuleSnapshot): RuleDiff {
  const byKey = (s: RuleSnapshot) => new Map(s.rules.map((r) => [r.key, r] as const));
  const A = byKey(a); const B = byKey(b);
  const changes: RuleChange[] = [];
  for (const [k, ra] of A) {
    const rb = B.get(k);
    if (!rb) { changes.push({ key: k, kind: "removed" }); continue; }
    if (ra.status !== rb.status) changes.push({ key: k, kind: "status_changed", from: ra.status, to: rb.status });
    if (ra.version !== rb.version) changes.push({ key: k, kind: "version_changed", from: String(ra.version), to: String(rb.version) });
  }
  for (const k of B.keys()) if (!A.has(k)) changes.push({ key: k, kind: "added" });
  return { fromId: a.snapshotId, toId: b.snapshotId, changes, hasChanges: changes.length > 0 };
}
