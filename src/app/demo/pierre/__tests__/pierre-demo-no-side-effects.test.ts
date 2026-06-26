// PIERRE FINAL INTERACTIVE DEMO — no-side-effects safety scan.
// Scans every demo source file (lib + components + route) for forbidden calls.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DIRS = [
  "src/lib/pierre/demo",
  "src/components/pierre/demo",
  "src/app/demo/pierre",
];

function collect(): { file: string; src: string }[] {
  const out: { file: string; src: string }[] = [];
  for (const dir of DIRS) {
    const abs = join(ROOT, dir);
    let entries: string[] = [];
    try {
      entries = readdirSync(abs, { recursive: true }) as unknown as string[];
    } catch {
      continue;
    }
    for (const rel of entries) {
      const p = String(rel);
      if (!/\.(ts|tsx)$/.test(p)) continue;
      if (p.includes("__tests__")) continue;
      try {
        out.push({ file: join(dir, p), src: readFileSync(join(abs, p), "utf-8") });
      } catch {
        // directory entry — skip
      }
    }
  }
  return out;
}

const FILES = collect();
const ALL = FILES.map((f) => f.src).join("\n\n");

describe("pierre-demo — no forbidden side effects", () => {
  it("scans a non-trivial number of demo source files", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10);
  });

  it("no external AI API calls (OpenAI / Anthropic)", () => {
    expect(ALL).not.toMatch(/api\.openai\.com/i);
    expect(ALL).not.toMatch(/api\.anthropic\.com/i);
  });

  it("no Stripe live calls or live keys", () => {
    expect(ALL).not.toMatch(/api\.stripe\.com/i);
    expect(ALL).not.toMatch(/sk_live_/);
  });

  it("no Supabase write operations", () => {
    expect(ALL).not.toMatch(/\.from\([^)]*\)\.(insert|update|upsert|delete)/);
  });

  it("no external network fetch", () => {
    const nonComment = ALL.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(nonComment).not.toMatch(/fetch\s*\(\s*["']https?:\/\//);
  });

  it("does not import the real signature provider engine (B3 isolation)", () => {
    expect(ALL).not.toMatch(/signature-providers?\/yousign/);
    expect(ALL).not.toMatch(/from ["']@\/lib\/pierre\/v1\/signatures["']/);
  });

  it("does not import server-only DB / channel modules", () => {
    expect(ALL).not.toMatch(/from ["']pg["']/);
    expect(ALL).not.toMatch(/cloneos\/channels\/.*(send|resend)/i);
    expect(ALL).not.toMatch(/import\s+\{[^}]*\}\s+from ["'][^"']*supabase/);
  });

  it("does not read secrets from the environment", () => {
    expect(ALL).not.toMatch(/process\.env\.[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)/);
  });

  it("never claims a real email send or live signature inside the demo flow", () => {
    // The only allowed mentions are honest disclosures (truth registry); the
    // scenarios/components must not assert a real send happened.
    expect(ALL).not.toMatch(/email (?:réel )?envoyé\b(?!.*aucun)/i);
    expect(ALL).not.toMatch(/signature (?:externe )?live (?:validée|réalisée|effectuée)/i);
  });
});
