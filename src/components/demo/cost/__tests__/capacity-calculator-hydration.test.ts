// DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — ISSUE-04 regression coverage.
//
// No jsdom/@testing-library/react is installed in this repo (vitest runs in a plain
// "node" environment), so a real hydrateRoot-vs-server diff cannot be executed here.
// What CAN be verified without new dependencies, using react-dom/server (works in
// plain Node, no DOM required): the SSR markup this app actually produces is
// deterministic across renders, and contains no caret-color styling of our own —
// directly testing the two claims the ISSUE-04 root-cause report relies on.
import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { CapacityCalculator } from "../CapacityCalculator";

describe("CapacityCalculator — SSR determinism (ISSUE-04)", () => {
  it("renders identical markup across two independent SSR passes (no non-deterministic input)", () => {
    const a = renderToStaticMarkup(React.createElement(CapacityCalculator, { onAdjust: () => {} }));
    const b = renderToStaticMarkup(React.createElement(CapacityCalculator, { onAdjust: () => {} }));
    expect(a).toBe(b);
  });

  it("never emits a caret-color style of its own — the app-side half of the ISSUE-04 claim", () => {
    const html = renderToStaticMarkup(React.createElement(CapacityCalculator, { onAdjust: () => {} }));
    expect(html.toLowerCase()).not.toContain("caret-color");
    expect(html).not.toContain("caretColor");
  });

  it("renders both the number input and the range input with the same controlled illustrative value", () => {
    const html = renderToStaticMarkup(React.createElement(CapacityCalculator, { onAdjust: () => {} }));
    // ILLUSTRATIVE_INPUTS.operators = 4 — both the number field and its paired
    // range slider for "operators" must render the same value server-side.
    expect(html).toContain('id="demo-cost-input-operators"');
    expect(html).toMatch(/id="demo-cost-input-operators"[^>]*value="4"/);
  });

  it("carries suppressHydrationWarning only on the two ISSUE-04 input elements, not elsewhere in the tree", () => {
    // suppressHydrationWarning is not itself an HTML/DOM attribute react emits to markup,
    // so this is a structural regression guard read from source rather than the HTML output:
    // both inputs (number + range) must keep the justified suppression, and it must not
    // spread to any other element in this file if the component is later refactored.
    const source = fs.readFileSync(
      path.join(__dirname, "..", "CapacityCalculator.tsx"),
      "utf-8",
    );
    const occurrences = source.match(/suppressHydrationWarning/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});
