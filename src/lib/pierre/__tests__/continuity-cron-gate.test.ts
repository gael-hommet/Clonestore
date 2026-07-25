import { describe, it, expect } from "vitest";
import {
  decideContinuityCron,
  isContinuityCronEnabled,
  continuityCronSecrets,
} from "../continuity/cron-gate";

function headers(map: Record<string, string>) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

describe("continuity cron gate — fail-closed on two axes (P21)", () => {
  it("is disabled by default (owner opt-in flag off)", () => {
    expect(isContinuityCronEnabled({})).toBe(false);
    const d = decideContinuityCron(headers({ authorization: "Bearer whatever" }), {});
    expect(d.action).toBe("disabled");
  });

  it("refuses fail-open when enabled but no secret is configured", () => {
    const d = decideContinuityCron(headers({ authorization: "Bearer x" }), {
      PIERRE_CONTINUITY_CRON_ENABLED: "true",
    });
    expect(d.action).toBe("unconfigured");
  });

  it("rejects a request with a missing or wrong secret", () => {
    const env = { PIERRE_CONTINUITY_CRON_ENABLED: "true", CRON_SECRET: "s3cr3t" };
    expect(decideContinuityCron(headers({}), env).action).toBe("unauthorized");
    expect(
      decideContinuityCron(headers({ authorization: "Bearer nope" }), env).action,
    ).toBe("unauthorized");
  });

  it("authorizes only when enabled AND the correct secret is presented", () => {
    const env = { PIERRE_CONTINUITY_CRON_ENABLED: "true", CRON_SECRET: "s3cr3t" };
    expect(continuityCronSecrets(env)).toContain("s3cr3t");
    expect(
      decideContinuityCron(headers({ authorization: "Bearer s3cr3t" }), env).action,
    ).toBe("run");
    // also accepts the dedicated runtime secret via x-pierre-system-secret
    const env2 = { PIERRE_CONTINUITY_CRON_ENABLED: "true", PIERRE_RUNTIME_SYSTEM_SECRET: "runtime" };
    expect(
      decideContinuityCron(headers({ "x-pierre-system-secret": "runtime" }), env2).action,
    ).toBe("run");
  });
});
