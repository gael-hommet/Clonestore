// PIERRE FINAL INTERACTIVE DEMO — responsive design tests (source-level).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const css = read("src/app/demo/pierre/pierre-demo.css");
const page = read("src/app/demo/pierre/page.tsx");

describe("pierre-demo responsive — CSS", () => {
  it("defines mobile-first breakpoints", () => {
    const mins = [...css.matchAll(/min-width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(mins.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...mins)).toBeLessThanOrEqual(640);
  });
  it("handles small screens explicitly (≤ 560px)", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*5\d\dpx\)/);
  });
  it("makes the drawer full-height/width on mobile", () => {
    expect(css).toMatch(/\.pd-drawer/);
    expect(css).toMatch(/border-top-left-radius/);
  });
  it("keeps primary controls sticky and reachable", () => {
    expect(css).toMatch(/\.pd-controls[\s\S]*position:\s*sticky/);
  });
  it("makes CTAs full-width on narrow screens", () => {
    expect(css).toMatch(/\.pd-btn-primary,\s*\.pd-btn-secondary\s*\{\s*width:\s*100%/);
  });
});

describe("pierre-demo responsive — page", () => {
  it("uses a responsive grid that collapses on mobile", () => {
    expect(page).toMatch(/grid-cols-1/);
    expect(page).toMatch(/\bsm:|md:/);
  });
  it("does not rely on a horizontal-scrolling table layout", () => {
    expect(page).not.toMatch(/<table/);
  });
});
