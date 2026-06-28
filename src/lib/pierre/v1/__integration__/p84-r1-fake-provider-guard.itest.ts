// PHASE 8.4-R1.15 — the Fake email provider is available ONLY under NODE_ENV=test (or explicit
// injection). Production throws (already). Development WITHOUT a live provider also THROWS — a "sent"
// email in development must be a REAL send, never a silent fake.
import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveEmailProvider } from "../communication-provider-config";

function setEnv(env: Record<string, string | undefined>) { for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v === undefined ? "" : v); }

describe("R1.15 Fake never available implicitly in development", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("NODE_ENV=test → the deterministic Fake", () => {
    setEnv({ NODE_ENV: "test", VITEST: "true", CLONESTORE_COMMUNICATION_PROVIDER: undefined, RESEND_API_KEY: undefined });
    expect(resolveEmailProvider().providerKey).toBe("fake_email");
  });

  it("NODE_ENV=development with NO live provider → throws (never an implicit fake)", () => {
    setEnv({ NODE_ENV: "development", VITEST: undefined, CLONESTORE_COMMUNICATION_PROVIDER: undefined, RESEND_API_KEY: undefined });
    expect(() => resolveEmailProvider()).toThrow(/no email provider|live provider|never an implicit/i);
  });

  it("NODE_ENV=production with NO live provider → throws", () => {
    setEnv({ NODE_ENV: "production", VITEST: undefined, CLONESTORE_COMMUNICATION_PROVIDER: undefined, RESEND_API_KEY: undefined });
    expect(() => resolveEmailProvider()).toThrow(/not configured|never available/i);
  });

  it("an explicitly injected provider is always honoured", () => {
    setEnv({ NODE_ENV: "development", VITEST: undefined });
    const injected = { providerKey: "injected" } as unknown as Parameters<typeof resolveEmailProvider>[0];
    expect(resolveEmailProvider(injected)!.providerKey).toBe("injected");
  });
});
