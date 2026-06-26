// P-FINAL 02 — Go-Live Verdict + Command Center Tests
// Covers: go-live-verdict.ts, go-live-command-center.ts, go-live-report.ts
// Pure functions only — no Supabase, no Next.js, no async.

import { describe, it, expect } from "vitest";

import {
  buildGoLiveVerdictFromProofs,
  canEnablePublicLaunch,
  isPrivatePilotReady,
} from "@/lib/go-live/go-live-verdict";

import {
  getNextManualActions,
  buildGoLiveCommandCenterReport,
  formatVerdictStatus,
} from "@/lib/go-live/go-live-command-center";

import { renderGoLiveReportMarkdown } from "@/lib/go-live/go-live-report";

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
  FIXTURE_ALL_PENDING,
} from "@/lib/go-live/proofs/proof-fixtures";

import { getRequiredPublicLaunchProofs } from "@/lib/go-live/proofs/proof-registry";

import type { VerifiedProof } from "@/lib/go-live/proofs/types";

// ── Verdict ───────────────────────────────────────────────────────────────────

describe("go-live-verdict — buildGoLiveVerdictFromProofs", () => {
  it("with no proofs returns status no_go", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.status).toBe("no_go");
  });

  it("with all public launch proofs verified returns status go", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(verdict.status).toBe("go");
  });

  it("with all public launch proofs, is_public_launch_go is true", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(verdict.is_public_launch_go).toBe(true);
  });

  it("with no proofs, is_public_launch_go is false", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.is_public_launch_go).toBe(false);
  });

  it("with private pilot proofs, is_private_pilot_ready is true", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_PRIVATE_PILOT_READY);
    expect(verdict.is_private_pilot_ready).toBe(true);
  });

  it("with no proofs, is_private_pilot_ready is false", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.is_private_pilot_ready).toBe(false);
  });

  it("with all pending proofs (no verified), is_public_launch_go is false", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PENDING);
    expect(verdict.is_public_launch_go).toBe(false);
  });

  it("FIXTURE_LEGAL_MISSING returns status legal_blocked", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_LEGAL_MISSING);
    expect(verdict.status).toBe("legal_blocked");
  });

  it("FIXTURE_STRIPE_MISSING returns status billing_blocked", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_STRIPE_MISSING);
    expect(verdict.status).toBe("billing_blocked");
  });

  it("FIXTURE_SUPABASE_MISSING returns status security_blocked", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_SUPABASE_MISSING);
    expect(verdict.status).toBe("security_blocked");
  });

  it("FIXTURE_PAID_CUSTOMER_MISSING returns status paid_flow_blocked", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_PAID_CUSTOMER_MISSING);
    expect(verdict.status).toBe("paid_flow_blocked");
  });

  it("FIXTURE_DEMO_MISSING returns status demo_blocked", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_DEMO_MISSING);
    expect(verdict.status).toBe("demo_blocked");
  });

  it("FIXTURE_COPY_MISSING returns status copy_blocked", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_COPY_MISSING);
    expect(verdict.status).toBe("copy_blocked");
  });

  it("FIXTURE_PRIVATE_PILOT_READY returns status private_pilot_only", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_PRIVATE_PILOT_READY);
    expect(verdict.status).toBe("private_pilot_only");
  });

  it("coverage_percent is 0 with no proofs", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.coverage_percent).toBe(0);
  });

  it("coverage_percent is 100 with all public launch proofs", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(verdict.coverage_percent).toBe(100);
  });

  it("coverage_percent is between 0 and 100 for partial coverage", () => {
    const partial = FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.slice(0, 10);
    const verdict = buildGoLiveVerdictFromProofs(partial);
    expect(verdict.coverage_percent).toBeGreaterThan(0);
    expect(verdict.coverage_percent).toBeLessThan(100);
  });

  it("required_public_count is 30", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.required_public_count).toBe(30);
  });

  it("verified_public_count is 0 with no proofs", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.verified_public_count).toBe(0);
  });

  it("verified_public_count matches public launch proof count when all verified", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(verdict.verified_public_count).toBe(getRequiredPublicLaunchProofs().length);
  });

  it("missing_for_public_launch is empty when all verified", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(verdict.missing_for_public_launch).toHaveLength(0);
  });

  it("missing_for_public_launch contains all 30 when no proofs", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.missing_for_public_launch).toHaveLength(30);
  });

  it("missing_for_private_pilot is empty when pilot proofs verified", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_PRIVATE_PILOT_READY);
    expect(verdict.missing_for_private_pilot).toHaveLength(0);
  });

  it("missing_for_private_pilot contains all 13 when no proofs", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(verdict.missing_for_private_pilot).toHaveLength(13);
  });

  it("blockers_by_category is populated with legal when FIXTURE_LEGAL_MISSING", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_LEGAL_MISSING);
    expect(verdict.blockers_by_category).toHaveProperty("legal");
  });

  it("blockers_by_category has no stripe when FIXTURE_STRIPE_MISSING fulfilled all else", () => {
    // Only stripe missing
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_STRIPE_MISSING);
    expect(verdict.blockers_by_category).toHaveProperty("stripe");
    expect(Object.keys(verdict.blockers_by_category).length).toBe(1);
  });

  it("evaluated_at is a valid ISO string", () => {
    const verdict = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS);
    expect(() => new Date(verdict.evaluated_at)).not.toThrow();
    expect(isNaN(new Date(verdict.evaluated_at).getTime())).toBe(false);
  });

  it("pending proofs do not count toward coverage", () => {
    const pctEmpty = buildGoLiveVerdictFromProofs(FIXTURE_NO_PROOFS).coverage_percent;
    const pctPending = buildGoLiveVerdictFromProofs(FIXTURE_ALL_PENDING).coverage_percent;
    expect(pctEmpty).toBe(pctPending); // both 0
  });
});

describe("go-live-verdict — canEnablePublicLaunch", () => {
  it("returns true when all public launch proofs are verified", () => {
    expect(canEnablePublicLaunch(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED)).toBe(true);
  });

  it("returns false with no proofs", () => {
    expect(canEnablePublicLaunch(FIXTURE_NO_PROOFS)).toBe(false);
  });

  it("returns false with only private pilot proofs", () => {
    expect(canEnablePublicLaunch(FIXTURE_PRIVATE_PILOT_READY)).toBe(false);
  });

  it("returns false with FIXTURE_LEGAL_MISSING", () => {
    expect(canEnablePublicLaunch(FIXTURE_LEGAL_MISSING)).toBe(false);
  });

  it("returns false with FIXTURE_STRIPE_MISSING", () => {
    expect(canEnablePublicLaunch(FIXTURE_STRIPE_MISSING)).toBe(false);
  });
});

describe("go-live-verdict — isPrivatePilotReady", () => {
  it("returns true with all private pilot proofs verified", () => {
    expect(isPrivatePilotReady(FIXTURE_PRIVATE_PILOT_READY)).toBe(true);
  });

  it("returns true with all public launch proofs verified (superset)", () => {
    expect(isPrivatePilotReady(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED)).toBe(true);
  });

  it("returns false with no proofs", () => {
    expect(isPrivatePilotReady(FIXTURE_NO_PROOFS)).toBe(false);
  });

  it("returns false with only pending proofs", () => {
    expect(isPrivatePilotReady(FIXTURE_ALL_PENDING)).toBe(false);
  });

  it("returns false when demo proofs are missing", () => {
    expect(isPrivatePilotReady(FIXTURE_DEMO_MISSING)).toBe(false);
  });
});

// ── Command Center ────────────────────────────────────────────────────────────

describe("go-live-command-center — getNextManualActions", () => {
  it("with no proofs returns actions for multiple categories", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    expect(actions.length).toBeGreaterThan(0);
  });

  it("with all public launch proofs verified returns no actions", () => {
    const actions = getNextManualActions(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(actions).toHaveLength(0);
  });

  it("with FIXTURE_LEGAL_MISSING returns a legal action", () => {
    const actions = getNextManualActions(FIXTURE_LEGAL_MISSING);
    expect(actions.some((a) => a.category === "legal")).toBe(true);
  });

  it("with FIXTURE_STRIPE_MISSING returns a stripe action", () => {
    const actions = getNextManualActions(FIXTURE_STRIPE_MISSING);
    expect(actions.some((a) => a.category === "stripe")).toBe(true);
  });

  it("with FIXTURE_SUPABASE_MISSING returns a supabase action", () => {
    const actions = getNextManualActions(FIXTURE_SUPABASE_MISSING);
    expect(actions.some((a) => a.category === "supabase")).toBe(true);
  });

  it("with FIXTURE_PAID_CUSTOMER_MISSING returns a paid_customer action", () => {
    const actions = getNextManualActions(FIXTURE_PAID_CUSTOMER_MISSING);
    expect(actions.some((a) => a.category === "paid_customer")).toBe(true);
  });

  it("with FIXTURE_DEMO_MISSING returns a demo action", () => {
    const actions = getNextManualActions(FIXTURE_DEMO_MISSING);
    expect(actions.some((a) => a.category === "demo")).toBe(true);
  });

  it("with FIXTURE_COPY_MISSING returns a copy action", () => {
    const actions = getNextManualActions(FIXTURE_COPY_MISSING);
    expect(actions.some((a) => a.category === "copy")).toBe(true);
  });

  it("legal action has critical priority", () => {
    const actions = getNextManualActions(FIXTURE_LEGAL_MISSING);
    const legal = actions.find((a) => a.category === "legal");
    expect(legal?.priority).toBe("critical");
  });

  it("demo action has high priority", () => {
    const actions = getNextManualActions(FIXTURE_DEMO_MISSING);
    const demo = actions.find((a) => a.category === "demo");
    expect(demo?.priority).toBe("high");
  });

  it("copy action has high priority", () => {
    const actions = getNextManualActions(FIXTURE_COPY_MISSING);
    const copy = actions.find((a) => a.category === "copy");
    expect(copy?.priority).toBe("high");
  });

  it("stripe action has critical priority", () => {
    const actions = getNextManualActions(FIXTURE_STRIPE_MISSING);
    const stripe = actions.find((a) => a.category === "stripe");
    expect(stripe?.priority).toBe("critical");
  });

  it("supabase action has critical priority", () => {
    const actions = getNextManualActions(FIXTURE_SUPABASE_MISSING);
    const sub = actions.find((a) => a.category === "supabase");
    expect(sub?.priority).toBe("critical");
  });

  it("actions are sorted: critical before high before medium", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 0; i < actions.length - 1; i++) {
      expect(priorityOrder[actions[i].priority]).toBeLessThanOrEqual(
        priorityOrder[actions[i + 1].priority]
      );
    }
  });

  it("each action has a proof_ids array", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    for (const a of actions) {
      expect(Array.isArray(a.proof_ids)).toBe(true);
      expect(a.proof_ids.length).toBeGreaterThan(0);
    }
  });

  it("each action has a documentation_ref", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    for (const a of actions) {
      expect(typeof a.documentation_ref).toBe("string");
      expect(a.documentation_ref.length).toBeGreaterThan(0);
    }
  });

  it("each action has an action string", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    for (const a of actions) {
      expect(typeof a.action).toBe("string");
      expect(a.action.length).toBeGreaterThan(0);
    }
  });

  it("each action has a category", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    for (const a of actions) {
      expect(typeof a.category).toBe("string");
    }
  });

  it("actions include estimated_effort (internal, not in API response)", () => {
    const actions = getNextManualActions(FIXTURE_NO_PROOFS);
    for (const a of actions) {
      expect(typeof a.estimated_effort).toBe("string");
    }
  });
});

describe("go-live-command-center — buildGoLiveCommandCenterReport", () => {
  it("with no proofs, verdict.status is no_go", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.verdict.status).toBe("no_go");
  });

  it("with all public launch proofs, verdict.status is go", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.verdict.status).toBe("go");
  });

  it("has_secrets is always false", () => {
    const reportEmpty = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    const reportAll = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(reportEmpty.has_secrets).toBe(false);
    expect(reportAll.has_secrets).toBe(false);
  });

  it("flags_required.B48_PUBLIC_LAUNCH_ENABLED is always false", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.flags_required.B48_PUBLIC_LAUNCH_ENABLED).toBe(false);
  });

  it("flags_required.B48_PUBLIC_LAUNCH_ENABLED is false even with all proofs verified", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    // Code must always return false — only a human can set this to true via env vars
    expect(report.flags_required.B48_PUBLIC_LAUNCH_ENABLED).toBe(false);
  });

  it("summary.total_proofs_in_registry is 36", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.summary.total_proofs_in_registry).toBe(36);
  });

  it("summary.verified is 0 with no proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.summary.verified).toBe(0);
  });

  it("summary.verified matches proof count with all proofs verified", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.summary.verified).toBe(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED.length);
  });

  it("summary.is_public_launch_go is false with no proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.summary.is_public_launch_go).toBe(false);
  });

  it("summary.is_public_launch_go is true with all public launch proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.summary.is_public_launch_go).toBe(true);
  });

  it("summary.is_private_pilot_ready is false with no proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.summary.is_private_pilot_ready).toBe(false);
  });

  it("summary.is_private_pilot_ready is true with pilot proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_PRIVATE_PILOT_READY);
    expect(report.summary.is_private_pilot_ready).toBe(true);
  });

  it("next_actions is an array", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(Array.isArray(report.next_actions)).toBe(true);
  });

  it("next_actions is empty when all proofs verified", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.next_actions).toHaveLength(0);
  });

  it("next_actions is non-empty with no proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.next_actions.length).toBeGreaterThan(0);
  });

  it("missing_by_category is populated when proofs are missing", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(Object.keys(report.missing_by_category).length).toBeGreaterThan(0);
  });

  it("missing_by_category is empty when all public launch proofs verified", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(Object.keys(report.missing_by_category).length).toBe(0);
  });

  it("evaluated_at is a valid ISO string", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(isNaN(new Date(report.evaluated_at).getTime())).toBe(false);
  });

  it("summary.public_launch_coverage_percent is 0 with no proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.summary.public_launch_coverage_percent).toBe(0);
  });

  it("summary.public_launch_coverage_percent is 100 with all proofs verified", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.summary.public_launch_coverage_percent).toBe(100);
  });

  it("flags_required.GO_LIVE_ALLOW_PRIVATE_PILOT is true when pilot is ready", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_PRIVATE_PILOT_READY);
    expect(report.flags_required.GO_LIVE_ALLOW_PRIVATE_PILOT).toBe(true);
  });

  it("flags_required.GO_LIVE_ALLOW_PRIVATE_PILOT is false when no proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.flags_required.GO_LIVE_ALLOW_PRIVATE_PILOT).toBe(false);
  });

  it("report does not expose evidence_ref fields on next_actions", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PRIVATE_PILOT_PROOFS_VERIFIED);
    for (const action of report.next_actions) {
      expect(action).not.toHaveProperty("evidence_ref");
    }
  });

  it("summary.pending is 0 with no proofs (no pending proofs were passed)", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.summary.pending).toBe(0);
  });

  it("summary.failed is 0 with all verified proofs", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    expect(report.summary.failed).toBe(0);
  });

  it("verdict is present with all required fields", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    expect(report.verdict).toHaveProperty("status");
    expect(report.verdict).toHaveProperty("is_public_launch_go");
    expect(report.verdict).toHaveProperty("is_private_pilot_ready");
    expect(report.verdict).toHaveProperty("coverage_percent");
    expect(report.verdict).toHaveProperty("blockers_by_category");
  });
});

// ── formatVerdictStatus ───────────────────────────────────────────────────────

describe("go-live-command-center — formatVerdictStatus", () => {
  it("go status includes GO", () => {
    expect(formatVerdictStatus("go")).toContain("GO");
  });

  it("private_pilot_only status mentions PILOT", () => {
    expect(formatVerdictStatus("private_pilot_only")).toMatch(/PILOT|pilot/i);
  });

  it("legal_blocked status mentions juridique or legal", () => {
    expect(formatVerdictStatus("legal_blocked")).toMatch(/juridique|legal/i);
  });

  it("security_blocked status mentions RLS or Supabase", () => {
    expect(formatVerdictStatus("security_blocked")).toMatch(/RLS|Supabase/i);
  });

  it("billing_blocked status mentions Stripe", () => {
    expect(formatVerdictStatus("billing_blocked")).toMatch(/Stripe/i);
  });

  it("demo_blocked status mentions démo or Démo or demo", () => {
    expect(formatVerdictStatus("demo_blocked")).toMatch(/[Dd]émo|demo/i);
  });

  it("copy_blocked status mentions copy or Copy or contenu", () => {
    expect(formatVerdictStatus("copy_blocked")).toMatch(/copy|Copy|contenu/i);
  });

  it("paid_flow_blocked status mentions paid or customer or client", () => {
    expect(formatVerdictStatus("paid_flow_blocked")).toMatch(/paid|customer|client/i);
  });

  it("build_blocked status mentions Build or build", () => {
    expect(formatVerdictStatus("build_blocked")).toMatch(/[Bb]uild/i);
  });

  it("no_go status includes NO-GO", () => {
    expect(formatVerdictStatus("no_go")).toContain("NO-GO");
  });

  it("unknown status returns fallback string", () => {
    // @ts-expect-error testing unknown status
    const result = formatVerdictStatus("totally_unknown_status_xyz");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── go-live-report ────────────────────────────────────────────────────────────

describe("go-live-report — renderGoLiveReportMarkdown", () => {
  it("returns a non-empty string", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    const md = renderGoLiveReportMarkdown(report);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(0);
  });

  it("includes the NO-GO label in the markdown for no_go status", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    const md = renderGoLiveReportMarkdown(report);
    expect(md).toContain("NO-GO");
  });

  it("includes PRÊT marker in markdown when all proofs verified", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    const md = renderGoLiveReportMarkdown(report);
    expect(md).toContain("PRÊT");
  });

  it("does not include evidence_ref in markdown", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_ALL_PUBLIC_LAUNCH_PROOFS_VERIFIED);
    const md = renderGoLiveReportMarkdown(report);
    expect(md).not.toContain("go-live-evidence/test/");
  });

  it("includes coverage percent in markdown", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_NO_PROOFS);
    const md = renderGoLiveReportMarkdown(report);
    expect(md).toContain("0");
  });

  it("markdown is a valid string for the private pilot scenario", () => {
    const report = buildGoLiveCommandCenterReport(FIXTURE_PRIVATE_PILOT_READY);
    const md = renderGoLiveReportMarkdown(report);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(10);
  });
});
