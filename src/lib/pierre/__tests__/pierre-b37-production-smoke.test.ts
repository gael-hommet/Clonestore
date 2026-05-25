// src/lib/pierre/__tests__/pierre-b37-production-smoke.test.ts
// B37 — Production readiness smoke tests: real providers safely gated, audit verdict
// reflects B37 improvements, no real sends, no real API keys.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getActiveChannelProvider } from "../../cloneos/channels/providers/router";
import { resendChannelProvider } from "../../cloneos/channels/providers/resend";
import { extractFileTextAsync } from "../../cloneos/files/extraction";
import { getFileConfig } from "../../cloneos/files/config";
import { buildPierreAuditReport, getPierreAuditVerdict } from "../release-audit/audit-runtime";

// ── 1. Resend never sends without SEND_LIVE=true ──────────────────────────────

describe("smoke — Resend provider never sends in default config", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_smoke_test_key");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_DRY_RUN", "false"); // intentionally off — but SEND_LIVE also false
    vi.stubEnv("EMAIL_SEND_LIVE", "false"); // second gate: still blocks
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("EMAIL_SEND_LIVE=false blocks real send even when EMAIL_DRY_RUN=false", async () => {
    const result = await resendChannelProvider.send({
      envelope: {
        id: "smoke_001", company_id: "co_test", agent_slug: "pierre",
        channel_identity_id: "cid_smoke", direction: "outbound", channel_kind: "email",
        from: "pierre@example.com", to: ["ceo@client.com"], cc: [], bcc: [],
        subject: "Smoke test", body_text: "Ceci ne doit jamais être envoyé.",
        body_html: null, attachments: [], received_at: null, sent_at: null,
        status: "pending", risk_level: "low", approval_required: false,
        related_mission_id: null, related_task_id: null, related_employee_id: null,
        metadata: {},
      },
      body: "Ceci ne doit jamais être envoyé.",
      body_html: null,
    });
    expect(result.ok).toBe(true);
    expect(result.meta.dry_run).toBe(true); // forced into dry-run by SEND_LIVE=false
    expect(result.provider_message_id).toMatch(/^dry_run_/);
  });
});

// ── 2. Mock remains default with no provider config ───────────────────────────

describe("smoke — channel runtime is mock by default", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("production mode + no resend config → mock provider (no accidental live send)", () => {
    vi.stubEnv("CHANNEL_DEFAULT_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_PROVIDER", "");
    const provider = getActiveChannelProvider("production");
    expect(provider?.id).toBe("mock");
  });

  it("disabled mode returns null — no provider can send", () => {
    expect(getActiveChannelProvider("disabled")).toBeNull();
  });
});

// ── 3. File extraction never throws on bad input ──────────────────────────────

describe("smoke — file extraction graceful on unexpected input", () => {
  it("PDF kind with garbage bytes returns error result, does not throw", async () => {
    const cfg = getFileConfig();
    const result = await extractFileTextAsync("pdf", Buffer.from("garbage"), "bad.pdf", cfg);
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("error");
  });

  it("DOCX kind with empty buffer returns ok=false, does not throw", async () => {
    const cfg = getFileConfig();
    const result = await extractFileTextAsync("docx", Buffer.alloc(0), "empty.docx", cfg);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

// ── 4. B36 audit score reflects B37 improvements ─────────────────────────────

describe("smoke — B36 audit score post-B37", () => {
  it("audit verdict is at least almost_sellable after B37", () => {
    const result = buildPierreAuditReport();
    expect(["sellable", "almost_sellable"]).toContain(result.verdict);
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("no blocker gaps (B37 adds infrastructure, removes blocking status from real-email gap)", () => {
    const result = buildPierreAuditReport();
    expect(result.blocker_count).toBe(0);
  });

  it("gap register still contains gap_real_email (honest — live send not validated)", () => {
    const result = buildPierreAuditReport();
    const emailGap = result.report.gap_register.find((g) => g.id === "gap_real_email");
    expect(emailGap).toBeDefined();
    expect(emailGap?.criticality).not.toBe("blocker"); // B37 downgraded from high to medium
  });

  it("verdict string is stable and defined", () => {
    const verdict = getPierreAuditVerdict();
    expect(typeof verdict).toBe("string");
    expect(verdict.length).toBeGreaterThan(0);
  });
});
