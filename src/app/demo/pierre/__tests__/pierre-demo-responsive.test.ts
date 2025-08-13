// PIERRE ZERO-SCROLL DEMO PLAYER — responsive design tests (source-level).
// The reusable primitives (drawer, buttons, breakpoints) are unchanged; the old
// "page uses grid-cols / sticky controls" assertions were replaced by the new
// zero-scroll player contract (100dvh root, bounded stage, own mobile composition).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const css = read("src/app/demo/pierre/pierre-demo.css");
function playerTree(): string {
  const dir = join(ROOT, "src/components/pierre/demo/player");
  const files = (readdirSync(dir, { recursive: true }) as unknown as string[]).filter((f) => /\.tsx?$/.test(String(f)) && !String(f).includes("__tests__"));
  return files.map((f) => read(join("src/components/pierre/demo/player", String(f)))).join("\n");
}
const TREE = playerTree();

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
  it("makes CTAs full-width on narrow screens", () => {
    expect(css).toMatch(/\.pd-btn-primary,\s*\.pd-btn-secondary\s*\{\s*width:\s*100%/);
  });
});

describe("pierre-demo responsive — zero-scroll player", () => {
  it("root player is exactly one viewport (100dvh, overflow hidden, flex column)", () => {
    expect(css).toMatch(/\.pdp-root\b[\s\S]*height:\s*100dvh/);
    expect(css).toMatch(/\.pdp-root\b[\s\S]*overflow:\s*hidden/);
  });
  it("the chrome is a fixed-height flex child; the stage is a bounded scroll-free area", () => {
    expect(css).toMatch(/\.pdp-chrome\b[\s\S]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.pdp-stage\b[\s\S]*min-height:\s*0/);
    expect(css).toMatch(/\.pdp-stage\b[\s\S]*overflow:\s*hidden/);
  });
  it("mobile is its own composition, not a squished desktop grid", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
    // very short viewports (landscape phones / 1280×720) get their own tightening
    expect(css).toMatch(/@media\s*\(max-height:\s*6\d\dpx\)/);
  });
  it("does not rely on a horizontal-scrolling table layout", () => {
    expect(TREE).not.toMatch(/<table/);
  });
});
