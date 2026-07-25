import { describe, it, expect } from "vitest";
import {
  toCanonicalTaskStatus,
  requiredIntegrationForTaskType,
  resolveIntegrationAvailability,
  integrationStatusForTask,
  CANONICAL_FAILURE_STATUSES,
  type CanonicalPierreTaskStatus,
} from "../tasks/canonical-status";

describe("toCanonicalTaskStatus — internal outcome → canonical taxonomy (P21)", () => {
  it("maps a successful outcome to COMPLETED", () => {
    expect(toCanonicalTaskStatus({ ok: true, status: "completed" })).toBe("COMPLETED");
  });

  it("maps every mandated failure status via a real reachable input", () => {
    const cases: Array<[Parameters<typeof toCanonicalTaskStatus>[0], CanonicalPierreTaskStatus]> = [
      [{ ok: false, status: "blocked", error_code: "HR_BLOCKED_ACTION" }, "BLOCKED"],
      [{ ok: false, status: "awaiting_info", error_code: "MISSING_INFO" }, "NEEDS_INFORMATION"],
      [{ ok: false, status: "awaiting_approval", error_code: "APPROVAL_REQUIRED" }, "NEEDS_HUMAN_VALIDATION"],
      [{ ok: false, status: "failed", error_code: "PERMISSION_DENIED" }, "PERMISSION_DENIED"],
      [{ ok: false, status: "failed", error_code: "UNSUPPORTED_TASK" }, "UNSUPPORTED"],
      [{ ok: false, status: "failed", error_code: "PROVIDER_UNAVAILABLE" }, "PROVIDER_UNAVAILABLE"],
      [{ ok: false, status: "failed", error_code: "INTEGRATION_UNAVAILABLE" }, "INTEGRATION_UNAVAILABLE"],
      [{ ok: false, status: "failed", error_code: "EXECUTION_ERROR" }, "FAILED"],
      [{ ok: false, status: "retry", retry_scheduled: true }, "RETRY_SCHEDULED"],
    ];
    for (const [input, expected] of cases) {
      expect(toCanonicalTaskStatus(input)).toBe(expected);
    }
    // Every mandated failure status must be produced by at least one case above.
    const produced = new Set(cases.map(([, e]) => e));
    for (const status of CANONICAL_FAILURE_STATUSES) {
      expect(produced.has(status)).toBe(true);
    }
  });

  it("integration signal wins over a generic completed for a send with no provider", () => {
    expect(
      toCanonicalTaskStatus({ ok: true, status: "completed", integration: "INTEGRATION_UNAVAILABLE" }),
    ).toBe("INTEGRATION_UNAVAILABLE");
  });
});

describe("integration availability — never simulate a send (P21)", () => {
  it("maps send/sync task types to their integration kind, drafts to none", () => {
    expect(requiredIntegrationForTaskType("email.send")).toBe("email");
    expect(requiredIntegrationForTaskType("hris.sync")).toBe("hris");
    expect(requiredIntegrationForTaskType("signature.request")).toBe("signature");
    expect(requiredIntegrationForTaskType("email.draft")).toBeNull();
    expect(requiredIntegrationForTaskType("doc.generate")).toBeNull();
  });

  it("reports INTEGRATION_UNAVAILABLE when the email provider is not configured", () => {
    const availability = resolveIntegrationAvailability("email", {});
    expect(availability.available).toBe(false);
    expect(availability.canonical).toBe("INTEGRATION_UNAVAILABLE");
    expect(availability.missing).toContain("RESEND_API_KEY");
  });

  it("reports available when the email provider IS configured", () => {
    const availability = resolveIntegrationAvailability("email", {
      RESEND_API_KEY: "re_test_key",
      EMAIL_PROVIDER: "resend",
    });
    expect(availability.available).toBe(true);
    expect(availability.canonical).toBeNull();
  });

  it("integrationStatusForTask surfaces the gap only for send/sync with a missing provider", () => {
    // Draft task: no integration required → no signal even with empty env.
    expect(integrationStatusForTask("doc.generate", {})).toBeNull();
    // Send task, provider missing → surfaced.
    const signal = integrationStatusForTask("email.send", {});
    expect(signal?.canonical).toBe("INTEGRATION_UNAVAILABLE");
    // Send task, provider present → not surfaced (would really send).
    expect(
      integrationStatusForTask("email.send", { RESEND_API_KEY: "k", EMAIL_PROVIDER: "resend" }),
    ).toBeNull();
  });
});
