// src/lib/pierre/v1/__integration__/p86-next15-async-cookies.itest.ts
// PHASE 8.6 — Next.js 15 forbids synchronous dynamic-API access. Every `cookies()` call on the private
// paths is awaited, supabaseServer() is async, and its callers await it. This is what removes the
// "cookies() should be awaited" warnings seen during the E2E.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const supabaseServer = read("src/lib/supabase-server.ts");
const operationalAccess = read("src/lib/access/operational-access.ts");
const runtime = read("src/app/api/pierre/v1/_runtime.ts");

const callerFiles = [
  "src/lib/founder-access/admin-guard.ts",
  "src/app/agents/pierre/use/secure/[token]/route.ts",
  "src/app/api/founding-partners/registry-session/route.ts",
  "src/app/api/founding-partners/cockpit/route.ts",
  "src/app/api/founding-partners/attribution/capture/route.ts",
];

describe("P8.6 Next.js 15 — cookies() is always awaited on private paths", () => {
  it("supabaseServer is async and awaits cookies()", () => {
    expect(supabaseServer).toMatch(/export async function supabaseServer/);
    expect(supabaseServer).toMatch(/await cookies\(\)/);
    // no remaining synchronous cookies() access
    expect(supabaseServer).not.toMatch(/[^t]\s=\s*cookies\(\)\s*as/);
  });
  it("operational-access awaits cookies() and readDevStateOverride is async", () => {
    expect(operationalAccess).toMatch(/async function readDevStateOverride/);
    expect(operationalAccess).toMatch(/await cookies\(\)/);
    expect(operationalAccess).toMatch(/await readDevStateOverride\(\)/);
    expect(operationalAccess).toMatch(/await supabaseServer\(\)/);
    expect(operationalAccess).not.toMatch(/=\s*cookies\(\)\s*as unknown/);
  });
  it("the v1 runtime awaits supabaseServer() in both identity paths", () => {
    expect(runtime).toMatch(/await \(await supabaseServer\(\)\)\.auth\.getUser\(\)/);
    const calls = runtime.match(/await \(await supabaseServer\(\)\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(runtime).not.toMatch(/[^(]await supabaseServer\(\)\.auth/);
  });
  it("every supabaseServer() caller awaits it", () => {
    for (const f of callerFiles) {
      const src = read(f);
      // no un-awaited `= supabaseServer()` (the only allowed form is `await supabaseServer()`)
      expect(src, `${f} must await supabaseServer()`).not.toMatch(/=\s*supabaseServer\(\)/);
      expect(src).toMatch(/await supabaseServer\(\)/);
    }
  });
});
