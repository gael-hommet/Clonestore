// src/lib/pierre/v1/communication-renderer.ts
// PHASE 8.4.8 — deterministic, injection-safe communication rendering. Plain text and HTML are
// produced from ONE canonical business representation; every variable is HTML-escaped at the HTML
// boundary (no raw user HTML is ever interpolated). Only declared variables are allowed; an unknown
// or missing variable BLOCKS the render. A deterministic content_hash participates in idempotency.

import { createHash } from "crypto";

export class TemplateRenderError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = "TemplateRenderError"; }
}

export type RenderedCommunication = {
  subject: string;
  plain_text: string;
  safe_html: string;
  in_app_title: string;
  in_app_body: string;
  action_label: string | null;
  action_path: string | null;
  content_hash: string;
};

// The canonical, structured output a template builder returns (NO html — the renderer escapes).
export type TemplateOutput = {
  subject: string;
  greeting?: string;
  paragraphs: string[];
  action?: { label: string; path: string } | null;
  in_app_title: string;
  in_app_body: string;
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// An action path must be an app-relative path or an https URL on the configured public host.
function safeActionHref(path: string, publicBase: string | null): string {
  const p = String(path).trim();
  if (p.startsWith("/") && !p.startsWith("//")) {
    if (publicBase) return publicBase.replace(/\/$/, "") + p;
    return p;
  }
  if (/^https:\/\//i.test(p)) {
    if (publicBase) {
      try { const host = new URL(publicBase).host; if (new URL(p).host !== host) throw new TemplateRenderError("action url host not allowed", "bad_action_url"); } catch { throw new TemplateRenderError("action url invalid", "bad_action_url"); }
    }
    return p;
  }
  throw new TemplateRenderError("action path must be app-relative or an https url", "bad_action_url");
}

/** Build the rendered communication from a structured template output, escaping at the HTML boundary. */
export function renderFromTemplateOutput(input: {
  templateKey: string; templateVersion: string; locale: string; out: TemplateOutput; publicBase: string | null;
}): RenderedCommunication {
  const { out } = input;
  const plainLines: string[] = [];
  if (out.greeting) plainLines.push(out.greeting, "");
  for (const para of out.paragraphs) plainLines.push(para, "");
  const actionPath = out.action ? safeActionHref(out.action.path, input.publicBase) : null;
  if (out.action && actionPath) plainLines.push(`${out.action.label}: ${actionPath}`);
  const plain_text = plainLines.join("\n").trim();

  const htmlParas = out.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const greetingHtml = out.greeting ? `<p>${escapeHtml(out.greeting)}</p>` : "";
  const actionHtml = out.action && actionPath ? `<p><a href="${escapeHtml(actionPath)}">${escapeHtml(out.action.label)}</a></p>` : "";
  const safe_html = `<!doctype html><html><body>${greetingHtml}${htmlParas}${actionHtml}<hr><p>CloneStore — Pierre</p></body></html>`;

  const subject = String(out.subject).replace(/[\r\n]+/g, " ").trim();
  const content_hash = createHash("sha256").update(JSON.stringify([
    input.templateKey, input.templateVersion, input.locale, subject, plain_text, safe_html, out.in_app_title, out.in_app_body, actionPath,
  ])).digest("hex");

  return {
    subject, plain_text, safe_html,
    in_app_title: out.in_app_title, in_app_body: out.in_app_body,
    action_label: out.action ? out.action.label : null,
    action_path: actionPath,
    content_hash,
  };
}

/** Validate that the supplied variables EXACTLY match the declared set (no unknown, no missing). */
export function assertDeclaredVariables(declared: readonly string[], supplied: Record<string, string>): void {
  const declaredSet = new Set(declared);
  for (const k of Object.keys(supplied)) if (!declaredSet.has(k)) throw new TemplateRenderError(`unknown template variable: ${k}`, "unknown_variable");
  for (const d of declared) if (supplied[d] === undefined || supplied[d] === null) throw new TemplateRenderError(`missing template variable: ${d}`, "missing_variable");
}
