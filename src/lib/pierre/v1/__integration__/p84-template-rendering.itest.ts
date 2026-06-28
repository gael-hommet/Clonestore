// PHASE 8.4.8 — deterministic template rendering: plain text + safe HTML from one canonical
// representation, declared variables only, a deterministic content hash, and injection safety.
import { describe, it, expect } from "vitest";
import { renderCommunication } from "../communication-template-registry";
import { escapeHtml, assertDeclaredVariables, TemplateRenderError } from "../communication-renderer";

const BASE = "https://app.clonestore.test";

describe("P8.4.8 template rendering", () => {
  it("renders subject + plain text + safe html + in-app fields deterministically", () => {
    const a = renderCommunication({ templateKey: "document.ready_for_review", locale: "fr", variables: { object_label: "Contrat CDI", action_path: "/agents/pierre/use/secure/tok" }, publicBase: BASE });
    const b = renderCommunication({ templateKey: "document.ready_for_review", locale: "fr", variables: { object_label: "Contrat CDI", action_path: "/agents/pierre/use/secure/tok" }, publicBase: BASE });
    expect(a.rendered.content_hash).toBe(b.rendered.content_hash); // deterministic
    expect(a.rendered.subject).toContain("Contrat CDI");
    expect(a.rendered.plain_text.length).toBeGreaterThan(0);
    expect(a.rendered.safe_html).toMatch(/<!doctype html>/i);
    expect(a.rendered.in_app_title).toBeTruthy();
    expect(a.rendered.action_path).toBe(`${BASE}/agents/pierre/use/secure/tok`);
  });
  it("a different variable changes the content hash", () => {
    const a = renderCommunication({ templateKey: "document.ready_for_review", locale: "fr", variables: { object_label: "A", action_path: "/x" }, publicBase: BASE });
    const b = renderCommunication({ templateKey: "document.ready_for_review", locale: "fr", variables: { object_label: "B", action_path: "/x" }, publicBase: BASE });
    expect(a.rendered.content_hash).not.toBe(b.rendered.content_hash);
  });
  it("escapeHtml neutralises markup", () => {
    expect(escapeHtml(`<script>alert('x')</script>`)).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });
  it("declared-variable enforcement: unknown and missing variables are rejected", () => {
    expect(() => assertDeclaredVariables(["a"], { a: "1", b: "2" })).toThrow(/unknown template variable/i);
    expect(() => assertDeclaredVariables(["a", "b"], { a: "1" })).toThrow(/missing template variable/i);
    expect(() => assertDeclaredVariables(["a"], { a: "1" })).not.toThrow();
  });
  it("an unknown template is refused", () => {
    expect(() => renderCommunication({ templateKey: "does.not.exist", locale: "fr", variables: {}, publicBase: BASE })).toThrow(TemplateRenderError);
  });
});
