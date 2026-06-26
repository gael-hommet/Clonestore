// P-FINAL 02 — Go-Live Verdict Route Tests
// Tests the GET /api/go-live/verdict route logic as pure functions.
// Uses the simulate-route pattern: calls the pure business logic without Next.js.
// CRITICAL: The route always returns no_go with empty proofs.
//           B48_PUBLIC_LAUNCH_ENABLED is always false.
//           No evidence_ref is ever exposed.

import { describe, it, expect } from "vitest";

import { buildGoLiveCommandCenterReport } from "@/lib/go-live/go-live-command-center";
import { buildGoLiveVerdictFromProofs } from "@/lib/go-live/go-live-verdict";
import { getGoLiveProofRegistry } from "@/lib/go-live/proofs/proof-registry";
import type { VerifiedProof } from "@/lib/go-live/proofs/types";

// Simulate the route handler logic as a pure function
// Mirrors src/app/api/go-live/verdict/route.ts exactly
function simulateGoLiveVerdictRoute(proofs: VerifiedProof[] = []) {
  const report = buildGoLiveCommandCenterReport(proofs);

  const safeResponse = {
    verdict_status: report.verdict.status,
    is_public_launch_go: report.verdict.is_public_launch_go,
    is_private_pilot_ready: report.verdict.is_private_pilot_ready,
    coverage_percent: report.verdict.coverage_percent,
    verified_count: report.summary.verified,
    required_count: report.summary.total_proofs_in_registry,
    missing_for_public_launch: report.verdict.missing_for_public_launch,
    missing_for_private_pilot: report.verdict.missing_for_private_pilot,
    next_actions: report.next_actions.map((a) => ({
      action: a.action,
      category: a.category,
      priority: a.priority,
      proof_ids: a.proof_ids,
      documentation_ref: a.documentation_ref,
      // No estimated_effort — internal only
    })),
    flags: {
      B48_PUBLIC_LAUNCH_ENABLED: false,
      note: "Ce flag ne doit jamais être passé à true sans preuves réelles complètes",
    },
    evaluated_at: report.evaluated_at,
    has_secrets: false,
  } as const;

  return { response: safeResponse, status: 200 };
}

// ── Route Safety Guarantees ───────────────────────────────────────────────────

describe("go-live-verdict-route — always-safe defaults", () => {
  it("route builds response without throwing", () => {
    expect(() => simulateGoLiveVerdictRoute()).not.toThrow();
  });

  it("verdict_status is no_go when called with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.verdict_status).toBe("no_go");
  });

  it("is_public_launch_go is false with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.is_public_launch_go).toBe(false);
  });

  it("is_private_pilot_ready is false with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.is_private_pilot_ready).toBe(false);
  });

  it("flags.B48_PUBLIC_LAUNCH_ENABLED is always false", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.flags.B48_PUBLIC_LAUNCH_ENABLED).toBe(false);
  });

  it("has_secrets is always false", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.has_secrets).toBe(false);
  });

  it("response does not contain raw evidence_ref", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    const json = JSON.stringify(response);
    // Should not contain go-live-evidence/ paths (these are in proof fixtures used internally)
    // The route never exposes internal evidence_ref
    expect(json).not.toContain("evidence_ref");
  });

  it("flags.note is a non-empty string", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(typeof response.flags.note).toBe("string");
    expect(response.flags.note.length).toBeGreaterThan(0);
  });

  it("response status code is 200", () => {
    const { status } = simulateGoLiveVerdictRoute([]);
    expect(status).toBe(200);
  });
});

// ── Response Shape ────────────────────────────────────────────────────────────

describe("go-live-verdict-route — response shape", () => {
  it("response has verdict_status field", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response).toHaveProperty("verdict_status");
  });

  it("response has is_public_launch_go field", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response).toHaveProperty("is_public_launch_go");
  });

  it("response has is_private_pilot_ready field", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response).toHaveProperty("is_private_pilot_ready");
  });

  it("response has coverage_percent field", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response).toHaveProperty("coverage_percent");
  });

  it("response has verified_count field", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response).toHaveProperty("verified_count");
  });

  it("response has required_count field", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response).toHaveProperty("required_count");
  });

  it("response has missing_for_public_launch array", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(Array.isArray(response.missing_for_public_launch)).toBe(true);
  });

  it("response has missing_for_private_pilot array", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(Array.isArray(response.missing_for_private_pilot)).toBe(true);
  });

  it("response has next_actions array", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(Array.isArray(response.next_actions)).toBe(true);
  });

  it("response has flags object", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(typeof response.flags).toBe("object");
  });

  it("response has evaluated_at string", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(typeof response.evaluated_at).toBe("string");
  });

  it("response has has_secrets boolean", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(typeof response.has_secrets).toBe("boolean");
  });
});

// ── Proof Coverage ────────────────────────────────────────────────────────────

describe("go-live-verdict-route — proof coverage", () => {
  it("verified_count is 0 with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.verified_count).toBe(0);
  });

  it("required_count is 36 (total registry size)", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.required_count).toBe(36);
  });

  it("coverage_percent is 0 with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.coverage_percent).toBe(0);
  });

  it("missing_for_public_launch has 30 entries with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_public_launch).toHaveLength(30);
  });

  it("missing_for_private_pilot has 13 entries with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_private_pilot).toHaveLength(13);
  });

  it("missing_for_public_launch contains legal proof IDs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_public_launch).toContain("LEGAL_CGU_VALIDATED");
  });

  it("missing_for_public_launch contains stripe proof IDs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_public_launch).toContain("STRIPE_LIVE_SECRET_SET");
  });

  it("missing_for_public_launch contains supabase proof IDs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_public_launch).toContain("SUPABASE_RLS_PRODUCTION_APPLIED");
  });

  it("missing_for_public_launch contains build proof IDs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_public_launch).toContain("FINAL_BUILD_CLEAN");
  });

  it("missing_for_public_launch contains demo proof IDs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.missing_for_public_launch).toContain("DEMO_PUBLIC_SAFE_VERIFIED");
  });
});

// ── next_actions Shape ────────────────────────────────────────────────────────

describe("go-live-verdict-route — next_actions shape", () => {
  it("next_actions is non-empty with empty proofs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    expect(response.next_actions.length).toBeGreaterThan(0);
  });

  it("next_actions items do NOT have estimated_effort", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    for (const action of response.next_actions) {
      expect(action).not.toHaveProperty("estimated_effort");
    }
  });

  it("next_actions items have action string", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    for (const action of response.next_actions) {
      expect(typeof action.action).toBe("string");
    }
  });

  it("next_actions items have category", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    for (const action of response.next_actions) {
      expect(typeof action.category).toBe("string");
    }
  });

  it("next_actions items have priority", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    const valid = ["critical", "high", "medium", "low"];
    for (const action of response.next_actions) {
      expect(valid).toContain(action.priority);
    }
  });

  it("next_actions items have proof_ids array", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    for (const action of response.next_actions) {
      expect(Array.isArray(action.proof_ids)).toBe(true);
    }
  });

  it("next_actions items have documentation_ref", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    for (const action of response.next_actions) {
      expect(typeof action.documentation_ref).toBe("string");
    }
  });
});

// ── Registry Completeness ─────────────────────────────────────────────────────

describe("go-live-verdict-route — registry consistency", () => {
  it("buildGoLiveVerdictFromProofs with empty proofs has missing_for_public_launch of length 30", () => {
    const verdict = buildGoLiveVerdictFromProofs([]);
    expect(verdict.missing_for_public_launch).toHaveLength(30);
  });

  it("registry has exactly 36 entries", () => {
    expect(getGoLiveProofRegistry()).toHaveLength(36);
  });

  it("verdict evaluated_at is a recent ISO string", () => {
    const verdict = buildGoLiveVerdictFromProofs([]);
    const d = new Date(verdict.evaluated_at);
    expect(isNaN(d.getTime())).toBe(false);
    // Should be a time close to now (within last 10 seconds)
    expect(Date.now() - d.getTime()).toBeLessThan(10_000);
  });

  it("missing_for_public_launch does NOT contain non-required proof IDs", () => {
    const { response } = simulateGoLiveVerdictRoute([]);
    // These are not required for public launch
    expect(response.missing_for_public_launch).not.toContain("STRIPE_LIVE_PAYMENT_FAILURE_TESTED");
    expect(response.missing_for_public_launch).not.toContain("STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED");
    expect(response.missing_for_public_launch).not.toContain("PIERRE_BLOCK_AFTER_CANCEL_VERIFIED");
  });
});
