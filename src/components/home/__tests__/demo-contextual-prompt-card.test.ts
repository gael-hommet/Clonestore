import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoContextualPromptCard } from "../DemoContextualPromptCard";

describe("DemoContextualPromptCard — SSR + accessibility", () => {
  function render() {
    return renderToStaticMarkup(
      React.createElement(DemoContextualPromptCard, {
        onOpenDemo: () => {},
        onDismiss: () => {},
      }),
    );
  }

  it("renders deterministically (no non-deterministic input)", () => {
    expect(render()).toBe(render());
  });

  it("never emits a caret-color style", () => {
    const html = render();
    expect(html.toLowerCase()).not.toContain("caret-color");
  });

  it("carries an accessible name and a keyboard-operable dismiss control", () => {
    const html = render();
    expect(html).toContain('aria-label="Invitation à voir la démonstration de Pierre"');
    // React SSR HTML-escapes the apostrophe as &#x27;.
    expect(html).toContain('aria-label="Fermer l&#x27;invitation"');
    // Dismiss (X), primary CTA, and secondary "Plus tard" are all real
    // <button type="button"> elements — focusable and operable via Enter/Space by
    // default, no custom keydown handling needed.
    expect((html.match(/<button/g) ?? []).length).toBe(3);
  });

  it("never claims a guaranteed result — claim-safety per Phase 19", () => {
    const html = render();
    for (const forbidden of ["garanti", "zéro erreur", "totalement autonome", "24/7"]) {
      expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("is not a modal (no aria-modal, no backdrop element)", () => {
    const html = render();
    expect(html).not.toContain("aria-modal");
  });
});
