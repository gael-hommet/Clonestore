// PIERRE ZERO-SCROLL DEMO PLAYER — accessibility tests (source-level guarantees).
// The a11y protections are unchanged; the assertions that pointed at the old
// <PierreDemoExperience/> now point at the player tree (which owns the progressbar,
// the reduced-motion preference and the landmark semantics).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const css = read("src/app/demo/pierre/pierre-demo.css");
const usePlayer = read("src/components/pierre/demo/player/usePlayer.ts");
const drawer = read("src/components/pierre/demo/DemoDrawer.tsx");
const parts = read("src/components/pierre/demo/parts.tsx");

function componentSources(dir: string): string {
  const abs = join(ROOT, dir);
  const files = (readdirSync(abs, { recursive: true }) as unknown as string[]).filter((f) => /\.tsx?$/.test(String(f)) && !String(f).includes("__tests__"));
  return files.map((f) => read(join(dir, String(f)))).join("\n");
}
const ALL = componentSources("src/components/pierre/demo");
const PLAYER = componentSources("src/components/pierre/demo/player");

describe("pierre-demo a11y — motion & focus", () => {
  it("respects prefers-reduced-motion in CSS", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)/);
  });
  it("the player reads the reduced-motion preference", () => {
    expect(usePlayer).toMatch(/prefers-reduced-motion/);
    expect(usePlayer).toMatch(/reducedMotion/);
  });
  it("provides a visible focus style", () => {
    expect(css).toMatch(/:focus-visible/);
  });
});

describe("pierre-demo a11y — semantics", () => {
  it("the chrome progress is an ARIA progressbar", () => {
    expect(PLAYER).toMatch(/role="progressbar"/);
    expect(PLAYER).toMatch(/aria-valuenow/);
  });
  it("the drawer is a labelled modal dialog with Escape support", () => {
    expect(drawer).toMatch(/role="dialog"/);
    expect(drawer).toMatch(/aria-modal="true"/);
    expect(drawer).toMatch(/aria-label/);
    expect(drawer).toMatch(/Escape/);
  });
  it("the level-2 overlays are labelled modal dialogs with Escape support", () => {
    const overlay = read("src/components/pierre/demo/player/PlayerOverlay.tsx");
    expect(overlay).toMatch(/role="dialog"/);
    expect(overlay).toMatch(/aria-modal="true"/);
    expect(overlay).toMatch(/aria-label/);
    expect(overlay).toMatch(/Escape/);
  });
  it("icon-only controls carry aria-label or accessible text", () => {
    expect(PLAYER).toMatch(/aria-label=/);
    expect(drawer).toMatch(/aria-label="Fermer"/);
  });
  it("status is conveyed by icon + text, not color alone", () => {
    expect(parts).toMatch(/StatusMark/);
    expect(parts).toMatch(/\{label\}/);
  });
  it("decorative icons are hidden from assistive tech", () => {
    expect(ALL).toMatch(/aria-hidden/);
  });
  it("uses landmark/section semantics rather than div soup", () => {
    expect(PLAYER).toMatch(/<header|<section|<main|<footer/);
  });
});
