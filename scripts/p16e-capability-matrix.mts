// scripts/p16e-capability-matrix.mts
// P16E §5 — generate the capability closure matrix from the REAL canon registry (215 caps),
// mapping the canon's rich implementation status to the P16E status vocabulary with an HONEST
// rule: a capability is OPERATIONAL only when it is VERIFIED_EXISTING *and carries evidence*
// (a governed path proven by a test/route). VERIFIED-without-evidence is DOWNGRADED, never
// rubber-stamped. Writes .p16e-proofs/capability-closure-matrix.json.
import { writeFileSync } from "fs";
import { HR_CAPABILITIES } from "../src/lib/pierre/v1/hr-canon/capability-registry.ts";
import { HR_DOMAINS } from "../src/lib/pierre/v1/hr-canon/domains.ts";

type P16EStatus =
  | "OPERATIONAL" | "PREPARE_ONLY" | "SIMULATED_PROVIDER" | "BLOCKED_MISSING_PROVIDER"
  | "BLOCKED_MISSING_DATA" | "PLANNED" | "DEPRECATED";

function mapStatus(cap: any): { p16e: P16EStatus; reason: string } {
  const hasEvidence = Array.isArray(cap.evidence) && cap.evidence.length > 0;
  const hasRefs = Array.isArray(cap.implementationReferences) && cap.implementationReferences.length > 0;
  switch (cap.implementation) {
    case "VERIFIED_EXISTING":
      return hasEvidence
        ? { p16e: "OPERATIONAL", reason: "governed path proven by test/route evidence" }
        : { p16e: "PREPARE_ONLY", reason: "VERIFIED but NO evidence -> downgraded (not rubber-stamped)" };
    case "HUMAN_ONLY":
      return { p16e: "PREPARE_ONLY", reason: "human-only decision: Pierre prepares, human decides" };
    case "EXTERNAL_DEPENDENCY":
      return { p16e: "BLOCKED_MISSING_PROVIDER", reason: "blocked on a real external provider" };
    case "LEGAL_CONTENT_REQUIRED":
      return { p16e: "BLOCKED_MISSING_DATA", reason: "needs verified country legal rules" };
    case "IMPLEMENTED_UNVERIFIED":
      return { p16e: hasRefs ? "PREPARE_ONLY" : "PLANNED", reason: "code exists but not proven by a test/route" };
    case "PARTIAL":
      return { p16e: "PLANNED", reason: "some of the flow exists, not complete" };
    case "CONTRACT_ONLY":
      return { p16e: "PLANNED", reason: "only a type/interface exists" };
    case "MISSING":
      return { p16e: "PLANNED", reason: "absent (declared, not built)" };
    case "OUT_OF_SCOPE":
      return { p16e: "DEPRECATED", reason: "deliberately not Pierre's job" };
    default:
      return { p16e: "PLANNED", reason: `unmapped canon status: ${cap.implementation}` };
  }
}

const rows = HR_CAPABILITIES.map((cap: any) => {
  const m = mapStatus(cap);
  return {
    id: cap.id, domain: cap.domain, label: cap.label, autonomy: cap.autonomy,
    canon_status: cap.implementation, p16e_status: m.p16e, reason: m.reason,
    risk: cap.risk?.level ?? cap.risk ?? "low",
    has_evidence: (cap.evidence?.length ?? 0) > 0,
    has_implementation_refs: (cap.implementationReferences?.length ?? 0) > 0,
    human_only: cap.implementation === "HUMAN_ONLY" || cap.autonomy === "observe_only",
  };
});

const byStatus: Record<string, number> = {};
for (const r of rows) byStatus[r.p16e_status] = (byStatus[r.p16e_status] ?? 0) + 1;
const byCanon: Record<string, number> = {};
for (const r of rows) byCanon[r.canon_status] = (byCanon[r.canon_status] ?? 0) + 1;
const byDomain: Record<string, Record<string, number>> = {};
for (const r of rows) { (byDomain[r.domain] ??= {}); byDomain[r.domain][r.p16e_status] = (byDomain[r.domain][r.p16e_status] ?? 0) + 1; }

// Integrity flags (dishonesty detectors).
const verified_without_evidence = rows.filter((r) => r.canon_status === "VERIFIED_EXISTING" && !r.has_evidence).map((r) => r.id);
const dupes: Record<string, number> = {};
for (const r of rows) dupes[r.id] = (dupes[r.id] ?? 0) + 1;
const duplicate_ids = Object.entries(dupes).filter(([, n]) => n > 1).map(([id]) => id);

const out = {
  generated_by: "scripts/p16e-capability-matrix.mts (from real hr-canon registry)",
  total_capabilities: rows.length,
  total_domains: HR_DOMAINS.length,
  honest_mapping_rule: "OPERATIONAL requires VERIFIED_EXISTING + evidence (a governed path proven by a test/route); VERIFIED-without-evidence is downgraded to PREPARE_ONLY",
  distribution_p16e: byStatus,
  distribution_canon: byCanon,
  by_domain: byDomain,
  integrity: {
    verified_without_evidence_count: verified_without_evidence.length,
    verified_without_evidence: verified_without_evidence.slice(0, 40),
    duplicate_ids: duplicate_ids,
  },
  operational_ids_sample: rows.filter((r) => r.p16e_status === "OPERATIONAL").slice(0, 30).map((r) => r.id),
  human_only_count: rows.filter((r) => r.human_only).length,
  capabilities: rows,
};

writeFileSync(".p16e-proofs/capability-closure-matrix.json", JSON.stringify(out, null, 2));
console.log("capabilities:", rows.length, "domains:", HR_DOMAINS.length);
console.log("P16E distribution:", JSON.stringify(byStatus));
console.log("verified_without_evidence:", verified_without_evidence.length, "duplicate_ids:", duplicate_ids.length);
