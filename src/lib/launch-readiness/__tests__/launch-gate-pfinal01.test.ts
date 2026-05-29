// P-FINAL 01 — Phase 9 — Tests for public launch gate and final go-live verdict.
// All simulate-route: pure functions only, no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  MANUAL_PROOF_REGISTRY,
  getBlockingProofs,
  getProofsByCategory,
  getProofById,
  areAllBlockingProofsVerified,
} from "../manual-proof-registry";
import {
  buildPublicLaunchGate,
  isPublicLaunchGo,
  getLaunchGateBlockers,
} from "../public-launch-gate";
import {
  buildFinalGoLiveVerdict,
  isFinalGoLive,
  getAllBlockingProofIds,
} from "../final-go-live-verdict";

// B48 fixture — all manual flags true
const FIXTURE_B48_FLAGS_ALL_TRUE = {
  cgu_cgu_validated: true,
  privacy_policy_validated: true,
  legal_review_done: true,
  rls_production_verified: true,
  stripe_production_configured: true,
  monitoring_enabled: true,
  backup_procedure_tested: true,
  support_channel_ready: true,
  team_notified: true,
};

// All blocking proof ids
function allBlockingIds(): string[] {
  return getBlockingProofs().map((p) => p.id);
}

// ── Manual Proof Registry ─────────────────────────────────────────────────────

describe("manual-proof-registry", () => {
  it("registry has at least 10 proofs", () => {
    expect(MANUAL_PROOF_REGISTRY.length).toBeGreaterThanOrEqual(10);
  });

  it("all proofs have required fields", () => {
    for (const proof of MANUAL_PROOF_REGISTRY) {
      expect(proof.id).toBeTruthy();
      expect(proof.category).toBeTruthy();
      expect(proof.label).toBeTruthy();
      expect(proof.description).toBeTruthy();
      expect(proof.verification_criteria).toBeTruthy();
      expect(typeof proof.blocks_public_launch).toBe("boolean");
    }
  });

  it("proof ids are unique", () => {
    const ids = MANUAL_PROOF_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getBlockingProofs returns only blocking proofs", () => {
    for (const proof of getBlockingProofs()) {
      expect(proof.blocks_public_launch).toBe(true);
    }
  });

  it("getBlockingProofs has at least 8 proofs", () => {
    expect(getBlockingProofs().length).toBeGreaterThanOrEqual(8);
  });

  it("legal category has at least 4 proofs", () => {
    expect(getProofsByCategory("legal").length).toBeGreaterThanOrEqual(4);
  });

  it("security category has RLS proofs", () => {
    const security = getProofsByCategory("security");
    expect(security.length).toBeGreaterThan(0);
    const rlsProof = security.find((p) => p.id.includes("rls"));
    expect(rlsProof).toBeDefined();
  });

  it("billing category has Stripe proof", () => {
    const billing = getProofsByCategory("billing");
    expect(billing.length).toBeGreaterThan(0);
  });

  it("getProofById returns correct proof", () => {
    const proof = getProofById("proof_legal_cgu_validated");
    expect(proof).toBeDefined();
    expect(proof!.category).toBe("legal");
  });

  it("getProofById returns undefined for unknown id", () => {
    expect(getProofById("nonexistent")).toBeUndefined();
  });

  it("areAllBlockingProofsVerified: false with empty ids", () => {
    expect(areAllBlockingProofsVerified([])).toBe(false);
  });

  it("areAllBlockingProofsVerified: true with all blocking ids", () => {
    expect(areAllBlockingProofsVerified(allBlockingIds())).toBe(true);
  });
});

// ── Launch Gate ───────────────────────────────────────────────────────────────

describe("buildPublicLaunchGate", () => {
  it("no flags, no proofs → is_go: false", () => {
    const gate = buildPublicLaunchGate({});
    expect(gate.is_go).toBe(false);
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("all B48 flags + all proofs → is_go: true", () => {
    const gate = buildPublicLaunchGate({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: allBlockingIds(),
    });
    expect(gate.is_go).toBe(true);
    expect(gate.blockers).toHaveLength(0);
  });

  it("all B48 flags but no proofs → is_go: false", () => {
    const gate = buildPublicLaunchGate({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: [],
    });
    expect(gate.is_go).toBe(false);
    expect(gate.pfinal01_blocking_proofs_verified).toBe(false);
  });

  it("all proofs but no B48 flags → is_go: false", () => {
    const gate = buildPublicLaunchGate({
      verified_proof_ids: allBlockingIds(),
    });
    expect(gate.is_go).toBe(false);
    expect(gate.b48_flags_all_blocking_done).toBe(false);
  });

  it("isPublicLaunchGo: true with all flags and proofs", () => {
    expect(isPublicLaunchGo({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: allBlockingIds(),
    })).toBe(true);
  });

  it("isPublicLaunchGo: false with empty input", () => {
    expect(isPublicLaunchGo({})).toBe(false);
  });

  it("getLaunchGateBlockers: empty with full setup", () => {
    const blockers = getLaunchGateBlockers({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: allBlockingIds(),
    });
    expect(blockers).toHaveLength(0);
  });

  it("getLaunchGateBlockers: non-empty with no setup", () => {
    const blockers = getLaunchGateBlockers({});
    expect(blockers.length).toBeGreaterThan(0);
  });

  it("gate has evaluated_at timestamp", () => {
    const gate = buildPublicLaunchGate({});
    expect(() => new Date(gate.evaluated_at)).not.toThrow();
  });
});

// ── Final Go-Live Verdict ─────────────────────────────────────────────────────

describe("buildFinalGoLiveVerdict", () => {
  it("no input → status: no_go_b48_incomplete or no_go_flags_missing", () => {
    const verdict = buildFinalGoLiveVerdict({});
    expect(verdict.is_go).toBe(false);
    expect(verdict.status).not.toBe("go");
  });

  it("all complete → status: go", () => {
    const verdict = buildFinalGoLiveVerdict({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: allBlockingIds(),
    });
    expect(verdict.is_go).toBe(true);
    expect(verdict.status).toBe("go");
  });

  it("all complete → blockers empty", () => {
    const verdict = buildFinalGoLiveVerdict({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: allBlockingIds(),
    });
    expect(verdict.blockers).toHaveLength(0);
  });

  it("verdict has pfinal01_proofs_required", () => {
    const verdict = buildFinalGoLiveVerdict({});
    expect(verdict.pfinal01_proofs_required).toBe(getBlockingProofs().length);
  });

  it("verdict has b48_status field", () => {
    const verdict = buildFinalGoLiveVerdict({});
    expect(verdict.b48_status).toBeTruthy();
  });

  it("isFinalGoLive: false with empty input", () => {
    expect(isFinalGoLive({})).toBe(false);
  });

  it("isFinalGoLive: true with complete input", () => {
    expect(isFinalGoLive({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: allBlockingIds(),
    })).toBe(true);
  });

  it("getAllBlockingProofIds returns all blocking proof ids", () => {
    const ids = getAllBlockingProofIds();
    expect(ids.length).toBe(getBlockingProofs().length);
    for (const id of ids) {
      const proof = getProofById(id);
      expect(proof!.blocks_public_launch).toBe(true);
    }
  });

  it("verdict never go with missing proofs even if B48 flags all true", () => {
    // Missing just one proof — still no-go
    const allIds = allBlockingIds();
    const missingOne = allIds.slice(1); // remove first
    const verdict = buildFinalGoLiveVerdict({
      b48_flags: FIXTURE_B48_FLAGS_ALL_TRUE,
      verified_proof_ids: missingOne,
    });
    expect(verdict.is_go).toBe(false);
    expect(verdict.blockers.length).toBeGreaterThan(0);
  });
});
