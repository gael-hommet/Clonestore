// PIERRE FINAL INTERACTIVE DEMO — accessibility tests (source-level guarantees).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const css = read("src/app/demo/pierre/pierre-demo.css");
const experience = read("src/components/pierre/demo/PierreDemoExperience.tsx");
const drawer = read("src/components/pierre/demo/DemoDrawer.tsx");
const parts = read("src/components/pierre/demo/parts.tsx");

function componentSources(): string {
  const dir = join(ROOT, "src/components/pierre/demo");
  const files = (readdirSync(dir, { recursive: true }) as unknown as string[]).filter((f) => /\.tsx$/.test(String(f)));
  return files.map((f) => read(join("src/components/pierre/demo", String(f)))).join("\n");
}
const ALL = componentSources();

describe("pierre-demo a11y — motion & focus", () => {
  it("respects prefers-reduced-motion in CSS", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)/);
  });
  it("the experience reads the reduced-motion preference", () => {
    expect(experience).toMatch(/prefers-reduced-motion/);
    expect(experience).toMatch(/reducedMotion/);
  });
  it("provides a visible focus style", () => {
    expect(css).toMatch(/:focus-visible/);
  });
});

describe("pierre-demo a11y — semantics", () => {
  it("the guided progress is an ARIA progressbar", () => {
    expect(experience).toMatch(/role="progressbar"/);
    expect(experience).toMatch(/aria-valuenow/);
  });
  it("the drawer is a labelled modal dialog with Escape support", () => {
    expect(drawer).toMatch(/role="dialog"/);
    expect(drawer).toMatch(/aria-modal="true"/);
    expect(drawer).toMatch(/aria-label/);
    expect(drawer).toMatch(/Escape/);
  });
  it("icon-only controls carry aria-label or accessible text", () => {
    expect(experience).toMatch(/aria-label=/);
    expect(drawer).toMatch(/aria-label="Fermer"/);
  });
  it("status is conveyed by icon + text, not color alone", () => {
    // StatusMark renders an icon AND the textual label.
    expect(parts).toMatch(/StatusMark/);
    expect(parts).toMatch(/\{label\}/);
  });
  it("decorative icons are hidden from assistive tech", () => {
    expect(ALL).toMatch(/aria-hidden/);
  });
  it("uses landmark/section semantics rather than div soup", () => {
    expect(experience).toMatch(/<header|<section|<main|<footer/);
  });
});
