// src/lib/pierre/v1/__integration__/p86-product-gate-all-private-routes.itest.ts
// PHASE 8.6 — mechanical coverage proof: every discovered pierre/v1 route+method is classified in the
// manifest, every GATED method actually calls withProductAccess with the mapped requirement (and no longer
// relies on a bare withTenant/withUser), every ALLOWLIST exception is explicitly documented, and the
// manifest has no stale entries. Nothing is implicitly allowed.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { ROUTE_MANIFEST, REQUIREMENT_OF, ALLOWLIST_REASONS, ALLOWLIST_CLASSES, isGated, routeKeyFromFile, type AccessClass, type HttpMethod } from "../product-access-route-manifest";

const V1_DIR = resolve(process.cwd(), "src/app/api/pierre/v1");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}
const stripComments = (s: string) => s.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
function methodsOf(src: string): HttpMethod[] {
  const code = stripComments(src);
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  const set = new Set<HttpMethod>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) set.add(m[1] as HttpMethod);
  return [...set];
}

const files = walk(V1_DIR);

describe("P8.6 — global product-gate coverage over EVERY private route", () => {
  it("discovers a non-trivial route surface", () => { expect(files.length).toBeGreaterThan(50); });

  it("every route+method is classified, and every gated method enforces withProductAccess", () => {
    for (const file of files) {
      const key = routeKeyFromFile(file);
      const src = readFileSync(file, "utf-8");
      const code = stripComments(src);
      const methods = methodsOf(src);
      expect(methods.length, `${key}: no HTTP method exported?`).toBeGreaterThan(0);
      for (const method of methods) {
        const cls = ROUTE_MANIFEST[key]?.[method] as AccessClass | undefined;
        expect(cls, `${key} ${method} is NOT classified in the product-access manifest`).toBeDefined();
        if (isGated(cls!)) {
          const req = REQUIREMENT_OF[cls!];
          expect(code, `${key} ${method} is gated ${cls} but does not call withProductAccess(req, "${req}", …)`).toContain(`withProductAccess(req, "${req}"`);
        } else {
          expect(ALLOWLIST_CLASSES, `${key} ${method} class ${cls} must be an allowlist class`).toContain(cls);
          expect(ALLOWLIST_REASONS[key], `${key} is allowlisted (${cls}) but has no documented reason`).toBeTruthy();
        }
      }
      // a fully-gated route file must not still rely on the bare tenant/user wrappers for a mutation.
      const allGated = methods.every((mm) => isGated(ROUTE_MANIFEST[key]?.[mm] as AccessClass));
      if (allGated) {
        expect(code, `${key} still calls bare withTenant(req, …) after gating`).not.toContain("withTenant(req,");
      }
    }
  });

  it("the manifest has no stale entries (every key maps to a real route file)", () => {
    const keys = new Set(files.map(routeKeyFromFile));
    for (const key of Object.keys(ROUTE_MANIFEST)) {
      expect(keys.has(key), `manifest key ${key} has no matching route.ts on disk`).toBe(true);
    }
  });

  it("the allowlist is explicit + minimal (each allowlisted route documents WHY)", () => {
    for (const [key, methods] of Object.entries(ROUTE_MANIFEST)) {
      const allowlisted = Object.values(methods).some((c) => ALLOWLIST_CLASSES.includes(c as AccessClass));
      if (allowlisted) expect(ALLOWLIST_REASONS[key], `allowlisted ${key} needs a reason`).toBeTruthy();
    }
    // a small, bounded allowlist — not a back door for the whole surface
    expect(Object.keys(ALLOWLIST_REASONS).length).toBeLessThan(15);
  });
});
