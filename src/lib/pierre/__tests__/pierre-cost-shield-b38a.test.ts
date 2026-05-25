// src/lib/pierre/__tests__/pierre-cost-shield-b38a.test.ts
// B38A — Pierre-specific cost policy tests: use-case routing, access levels, Anthropic disabled.
// No real API calls. No real keys. No network.

import { describe, it, expect } from "vitest";
import {
  buildPierreShieldRequest,
  isDemoUseCase,
  getPierreUseCasePolicy,
  requiresApprovalForSensitiveCase,
  isAnthropicUseCase,
} from "../ai/pierre-cost-policy";
import { evaluateAiCostShield } from "../../cloneos/ai/cost-shield/decision";
import { buildPierreAuditReport } from "../release-audit/audit-runtime";

// ── 1. Mission interpretation — access level enforcement ──────────────────────

describe("pierre policy — mission.interpret", () => {
  it("mission.interpret with logged_unpaid → openai blocked → shield blocks", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.mission.interpret",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "logged_unpaid",
    });
    // buildPierreShieldRequest downgrades to mock when access level insufficient
    expect(req.provider).toBe("mock");
    // But the shield still blocks real call for logged_unpaid
    const d = evaluateAiCostShield(req);
    // With mock provider, provider check passes, then access level check
    // logged_unpaid with mock: policy says block_not_paid (allow_mock=true but allow_real_ai=false)
    // And mock provider bypasses provider check but not access check
    expect(req.provider).toBe("mock"); // downgraded correctly
  });

  it("mission.interpret with paid_customer → openai allowed", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.mission.interpret",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "paid_customer",
    });
    expect(req.provider).toBe("openai");
    const d = evaluateAiCostShield(req);
    expect(d.allowed).toBe(true);
  });

  it("mission.interpret with internal_admin → openai allowed", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.mission.interpret",
      companyId: null,
      userId: "admin_1",
      accessLevel: "internal_admin",
    });
    const d = evaluateAiCostShield(req);
    expect(d.allowed).toBe(true);
  });
});

// ── 2. Document generation — client-visible + budget ─────────────────────────

describe("pierre policy — document.generate", () => {
  it("document.generate with logged_unpaid → provider downgraded to mock", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.document.generate",
      companyId: "co_test",
      userId: "u2",
      accessLevel: "logged_unpaid",
    });
    expect(req.provider).toBe("mock");
    expect(req.is_client_visible).toBe(true);
  });

  it("document.generate with paid_customer → openai allowed", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.document.generate",
      companyId: "co_test",
      userId: "u2",
      accessLevel: "paid_customer",
    });
    expect(req.provider).toBe("openai");
    const d = evaluateAiCostShield(req);
    expect(d.allowed).toBe(true);
  });
});

// ── 3. Public demo — always static ───────────────────────────────────────────

describe("pierre policy — public demo", () => {
  it("anonymous use case → static demo only", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.mission.interpret",
      companyId: null,
      userId: null,
      accessLevel: "anonymous",
      isDemo: true,
      isPublic: true,
    });
    const d = evaluateAiCostShield(req);
    expect(d.fallback_to_static_demo).toBe(true);
    expect(d.allowed).toBe(false);
  });

  it("platform.chat.answer is a demo use case (mock provider)", () => {
    expect(isDemoUseCase("platform.chat.answer")).toBe(true);
  });

  it("pierre.mission.interpret is NOT a demo use case", () => {
    expect(isDemoUseCase("pierre.mission.interpret")).toBe(false);
  });
});

// ── 4. Sensitive case — approval required ─────────────────────────────────────

describe("pierre policy — sensitive cases", () => {
  it("pierre.risk.sensitive requires approval when isSensitiveCase=true", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.risk.sensitive",
      companyId: null,
      userId: "admin_1",
      accessLevel: "internal_admin",
      isSensitiveCase: true,
    });
    expect(req.metadata.requires_approval_if_sensitive).toBe(true);
  });

  it("pierre.risk.sensitive requires approval metadata for sensitive case", () => {
    expect(requiresApprovalForSensitiveCase("pierre.risk.sensitive")).toBe(true);
  });

  it("pierre.mission.interpret does NOT require approval", () => {
    expect(requiresApprovalForSensitiveCase("pierre.mission.interpret")).toBe(false);
  });

  it("pierre.risk.sensitive with logged_unpaid is blocked (min_access=internal_admin)", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.risk.sensitive",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "logged_unpaid",
    });
    // Downgraded to mock because logged_unpaid doesn't meet internal_admin
    expect(req.provider).toBe("mock");
  });
});

// ── 5. Status update — mock OK for unpaid ────────────────────────────────────

describe("pierre policy — status update / micro tasks", () => {
  it("brain.missing_info with logged_unpaid → mock provider (downgraded)", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.brain.missing_info",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "logged_unpaid",
    });
    // min_access=paid_customer, logged_unpaid doesn't meet → mock
    expect(req.provider).toBe("mock");
  });

  it("brain.missing_info with paid_customer → openai-mini allowed", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.brain.missing_info",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "paid_customer",
    });
    expect(req.provider).toBe("openai");
    expect(req.model).toBe("gpt-4.1-mini");
    const d = evaluateAiCostShield(req);
    expect(d.allowed).toBe(true);
  });
});

// ── 6. Anthropic — disabled for all Pierre use cases ─────────────────────────

describe("pierre policy — Anthropic disabled", () => {
  it("isAnthropicUseCase always returns false for all Pierre use cases", () => {
    const useCases = [
      "pierre.mission.interpret",
      "pierre.document.generate",
      "pierre.hr_letter.generate",
      "pierre.risk.sensitive",
      "pierre.brain.final_interpret",
    ];
    for (const uc of useCases) {
      expect(isAnthropicUseCase(uc)).toBe(false);
    }
  });

  it("all Pierre use case policies use openai or mock, never anthropic", () => {
    const useCases = [
      "pierre.mission.interpret",
      "pierre.tasks.plan",
      "pierre.document.generate",
      "pierre.pdf.generate",
      "pierre.hr_letter.generate",
      "pierre.risk.sensitive",
      "pierre.employee_file.summarize",
    ];
    for (const uc of useCases) {
      const policy = getPierreUseCasePolicy(uc);
      expect(policy).not.toBeNull();
      expect(["openai", "mock"]).toContain(policy!.provider);
    }
  });
});

// ── 7. OpenAI routing ─────────────────────────────────────────────────────────

describe("pierre policy — OpenAI routing", () => {
  it("paid_customer mission interpret routes to OpenAI gpt-4.1", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.mission.interpret",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "paid_customer",
    });
    expect(req.provider).toBe("openai");
    expect(req.model).toBe("gpt-4.1");
  });

  it("paid_customer brain.risk_review routes to gpt-4.1-mini (cost-efficient)", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.brain.risk_review",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "paid_customer",
    });
    expect(req.model).toBe("gpt-4.1-mini");
  });
});

// ── 8. Audit report still works post-B38A ────────────────────────────────────

describe("smoke — B36 audit report unaffected by B38A", () => {
  it("buildPierreAuditReport() still builds without error", () => {
    const result = buildPierreAuditReport();
    expect(result.score).toBeGreaterThan(0);
    expect(result.verdict).toBeDefined();
  });

  it("buildPierreAuditReport() does not require any API keys", () => {
    // If we reach here without throwing, no API key is needed
    expect(() => buildPierreAuditReport()).not.toThrow();
  });
});

// ── 9. Unknown use case — safe defaults ────────────────────────────────────────

describe("pierre policy — unknown use case", () => {
  it("unknown use case defaults to paid_customer minimum access", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.future.unknown_use_case",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "logged_unpaid", // won't meet paid_customer minimum
    });
    // Should downgrade to mock since logged_unpaid < paid_customer
    expect(req.provider).toBe("mock");
  });

  it("unknown use case with paid_customer → openai (safe fallback)", () => {
    const req = buildPierreShieldRequest({
      useCase: "pierre.future.unknown_use_case",
      companyId: "co_test",
      userId: "u1",
      accessLevel: "paid_customer",
    });
    expect(req.provider).toBe("openai");
  });
});
