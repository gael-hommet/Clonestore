import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PierreModes } from "../PierreModes";
import { PUBLIC_AUTONOMY_MODES, AUTONOMY_HARD_FLOOR } from "@/lib/demo/presentation/autonomy-modes";

describe("PierreModes — SSR determinism, structure, hard floor", () => {
  function render() {
    return renderToStaticMarkup(React.createElement(PierreModes, {}));
  }

  it("renders deterministically (no non-deterministic input)", () => {
    expect(render()).toBe(render());
  });

  it("renders exactly one radio button per public autonomy mode, in a radiogroup", () => {
    const html = render();
    expect(html).toContain('role="radiogroup"');
    expect((html.match(/role="radio"/g) ?? []).length).toBe(PUBLIC_AUTONOMY_MODES.length);
  });

  it("always renders the inviolable hard floor sentence, regardless of the selected mode", () => {
    const html = render();
    expect(html).toContain(AUTONOMY_HARD_FLOOR);
  });

  it("never claims a guaranteed or fully autonomous result", () => {
    const html = render();
    for (const forbidden of ["garanti", "zéro erreur", "totalement autonome"]) {
      expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
