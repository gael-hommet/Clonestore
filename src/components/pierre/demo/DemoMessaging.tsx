"use client";

// PIERRE FINAL INTERACTIVE DEMO — premium messaging proof.
// Pierre communicates and asks for validation. Messages are browsable; document
// actions open the real (demo) document.

import { FileText } from "lucide-react";
import type { DemoMessage, DemoScenario } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

function MessageBubble({
  message,
  onOpenDocument,
}: {
  message: DemoMessage;
  onOpenDocument: (docId: string) => void;
}) {
  return (
    <div className="pd-msg" data-testid="demo-message" data-message-id={message.id}>
      <div className="pd-msg__who">
        <span className="pd-msg__avatar" aria-hidden>P</span>
        <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>Pierre</span>
      </div>
      {message.title ? (
        <p style={{ margin: "0 0 4px", fontWeight: 650, color: "var(--pd-ink-1)" }}>{message.title}</p>
      ) : null}
      {message.lines.map((l, i) => (
        <p key={i} style={{ margin: "3px 0", fontSize: "0.86rem", color: "var(--pd-ink-2)", lineHeight: 1.55 }}>
          {l}
        </p>
      ))}
      {message.actions && message.actions.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {message.actions
            .filter((a) => a.kind === "view_document")
            .map((a) => (
              <button
                key={a.id}
                type="button"
                className="pd-btn pd-btn-secondary"
                style={{ minHeight: 38 }}
                onClick={() => a.documentId && onOpenDocument(a.documentId)}
                data-step-id={`open-doc:${a.documentId}`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {a.label}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function DemoMessaging({
  scenario,
  onOpenDocument,
}: {
  scenario: DemoScenario;
  onOpenDocument: (docId: string) => void;
}) {
  return (
    <section data-testid="demo-messaging" data-conversion-demo-cockpit>
      <StepHeading
        eyebrow="Messagerie"
        title="Pierre communique — et demande les validations utiles."
        caption="Des messages clairs, des documents joints, et jamais d'envoi réel sans votre accord."
      />
      <div className="pd-stagger" style={{ display: "grid", gap: 10 }}>
        {scenario.messages.map((m) => (
          <MessageBubble key={m.id} message={m} onOpenDocument={onOpenDocument} />
        ))}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: "0.76rem", color: "var(--pd-ink-4)" }}>
        Messages préparés — aucun email n'est envoyé dans cette démonstration.
      </p>
    </section>
  );
}
