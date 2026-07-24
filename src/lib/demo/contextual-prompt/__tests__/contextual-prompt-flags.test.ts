import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isDemoContextualPromptEnabled } from "../contextual-prompt-flags";
import { DEMO_PROMPT_ENV_KEY } from "../constants";

describe("isDemoContextualPromptEnabled — revealed-by-default rule does NOT apply here (opt-in, closed by default)", () => {
  const original = process.env[DEMO_PROMPT_ENV_KEY];

  beforeEach(() => {
    delete process.env[DEMO_PROMPT_ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[DEMO_PROMPT_ENV_KEY];
    else process.env[DEMO_PROMPT_ENV_KEY] = original;
  });

  it("defaults to false when the env var is absent — never hardcode true for an unvalidated UX feature", () => {
    expect(isDemoContextualPromptEnabled()).toBe(false);
  });

  it("is false for any value other than the exact string \"true\"", () => {
    for (const v of ["1", "TRUE", "yes", "on", ""]) {
      process.env[DEMO_PROMPT_ENV_KEY] = v;
      expect(isDemoContextualPromptEnabled()).toBe(false);
    }
  });

  it("is true only for the exact string \"true\"", () => {
    process.env[DEMO_PROMPT_ENV_KEY] = "true";
    expect(isDemoContextualPromptEnabled()).toBe(true);
  });
});
