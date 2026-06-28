// PHASE 8.4-R1.2 — the dispatch trigger is a SYSTEM operation. An ordinary request (no system secret)
// is refused; only a request presenting the constant-time-verified secret is accepted. The secret is
// read from the env (PIERRE_COMMUNICATION_SYSTEM_SECRET, falling back to CRON_SECRET).
import { describe, it, expect, afterEach, vi } from "vitest";
import { communicationSystemSecret, verifyCommunicationSystemRequest } from "../communication-system-auth";

const reqWith = (headers: Record<string, string>) => new Request("http://x/api/pierre/v1/communications/dispatch", { method: "POST", headers });

describe("R1.2 dispatch trigger system-secret gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("a request with NO secret is refused", () => {
    expect(verifyCommunicationSystemRequest(reqWith({}), "s3cr3t")).toBe(false);
  });

  it("a request with the WRONG secret is refused", () => {
    expect(verifyCommunicationSystemRequest(reqWith({ authorization: "Bearer nope" }), "s3cr3t")).toBe(false);
  });

  it("a request with the correct Bearer secret is accepted", () => {
    expect(verifyCommunicationSystemRequest(reqWith({ authorization: "Bearer s3cr3t" }), "s3cr3t")).toBe(true);
  });

  it("a request with the correct x-pierre-system-secret header is accepted", () => {
    expect(verifyCommunicationSystemRequest(reqWith({ "x-pierre-system-secret": "s3cr3t" }), "s3cr3t")).toBe(true);
  });

  it("the system secret is read from the env (with a CRON_SECRET fallback)", () => {
    vi.stubEnv("PIERRE_COMMUNICATION_SYSTEM_SECRET", "");
    vi.stubEnv("CRON_SECRET", "cron-x");
    expect(communicationSystemSecret()).toBe("cron-x");
    vi.stubEnv("PIERRE_COMMUNICATION_SYSTEM_SECRET", "primary");
    expect(communicationSystemSecret()).toBe("primary");
  });
});
