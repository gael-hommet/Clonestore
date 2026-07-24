import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CineScene, CineEyebrow, CineTitle, CineLede, BigStat, Disclosure, ChainRow } from "../cine";

describe("cine primitives — SSR determinism and structure", () => {
  function render(el: React.ReactElement) {
    return renderToStaticMarkup(el);
  }

  it("CineScene renders its children deterministically", () => {
    const el = React.createElement(CineScene, {}, "contenu");
    expect(render(el)).toBe(render(el));
    expect(render(el)).toContain("contenu");
  });

  it("CineTitle defaults to an <h2> and honors an explicit heading level", () => {
    const h2 = render(React.createElement(CineTitle, {}, "Titre"));
    expect(h2).toContain("<h2");
    const h1 = render(React.createElement(CineTitle, { as: "h1" }, "Titre"));
    expect(h1).toContain("<h1");
  });

  it("BigStat renders the value and, when provided, the unit and label", () => {
    const html = render(React.createElement(BigStat, { value: "42", unit: "min", label: "libellé" }));
    expect(html).toContain("42");
    expect(html).toContain("min");
    expect(html).toContain("libellé");
  });

  it("Disclosure renders a real <details>/<summary> pair, collapsed by default", () => {
    const html = render(React.createElement(Disclosure, { summary: "Résumé" }, "Détail"));
    expect(html).toContain("<details");
    expect(html).not.toContain("open=\"\"");
    expect(html).toContain("<summary");
  });

  it("CineEyebrow and CineLede and ChainRow render without crashing", () => {
    expect(() => render(React.createElement(CineEyebrow, {}, "Étape 1"))).not.toThrow();
    expect(() => render(React.createElement(CineLede, {}, "détail court"))).not.toThrow();
    expect(() => render(React.createElement(ChainRow, {}, "ligne"))).not.toThrow();
  });
});
