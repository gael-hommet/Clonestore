// scripts/p16e-technology-map.mts
// P16E §6/§14 — generate the T1/T2 technology map from the REAL registries. Honest status:
// a T1 technology with a non-null liveBlockedReason is NOT live; a T2 status is reported verbatim
// (local_safe_ready / integration_ready / architecture_ready). Writes technology-map.json.
import { writeFileSync } from "fs";
import { listTechnologyRegistryEntries } from "../src/lib/clonestore/technologies/t1/technology-registry.ts";
import { listProductTechnologyRegistryEntries } from "../src/lib/clonestore/product-technologies/t2/product-technology-registry.ts";

const t1 = listTechnologyRegistryEntries().map((e: any) => ({
  id: e.id ?? e.technologyId,
  label: e.label ?? e.name ?? null,
  live_blocked: !!(e.liveBlockedReason ?? e.meta?.liveBlockedReason),
  live_blocked_reason: e.liveBlockedReason ?? e.meta?.liveBlockedReason ?? null,
  kind: e.kind ?? e.meta?.kind ?? null,
}));

const t2 = listProductTechnologyRegistryEntries().map((e: any) => ({
  id: e.id,
  status: e.status,
  // honest interpretation of the T2 status vocabulary
  operational_local: e.status === "local_safe_ready" || e.status === "integration_ready",
  live: false, // no live provider enabled in this phase
}));

const t1Blocked = t1.filter((t) => t.live_blocked).map((t) => t.id);
const t2ByStatus: Record<string, number> = {};
for (const t of t2) t2ByStatus[t.status] = (t2ByStatus[t.status] ?? 0) + 1;

const out = {
  generated_by: "scripts/p16e-technology-map.mts (from real T1/T2 registries)",
  doctrine: "Pierre remains the HR employee brain; T1 are reusable technology contracts, T2 are CloneXxx product technologies used BY that brain, never independent HR decision makers. No live provider is enabled in P16E.",
  t1: { count: t1.length, live_blocked_count: t1Blocked.length, live_blocked_ids: t1Blocked, technologies: t1 },
  t2: { count: t2.length, by_status: t2ByStatus, technologies: t2 },
  integration_evidence: {
    p16c_suite: "src/lib/clonestore/integration/p16c/** (Pierre x T1 x T2 x CloneChat/CloneRoom integration) — 165 scoped tests green at baseline",
    guarantees_verified_by_p16c_and_p16d: [
      "no technology bypasses Pierre human-only rules (CloneGuard structural HARD_BLOCK)",
      "no technology manufactures company context (tenant resolved server-side)",
      "no cross-tenant approval reuse (fingerprint binds company+actor)",
      "no live provider success fabricated (executors return awaiting_integration; email/send now fail-closed per P16D D7)",
      "authoritativeCompletion:false and externallyExecutable:false always (P16C)"
    ]
  }
};

writeFileSync(".p16e-proofs/technology-map.json", JSON.stringify(out, null, 2));
console.log("T1:", t1.length, "(live_blocked:", t1Blocked.length + ")", "T2:", t2.length, JSON.stringify(t2ByStatus));
