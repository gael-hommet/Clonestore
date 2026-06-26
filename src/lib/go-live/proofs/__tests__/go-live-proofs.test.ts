// P-FINAL 02 — Go-Live Proofs Tests
// Covers: proof-registry, proof-validator, proof-status, proof-file, proof-fixtures.
// Pure functions only — no Supabase, no Next.js, no async.

import { describe, it, expect } from "vitest";

// Registry
import {
  getGoLiveProofRegistry,
  getRequiredPublicLaunchProofs,
  getRequiredPrivatePilotProofs,
  getProofsByCategory,
  getBlockingProofs,
  getProofById,
} from "@/lib/go-live/proofs/proof-registry";

// Validator
import {
  validateSingleProof,
  assertNoFakeProofs,
  validateProofSet,
  buildMissingProofsReport,
} from "@/lib/go-live/proofs/proof-validator";

// Status helpers
import {
  isProofVerified,
  getVerifiedProofIds,
  getPendingProofIds,
  getFailedProofIds,
  countByStatus,
  summarizeProofFile,
  getProofCoveragePercent,
} from "@/lib/go-live/proofs/proof-status";

// File helpers
import {
  parseGoLiveProofFile,
  validateGoLiveProofFile,
  redactProofFileForClient,
  summarizeGoLiveProofFile,
  buildProofFileTemplate,
} from "@/lib/go-live/proofs/proof-file";

// Fixtures
import {
  FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED,
  FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED,
  FIXTURE_NO_PROOFS,
  FIXTURE_LEGAL_MISSING,
  FIXTURE_STRIPE_MISSING,
  FIXTURE_SUPABASE_MISSING,
  FIXTURE_PAID_CUSTOMER_MISSING,
  FIXTURE_DEMO_MISSING,
  FIXTURE_COPY_MISSING,
  FIXTURE_PRIVATE_PILOT_READY,
  FIXTURE_FAKE_PROOF,
  FIXTURE_SUSPICIOUS_PROOF,
  FIXTURE_ALL_PENDING,
  FIXTURE_PROOF_FILE_ALL_VERIFIED,
  FIXTURE_PROOF_FILE_EMPTY,
  FIXTURE_PROOF_FILE_MISSING_DATE,
  FIXTURE_PROOF_FILE_MISSING_VERIFIER,
} from "@/lib/go-live/proofs/proof-fixtures";

import type { VerifiedProof } from "@/lib/go-live/proofs/types";

// ── Proof Registry ────────────────────────────────────────────────────────────

describe("proof-registry — getGoLiveProofRegistry", () => {
  it("returns 36 proofs in total", () => {
    expect(getGoLiveProofRegistry()).toHaveLength(36);
  });

  it("every proof has a non-empty id", () => {
    for (const p of getGoLiveProofRegistry()) {
      expect(p.id.trim().length).toBeGreaterThan(0);
    }
  });

  it("every proof id is unique", () => {
    const ids = getGoLiveProofRegistry().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every proof has a non-empty label", () => {
    for (const p of getGoLiveProofRegistry()) {
      expect(p.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("every proof has a valid category", () => {
    const valid = ["legal", "supabase", "stripe", "email", "demo", "paid_customer", "copy", "build"];
    for (const p of getGoLiveProofRegistry()) {
      expect(valid).toContain(p.category);
    }
  });

  it("every proof has a valid owner", () => {
    const valid = ["gael", "lawyer", "developer", "ops"];
    for (const p of getGoLiveProofRegistry()) {
      expect(valid).toContain(p.owner);
    }
  });

  it("every proof has a non-empty description", () => {
    for (const p of getGoLiveProofRegistry()) {
      expect(p.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("every proof has at least one verification step", () => {
    for (const p of getGoLiveProofRegistry()) {
      expect(p.verification_steps.length).toBeGreaterThan(0);
    }
  });
});

describe("proof-registry — getRequiredPublicLaunchProofs", () => {
  it("returns only proofs where required_for_public_launch is true", () => {
    const proofs = getRequiredPublicLaunchProofs();
    expect(proofs.every((p) => p.required_for_public_launch === true)).toBe(true);
  });

  it("returns 30 proofs required for public launch", () => {
    expect(getRequiredPublicLaunchProofs()).toHaveLength(30);
  });

  it("includes LEGAL_CGU_VALIDATED", () => {
    const ids = getRequiredPublicLaunchProofs().map((p) => p.id);
    expect(ids).toContain("LEGAL_CGU_VALIDATED");
  });

  it("includes STRIPE_LIVE_PAYMENT_SUCCESS_TESTED", () => {
    const ids = getRequiredPublicLaunchProofs().map((p) => p.id);
    expect(ids).toContain("STRIPE_LIVE_PAYMENT_SUCCESS_TESTED");
  });

  it("does NOT include STRIPE_LIVE_PAYMENT_FAILURE_TESTED", () => {
    const ids = getRequiredPublicLaunchProofs().map((p) => p.id);
    expect(ids).not.toContain("STRIPE_LIVE_PAYMENT_FAILURE_TESTED");
  });

  it("does NOT include STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED", () => {
    const ids = getRequiredPublicLaunchProofs().map((p) => p.id);
    expect(ids).not.toContain("STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED");
  });

  it("does NOT include PIERRE_BLOCK_AFTER_CANCEL_VERIFIED", () => {
    const ids = getRequiredPublicLaunchProofs().map((p) => p.id);
    expect(ids).not.toContain("PIERRE_BLOCK_AFTER_CANCEL_VERIFIED");
  });
});

describe("proof-registry — getRequiredPrivatePilotProofs", () => {
  it("returns only proofs where required_for_private_pilot is true", () => {
    const proofs = getRequiredPrivatePilotProofs();
    expect(proofs.every((p) => p.required_for_private_pilot === true)).toBe(true);
  });

  it("returns 13 proofs required for private pilot", () => {
    expect(getRequiredPrivatePilotProofs()).toHaveLength(13);
  });

  it("includes LEGAL_MENTIONS_VALIDATED", () => {
    const ids = getRequiredPrivatePilotProofs().map((p) => p.id);
    expect(ids).toContain("LEGAL_MENTIONS_VALIDATED");
  });

  it("includes LEGAL_ENTITY_INFO_COMPLETED", () => {
    const ids = getRequiredPrivatePilotProofs().map((p) => p.id);
    expect(ids).toContain("LEGAL_ENTITY_INFO_COMPLETED");
  });

  it("does NOT include LEGAL_CGU_VALIDATED", () => {
    const ids = getRequiredPrivatePilotProofs().map((p) => p.id);
    expect(ids).not.toContain("LEGAL_CGU_VALIDATED");
  });

  it("does NOT include STRIPE_LIVE_SECRET_SET", () => {
    const ids = getRequiredPrivatePilotProofs().map((p) => p.id);
    expect(ids).not.toContain("STRIPE_LIVE_SECRET_SET");
  });

  it("includes all 4 demo proofs", () => {
    const ids = getRequiredPrivatePilotProofs().map((p) => p.id);
    expect(ids).toContain("DEMO_PUBLIC_SAFE_VERIFIED");
    expect(ids).toContain("DEMO_NO_REAL_AI_VERIFIED");
    expect(ids).toContain("DEMO_NO_REAL_EMAIL_VERIFIED");
    expect(ids).toContain("DEMO_NO_REAL_ACTION_VERIFIED");
  });

  it("includes build proofs", () => {
    const ids = getRequiredPrivatePilotProofs().map((p) => p.id);
    expect(ids).toContain("FINAL_BUILD_CLEAN");
    expect(ids).toContain("FINAL_TESTS_CLEAN");
  });
});

describe("proof-registry — getProofsByCategory", () => {
  it("returns 7 legal proofs", () => {
    expect(getProofsByCategory("legal")).toHaveLength(7);
  });

  it("returns 6 supabase proofs", () => {
    expect(getProofsByCategory("supabase")).toHaveLength(6);
  });

  it("returns 7 stripe proofs", () => {
    expect(getProofsByCategory("stripe")).toHaveLength(7);
  });

  it("returns 4 email proofs", () => {
    expect(getProofsByCategory("email")).toHaveLength(4);
  });

  it("returns 4 demo proofs", () => {
    expect(getProofsByCategory("demo")).toHaveLength(4);
  });

  it("returns 3 paid_customer proofs", () => {
    expect(getProofsByCategory("paid_customer")).toHaveLength(3);
  });

  it("returns 3 copy proofs", () => {
    expect(getProofsByCategory("copy")).toHaveLength(3);
  });

  it("returns 2 build proofs", () => {
    expect(getProofsByCategory("build")).toHaveLength(2);
  });

  it("returns empty array for unknown category", () => {
    expect(getProofsByCategory("unknown_category")).toHaveLength(0);
  });
});

describe("proof-registry — getBlockingProofs", () => {
  it("returns only proofs where blocking_if_missing is true", () => {
    const proofs = getBlockingProofs();
    expect(proofs.every((p) => p.blocking_if_missing === true)).toBe(true);
  });

  it("non-blocking proofs are excluded", () => {
    const ids = getBlockingProofs().map((p) => p.id);
    expect(ids).not.toContain("STRIPE_LIVE_PAYMENT_FAILURE_TESTED");
    expect(ids).not.toContain("EMAIL_DOMAIN_VERIFIED");
    expect(ids).not.toContain("PIERRE_BLOCK_AFTER_CANCEL_VERIFIED");
  });
});

describe("proof-registry — getProofById", () => {
  it("returns the proof for a known ID", () => {
    const p = getProofById("LEGAL_CGU_VALIDATED");
    expect(p).toBeDefined();
    expect(p?.id).toBe("LEGAL_CGU_VALIDATED");
  });

  it("returns the proof for FINAL_BUILD_CLEAN", () => {
    const p = getProofById("FINAL_BUILD_CLEAN");
    expect(p).toBeDefined();
    expect(p?.category).toBe("build");
  });

  it("returns undefined for an unknown ID", () => {
    expect(getProofById("DOES_NOT_EXIST")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getProofById("")).toBeUndefined();
  });
});

// ── Proof Validator ───────────────────────────────────────────────────────────

function makeValidProof(overrides: Partial<VerifiedProof> = {}): VerifiedProof {
  return {
    proof_id: "LEGAL_CGU_VALIDATED",
    status: "verified",
    verified_at: "2026-05-29T12:00:00.000Z",
    verified_by: "Gael Hommet",
    evidence_type: "document",
    evidence_ref: "go-live-evidence/legal/cgu-validation-email.pdf",
    notes: "Validated by juriste on 2026-05-29",
    ...overrides,
  };
}

describe("proof-validator — validateSingleProof", () => {
  it("returns no errors for a valid proof", () => {
    expect(validateSingleProof(makeValidProof())).toHaveLength(0);
  });

  it("returns error if evidence_ref is empty", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "" }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("evidence_ref"))).toBe(true);
  });

  it("returns error if evidence_ref is whitespace only", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "   " }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error if verified_by is empty", () => {
    const errors = validateSingleProof(makeValidProof({ verified_by: "" }));
    expect(errors.some((e) => e.includes("verified_by"))).toBe(true);
  });

  it("returns error if verified_at is empty", () => {
    const errors = validateSingleProof(makeValidProof({ verified_at: "" }));
    expect(errors.some((e) => e.includes("verified_at"))).toBe(true);
  });

  it("returns error if notes is empty", () => {
    const errors = validateSingleProof(makeValidProof({ notes: "" }));
    expect(errors.some((e) => e.includes("notes"))).toBe(true);
  });

  it("returns error if evidence_ref contains 'todo'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "todo-fill-this-later" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error if evidence_ref contains 'placeholder'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "placeholder-ref" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error if evidence_ref contains 'dummy'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "dummy-evidence" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error if evidence_ref contains 'fake'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "fake-evidence.pdf" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error if evidence_ref contains 'tbd'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "tbd" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error if evidence_ref contains 'fixme'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "fixme-this" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error if evidence_ref contains '[à remplir]'", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "[à remplir]" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });

  it("returns error for unknown proof ID", () => {
    const errors = validateSingleProof(makeValidProof({ proof_id: "TOTALLY_UNKNOWN_ID" }));
    expect(errors.some((e) => e.includes("Unknown proof ID"))).toBe(true);
  });

  it("returns error if verified_at is not a parseable date", () => {
    const errors = validateSingleProof(makeValidProof({ verified_at: "not-a-date" }));
    expect(errors.some((e) => e.includes("Invalid verified_at"))).toBe(true);
  });

  it("accepts ISO date string as valid verified_at", () => {
    const errors = validateSingleProof(makeValidProof({ verified_at: "2026-01-15T10:30:00.000Z" }));
    expect(errors.filter((e) => e.includes("verified_at"))).toHaveLength(0);
  });

  it("checks case-insensitively for fake indicators", () => {
    const errors = validateSingleProof(makeValidProof({ evidence_ref: "TODO-fill-this" }));
    expect(errors.some((e) => e.includes("Suspicious"))).toBe(true);
  });
});

describe("proof-validator — assertNoFakeProofs", () => {
  it("returns has_fake: false for empty array", () => {
    const result = assertNoFakeProofs([]);
    expect(result.has_fake).toBe(false);
    expect(result.fake_ids).toHaveLength(0);
  });

  it("returns has_fake: false for valid verified proofs", () => {
    const result = assertNoFakeProofs(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(result.has_fake).toBe(false);
    expect(result.fake_ids).toHaveLength(0);
  });

  it("returns has_fake: true when FIXTURE_FAKE_PROOF (empty evidence_ref) is present", () => {
    const result = assertNoFakeProofs([FIXTURE_FAKE_PROOF]);
    expect(result.has_fake).toBe(true);
    expect(result.fake_ids).toContain("LEGAL_CGU_VALIDATED");
  });

  it("skips pending proofs — does not flag them as fake", () => {
    const pending: VerifiedProof = {
      proof_id: "LEGAL_CGU_VALIDATED",
      status: "pending",
      verified_at: "",
      verified_by: "",
      evidence_type: "manual_attestation",
      evidence_ref: "",
      notes: "",
    };
    const result = assertNoFakeProofs([pending]);
    expect(result.has_fake).toBe(false);
  });

  it("detects suspicious proof from FIXTURE_SUSPICIOUS_PROOF", () => {
    const result = assertNoFakeProofs([FIXTURE_SUSPICIOUS_PROOF]);
    expect(result.has_fake).toBe(true);
  });
});

describe("proof-validator — validateProofSet", () => {
  it("with empty proofs has all public launch proofs missing", () => {
    const result = validateProofSet([]);
    expect(result.missing_public_launch.length).toBe(30);
  });

  it("with empty proofs, is_public_launch_ready is false", () => {
    const result = validateProofSet([]);
    expect(result.is_public_launch_ready).toBe(false);
  });

  it("with empty proofs, is_private_pilot_ready is false", () => {
    const result = validateProofSet([]);
    expect(result.is_private_pilot_ready).toBe(false);
  });

  it("with all public launch proofs verified, is_public_launch_ready is true", () => {
    const result = validateProofSet(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(result.is_public_launch_ready).toBe(true);
  });

  it("with all private pilot proofs verified, is_private_pilot_ready is true", () => {
    const result = validateProofSet(FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED);
    expect(result.is_private_pilot_ready).toBe(true);
  });

  it("detects duplicate proof IDs", () => {
    const dupes = [makeValidProof(), makeValidProof()];
    const result = validateProofSet(dupes);
    expect(result.errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("detects fake proofs and sets has_fake_proofs", () => {
    const result = validateProofSet([FIXTURE_FAKE_PROOF]);
    expect(result.has_fake_proofs).toBe(true);
    expect(result.fake_proof_ids).toContain("LEGAL_CGU_VALIDATED");
  });

  it("counts verified proofs correctly", () => {
    const result = validateProofSet(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(result.verified_count).toBe(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length);
  });

  it("counts pending proofs correctly", () => {
    const result = validateProofSet(FIXTURE_ALL_PENDING);
    expect(result.pending_count).toBe(FIXTURE_ALL_PENDING.length);
    expect(result.verified_count).toBe(0);
  });

  it("counts failed proofs correctly", () => {
    const failed: VerifiedProof = { ...makeValidProof(), status: "failed" };
    const result = validateProofSet([failed]);
    expect(result.failed_count).toBe(1);
  });

  it("includes missing public launch proof IDs", () => {
    const result = validateProofSet(FIXTURE_LEGAL_MISSING);
    expect(result.missing_public_launch).toContain("LEGAL_CGU_VALIDATED");
  });
});

describe("proof-validator — buildMissingProofsReport", () => {
  it("with no proofs, total_missing_public is 30", () => {
    const result = buildMissingProofsReport([]);
    expect(result.total_missing_public).toBe(30);
  });

  it("with no proofs, total_missing_private is 13", () => {
    const result = buildMissingProofsReport([]);
    expect(result.total_missing_private).toBe(13);
  });

  it("with all public launch proofs, total_missing_public is 0", () => {
    const result = buildMissingProofsReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(result.total_missing_public).toBe(0);
  });

  it("missing entries include id, label, category, owner", () => {
    const result = buildMissingProofsReport([]);
    const first = result.public_launch_missing[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("label");
    expect(first).toHaveProperty("category");
    expect(first).toHaveProperty("owner");
  });

  it("with FIXTURE_LEGAL_MISSING, legal proofs appear in public_launch_missing", () => {
    const result = buildMissingProofsReport(FIXTURE_LEGAL_MISSING);
    const missingIds = result.public_launch_missing.map((m) => m.id);
    expect(missingIds).toContain("LEGAL_CGU_VALIDATED");
  });

  it("with FIXTURE_STRIPE_MISSING, stripe proofs appear in public_launch_missing", () => {
    const result = buildMissingProofsReport(FIXTURE_STRIPE_MISSING);
    const missingIds = result.public_launch_missing.map((m) => m.id);
    expect(missingIds).toContain("STRIPE_LIVE_SECRET_SET");
  });

  it("with FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED, total_missing_private is 0", () => {
    const result = buildMissingProofsReport(FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED);
    expect(result.total_missing_private).toBe(0);
  });
});

// ── Proof Status ──────────────────────────────────────────────────────────────

describe("proof-status — isProofVerified", () => {
  it("returns true for verified proof", () => {
    expect(isProofVerified(makeValidProof({ status: "verified" }))).toBe(true);
  });

  it("returns false for pending proof", () => {
    expect(isProofVerified(makeValidProof({ status: "pending" }))).toBe(false);
  });

  it("returns false for failed proof", () => {
    expect(isProofVerified(makeValidProof({ status: "failed" }))).toBe(false);
  });

  it("returns false for skipped proof", () => {
    expect(isProofVerified(makeValidProof({ status: "skipped" }))).toBe(false);
  });
});

describe("proof-status — getVerifiedProofIds", () => {
  it("returns empty array for empty input", () => {
    expect(getVerifiedProofIds([])).toHaveLength(0);
  });

  it("returns only verified proof IDs", () => {
    const mixed: VerifiedProof[] = [
      makeValidProof({ proof_id: "FINAL_BUILD_CLEAN", status: "verified" }),
      makeValidProof({ proof_id: "LEGAL_CGU_VALIDATED", status: "pending" }),
    ];
    const ids = getVerifiedProofIds(mixed);
    expect(ids).toContain("FINAL_BUILD_CLEAN");
    expect(ids).not.toContain("LEGAL_CGU_VALIDATED");
  });

  it("returns all IDs when all are verified", () => {
    const ids = getVerifiedProofIds(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(ids.length).toBe(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length);
  });
});

describe("proof-status — getPendingProofIds / getFailedProofIds", () => {
  it("getPendingProofIds returns only pending IDs", () => {
    const ids = getPendingProofIds(FIXTURE_ALL_PENDING);
    expect(ids.length).toBe(FIXTURE_ALL_PENDING.length);
  });

  it("getFailedProofIds returns only failed IDs", () => {
    const failed: VerifiedProof = makeValidProof({ status: "failed" });
    const ids = getFailedProofIds([failed, makeValidProof({ status: "pending" })]);
    expect(ids).toContain(failed.proof_id);
    expect(ids).toHaveLength(1);
  });

  it("getFailedProofIds returns empty for no failed proofs", () => {
    expect(getFailedProofIds(FIXTURE_ALL_PENDING)).toHaveLength(0);
  });
});

describe("proof-status — countByStatus", () => {
  it("counts verified correctly", () => {
    expect(countByStatus(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED, "verified")).toBe(
      FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length
    );
  });

  it("counts pending correctly", () => {
    expect(countByStatus(FIXTURE_ALL_PENDING, "pending")).toBe(FIXTURE_ALL_PENDING.length);
  });

  it("returns 0 when no matching status", () => {
    expect(countByStatus(FIXTURE_ALL_PENDING, "failed")).toBe(0);
  });
});

describe("proof-status — summarizeProofFile", () => {
  it("with empty proofs returns all zeros", () => {
    const s = summarizeProofFile([]);
    expect(s.total).toBe(0);
    expect(s.verified).toBe(0);
    expect(s.pending).toBe(0);
    expect(s.failed).toBe(0);
  });

  it("with empty proofs, public_launch_ready is false", () => {
    expect(summarizeProofFile([]).public_launch_ready).toBe(false);
  });

  it("with all public launch proofs, public_launch_ready is true", () => {
    expect(summarizeProofFile(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED).public_launch_ready).toBe(true);
  });

  it("with all pilot proofs, private_pilot_ready is true", () => {
    expect(summarizeProofFile(FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED).private_pilot_ready).toBe(true);
  });

  it("total matches input length", () => {
    const s = summarizeProofFile(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(s.total).toBe(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length);
  });

  it("verified count matches verified proofs", () => {
    const s = summarizeProofFile(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(s.verified).toBe(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length);
  });

  it("missing_critical is empty when all public launch verified", () => {
    expect(summarizeProofFile(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED).missing_critical).toHaveLength(0);
  });

  it("missing_critical lists missing public launch IDs", () => {
    const s = summarizeProofFile([]);
    expect(s.missing_critical.length).toBeGreaterThan(0);
  });

  it("counts skipped correctly", () => {
    const skipped: VerifiedProof = makeValidProof({ status: "skipped" });
    const s = summarizeProofFile([skipped]);
    expect(s.skipped).toBe(1);
  });

  it("counts not_applicable correctly", () => {
    const na: VerifiedProof = makeValidProof({ status: "not_applicable" });
    const s = summarizeProofFile([na]);
    expect(s.not_applicable).toBe(1);
  });
});

describe("proof-status — getProofCoveragePercent", () => {
  it("returns 0 with no proofs", () => {
    expect(getProofCoveragePercent([])).toBe(0);
  });

  it("returns 100 with all public launch proofs verified", () => {
    expect(getProofCoveragePercent(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED)).toBe(100);
  });

  it("returns value between 0 and 100 for partial coverage", () => {
    const partial = FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.slice(0, 15);
    const pct = getProofCoveragePercent(partial);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });

  it("counts only verified proofs toward coverage", () => {
    const full = getProofCoveragePercent(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    const pending = getProofCoveragePercent(FIXTURE_ALL_PENDING);
    expect(full).toBeGreaterThan(pending);
  });
});

// ── Proof File ────────────────────────────────────────────────────────────────

describe("proof-file — parseGoLiveProofFile", () => {
  it("returns error for null input", () => {
    const { file, errors } = parseGoLiveProofFile(null);
    expect(file).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for array input", () => {
    const { file, errors } = parseGoLiveProofFile([]);
    expect(file).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for missing generated_at", () => {
    const { errors } = parseGoLiveProofFile({ verified_by: "Gael", environment: "staging", proofs: [] });
    expect(errors.some((e) => e.includes("generated_at"))).toBe(true);
  });

  it("returns error for missing verified_by", () => {
    const { errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      environment: "staging",
      proofs: [],
      verified_by: "",
    });
    expect(errors.some((e) => e.includes("verified_by"))).toBe(true);
  });

  it("returns error for invalid environment", () => {
    const { errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      verified_by: "Gael",
      environment: "invalid-env",
      proofs: [],
    });
    expect(errors.some((e) => e.includes("environment"))).toBe(true);
  });

  it("returns error for missing proofs array", () => {
    const { file, errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      verified_by: "Gael",
      environment: "staging",
    });
    expect(file).toBeNull();
    expect(errors.some((e) => e.includes("proofs"))).toBe(true);
  });

  it("returns a valid file object for a valid input", () => {
    const { file, errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      verified_by: "Gael Hommet",
      environment: "production",
      proofs: [],
    });
    expect(errors).toHaveLength(0);
    expect(file).not.toBeNull();
    expect(file?.environment).toBe("production");
    expect(file?.verified_by).toBe("Gael Hommet");
  });

  it("accepts staging environment", () => {
    const { file, errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      verified_by: "Gael",
      environment: "staging",
      proofs: [],
    });
    expect(errors).toHaveLength(0);
    expect(file?.environment).toBe("staging");
  });

  it("accepts unknown environment", () => {
    const { file, errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      verified_by: "Gael",
      environment: "unknown",
      proofs: [],
    });
    expect(errors).toHaveLength(0);
    expect(file?.environment).toBe("unknown");
  });

  it("skips non-object proofs with an error", () => {
    const { errors } = parseGoLiveProofFile({
      generated_at: "2026-05-29T12:00:00.000Z",
      verified_by: "Gael",
      environment: "staging",
      proofs: ["not-an-object"],
    });
    expect(errors.some((e) => e.includes("index 0"))).toBe(true);
  });

  it("FIXTURE_PROOF_FILE_MISSING_DATE returns errors for missing date", () => {
    const { errors } = parseGoLiveProofFile(FIXTURE_PROOF_FILE_MISSING_DATE);
    expect(errors.some((e) => e.includes("generated_at"))).toBe(true);
  });

  it("FIXTURE_PROOF_FILE_MISSING_VERIFIER returns errors for empty verifier", () => {
    const { errors } = parseGoLiveProofFile(FIXTURE_PROOF_FILE_MISSING_VERIFIER);
    expect(errors.some((e) => e.includes("verified_by"))).toBe(true);
  });
});

describe("proof-file — validateGoLiveProofFile", () => {
  it("returns no errors for a valid file", () => {
    const errors = validateGoLiveProofFile(FIXTURE_PROOF_FILE_EMPTY);
    expect(errors).toHaveLength(0);
  });

  it("returns error for missing generated_at", () => {
    const file = { ...FIXTURE_PROOF_FILE_EMPTY, generated_at: "" };
    const errors = validateGoLiveProofFile(file);
    expect(errors.some((e) => e.includes("generated_at"))).toBe(true);
  });

  it("returns error for empty verified_by", () => {
    const file = { ...FIXTURE_PROOF_FILE_EMPTY, verified_by: "" };
    const errors = validateGoLiveProofFile(file);
    expect(errors.some((e) => e.includes("verified_by"))).toBe(true);
  });

  it("returns error for verified proof with empty evidence_ref", () => {
    const file = {
      ...FIXTURE_PROOF_FILE_EMPTY,
      proofs: [{ ...makeValidProof(), evidence_ref: "" }],
    };
    const errors = validateGoLiveProofFile(file);
    expect(errors.some((e) => e.includes("evidence_ref"))).toBe(true);
  });

  it("returns error for verified proof with empty verified_by", () => {
    const file = {
      ...FIXTURE_PROOF_FILE_EMPTY,
      proofs: [{ ...makeValidProof(), verified_by: "" }],
    };
    const errors = validateGoLiveProofFile(file);
    expect(errors.some((e) => e.includes("verified_by"))).toBe(true);
  });

  it("returns error for verified proof with empty verified_at", () => {
    const file = {
      ...FIXTURE_PROOF_FILE_EMPTY,
      proofs: [{ ...makeValidProof(), verified_at: "" }],
    };
    const errors = validateGoLiveProofFile(file);
    expect(errors.some((e) => e.includes("verified_at"))).toBe(true);
  });

  it("accepts valid proof file with all proofs verified", () => {
    const errors = validateGoLiveProofFile(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(errors).toHaveLength(0);
  });
});

describe("proof-file — redactProofFileForClient", () => {
  it("replaces evidence_ref with [redacted]", () => {
    const redacted = redactProofFileForClient(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    for (const proof of redacted.proofs) {
      expect(proof.evidence_ref).toBe("[redacted]");
    }
  });

  it("replaces notes with [redacted]", () => {
    const redacted = redactProofFileForClient(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    for (const proof of redacted.proofs) {
      expect(proof.notes).toBe("[redacted]");
    }
  });

  it("does not modify other proof fields", () => {
    const redacted = redactProofFileForClient(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    for (const proof of redacted.proofs) {
      expect(proof.proof_id).toBeTruthy();
      expect(proof.status).toBeTruthy();
      expect(proof.verified_by).toBeTruthy();
    }
  });

  it("does not modify file-level metadata", () => {
    const redacted = redactProofFileForClient(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(redacted.generated_at).toBe(FIXTURE_PROOF_FILE_ALL_VERIFIED.generated_at);
    expect(redacted.environment).toBe(FIXTURE_PROOF_FILE_ALL_VERIFIED.environment);
    expect(redacted.verified_by).toBe(FIXTURE_PROOF_FILE_ALL_VERIFIED.verified_by);
  });

  it("preserves proof count after redaction", () => {
    const redacted = redactProofFileForClient(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(redacted.proofs.length).toBe(FIXTURE_PROOF_FILE_ALL_VERIFIED.proofs.length);
  });
});

describe("proof-file — summarizeGoLiveProofFile", () => {
  it("returns environment from the file", () => {
    const s = summarizeGoLiveProofFile(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(s.environment).toBe("production");
  });

  it("returns verified_by from the file", () => {
    const s = summarizeGoLiveProofFile(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(s.verified_by).toBeTruthy();
  });

  it("returns generated_at from the file", () => {
    const s = summarizeGoLiveProofFile(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(s.generated_at).toBeTruthy();
  });

  it("returns public_launch_ready true for all-verified file", () => {
    const s = summarizeGoLiveProofFile(FIXTURE_PROOF_FILE_ALL_VERIFIED);
    expect(s.public_launch_ready).toBe(true);
  });

  it("returns public_launch_ready false for empty file", () => {
    const s = summarizeGoLiveProofFile(FIXTURE_PROOF_FILE_EMPTY);
    expect(s.public_launch_ready).toBe(false);
  });
});

describe("proof-file — buildProofFileTemplate", () => {
  it("returns a valid structure with empty proofs", () => {
    const t = buildProofFileTemplate();
    expect(t.proofs).toHaveLength(0);
    expect(t.environment).toBe("production");
  });

  it("returns a recent generated_at", () => {
    const t = buildProofFileTemplate();
    const d = new Date(t.generated_at);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it("includes verified_by as Gael Hommet", () => {
    const t = buildProofFileTemplate();
    expect(t.verified_by).toBe("Gael Hommet");
  });
});

// ── Fixtures Integrity ────────────────────────────────────────────────────────

describe("proof-fixtures — integrity checks", () => {
  it("FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED count matches public launch proof count", () => {
    expect(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length).toBe(
      getRequiredPublicLaunchProofs().length
    );
  });

  it("FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED count matches private pilot proof count", () => {
    expect(FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED.length).toBe(
      getRequiredPrivatePilotProofs().length
    );
  });

  it("FIXTURE_NO_PROOFS is empty", () => {
    expect(FIXTURE_NO_PROOFS).toHaveLength(0);
  });

  it("FIXTURE_LEGAL_MISSING has no legal-category proof IDs", () => {
    const legalIds = getProofsByCategory("legal").map((p) => p.id);
    for (const p of FIXTURE_LEGAL_MISSING) {
      expect(legalIds).not.toContain(p.proof_id);
    }
  });

  it("FIXTURE_STRIPE_MISSING has no stripe-category proof IDs", () => {
    const stripeIds = getProofsByCategory("stripe").map((p) => p.id);
    for (const p of FIXTURE_STRIPE_MISSING) {
      expect(stripeIds).not.toContain(p.proof_id);
    }
  });

  it("FIXTURE_SUPABASE_MISSING has no supabase-category proof IDs", () => {
    const supabaseIds = getProofsByCategory("supabase").map((p) => p.id);
    for (const p of FIXTURE_SUPABASE_MISSING) {
      expect(supabaseIds).not.toContain(p.proof_id);
    }
  });

  it("FIXTURE_PAID_CUSTOMER_MISSING has no paid_customer proof IDs", () => {
    const paidIds = getProofsByCategory("paid_customer").map((p) => p.id);
    for (const p of FIXTURE_PAID_CUSTOMER_MISSING) {
      expect(paidIds).not.toContain(p.proof_id);
    }
  });

  it("FIXTURE_FAKE_PROOF has empty evidence_ref", () => {
    expect(FIXTURE_FAKE_PROOF.evidence_ref).toBe("");
  });

  it("FIXTURE_FAKE_PROOF status is verified (so it is checked as fake)", () => {
    expect(FIXTURE_FAKE_PROOF.status).toBe("verified");
  });

  it("FIXTURE_ALL_PENDING has all pending status", () => {
    for (const p of FIXTURE_ALL_PENDING) {
      expect(p.status).toBe("pending");
    }
  });

  it("FIXTURE_PROOF_FILE_ALL_VERIFIED environment is production", () => {
    expect(FIXTURE_PROOF_FILE_ALL_VERIFIED.environment).toBe("production");
  });

  it("FIXTURE_PROOF_FILE_EMPTY has no proofs", () => {
    expect(FIXTURE_PROOF_FILE_EMPTY.proofs).toHaveLength(0);
  });

  it("FIXTURE_PRIVATE_PILOT_READY contains only verified proofs", () => {
    for (const p of FIXTURE_PRIVATE_PILOT_READY) {
      expect(p.status).toBe("verified");
    }
  });

  it("FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED all proofs are verified status", () => {
    for (const p of FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED) {
      expect(p.status).toBe("verified");
    }
  });

  it("FIXTURE_SUSPICIOUS_PROOF has suspicious evidence_ref", () => {
    expect(FIXTURE_SUSPICIOUS_PROOF.evidence_ref.toLowerCase()).toMatch(/todo|placeholder|dummy|fake/);
  });

  it("FIXTURE_DEMO_MISSING has no demo proof IDs", () => {
    const demoIds = getProofsByCategory("demo").map((p) => p.id);
    for (const p of FIXTURE_DEMO_MISSING) {
      expect(demoIds).not.toContain(p.proof_id);
    }
  });

  it("FIXTURE_COPY_MISSING has no copy proof IDs", () => {
    const copyIds = getProofsByCategory("copy").map((p) => p.id);
    for (const p of FIXTURE_COPY_MISSING) {
      expect(copyIds).not.toContain(p.proof_id);
    }
  });
});
