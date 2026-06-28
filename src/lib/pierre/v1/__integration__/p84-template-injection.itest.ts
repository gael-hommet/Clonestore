// PHASE 8.4.8 — a template can NEVER inject HTML. Variable content is escaped at the HTML boundary;
// an action path must be app-relative or an https URL on the configured host (no javascript:, no
// cross-host); the plain-text path carries the raw value but the HTML path is always escaped.
import { describe, it, expect } from "vitest";
import { renderCommunication } from "../communication-template-registry";
import { TemplateRenderError } from "../communication-renderer";

const BASE = "https://app.clonestore.test";

describe("P8.4.8 template injection safety", () => {
  it("HTML in a variable is escaped in safe_html (no raw markup)", () => {
    const r = renderCommunication({ templateKey: "document.approved", locale: "fr", variables: { object_label: `<img src=x onerror=alert(1)>`, action_path: "/x" }, publicBase: BASE });
    expect(r.rendered.safe_html).not.toMatch(/<img/i);
    expect(r.rendered.safe_html).toContain("&lt;img");
  });
  it("a javascript: action path is refused", () => {
    expect(() => renderCommunication({ templateKey: "document.approved", locale: "fr", variables: { object_label: "X", action_path: "javascript:alert(1)" }, publicBase: BASE })).toThrow(TemplateRenderError);
  });
  it("a cross-host https action url is refused", () => {
    expect(() => renderCommunication({ templateKey: "document.approved", locale: "fr", variables: { object_label: "X", action_path: "https://evil.example.com/steal" }, publicBase: BASE })).toThrow(/host not allowed|invalid/i);
  });
  it("a protocol-relative // url is refused (treated as non-app-relative)", () => {
    expect(() => renderCommunication({ templateKey: "document.approved", locale: "fr", variables: { object_label: "X", action_path: "//evil.example.com" }, publicBase: BASE })).toThrow(TemplateRenderError);
  });
  it("an app-relative path on the configured host is accepted and absolutised", () => {
    const r = renderCommunication({ templateKey: "document.approved", locale: "fr", variables: { object_label: "X", action_path: "/agents/pierre/use" }, publicBase: BASE });
    expect(r.rendered.action_path).toBe(`${BASE}/agents/pierre/use`);
    expect(r.rendered.safe_html).toContain(`href="${BASE}/agents/pierre/use"`);
  });
});
