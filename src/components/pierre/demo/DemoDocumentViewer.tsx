"use client";

// PIERRE FINAL INTERACTIVE DEMO — premium document viewer.
// Renders a structured DemoDocument (no free-form HTML, no lorem ipsum).

import { FileText, AlertTriangle } from "lucide-react";
import type { DemoDocument } from "@/lib/pierre/demo";

export function DemoDocumentViewer({ doc }: { doc: DemoDocument }) {
  return (
    <article className="pd-doc" data-testid="demo-document" data-doc-id={doc.id}>
      <div className="pd-doc__head">
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <FileText className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} />
          <h3 className="pd-h2" style={{ fontSize: "1.05rem" }}>{doc.title}</h3>
          <span className="pd-chip pd-chip--warn" style={{ marginLeft: "auto" }}>{doc.badge}</span>
        </div>
        {doc.subtitle ? (
          <p className="pd-lede" style={{ marginTop: 6, fontSize: "0.82rem" }}>{doc.subtitle}</p>
        ) : null}
      </div>

      <div className="pd-doc__body">
        {doc.blocks.map((block, i) => {
          if (block.kind === "heading") return <h4 key={i}>{block.text}</h4>;
          if (block.kind === "paragraph") return <p key={i} style={{ margin: "8px 0" }}>{block.text}</p>;
          if (block.kind === "list")
            return (
              <ul key={i}>
                {block.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            );
          // meta
          return (
            <dl key={i} className="pd-doc__meta">
              {block.rows.map((r, j) => (
                <div key={j} className="pd-doc__meta-row">
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          );
        })}

        <div
          className="pd-card"
          style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, padding: "10px 12px", borderColor: "var(--pd-warn-soft)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-warn)", marginTop: 2, flex: "none" }} />
          <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--pd-ink-3)" }}>{doc.disclosure}</p>
        </div>
      </div>
    </article>
  );
}
