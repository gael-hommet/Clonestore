"use client";

// PIERRE FINAL INTERACTIVE DEMO — interactive human validation.
// Valider / Demander une modification. The "request change" path shows Pierre
// resuming the work without restarting the whole mission. No real action runs.

import { useState } from "react";
import { CheckCircle2, PenSquare, ArrowRight } from "lucide-react";
import type { DemoScenario } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

const CHANGE_OPTIONS = [
  { id: "tone", label: "Rendre le ton plus humain", echo: "Ton ajusté — version plus chaleureuse préparée." },
  { id: "date", label: "Modifier la date d'effet", echo: "Date d'effet mise à jour — le reste du document est conservé." },
  { id: "precision", label: "Ajouter une précision", echo: "Précision ajoutée — Pierre n'a pas recommencé la mission." },
] as const;

type State = "idle" | "validated" | "choosing" | "changed";

export function DemoApproval({
  scenario,
  onOpenDocument,
  onApprovalClick,
}: {
  scenario: DemoScenario;
  onOpenDocument: (docId: string) => void;
  onApprovalClick: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [echo, setEcho] = useState<string>("");

  // The validation message is the one carrying a "validate" action.
  const validationMsg = scenario.messages.find((m) => (m.actions ?? []).some((a) => a.kind === "validate"));
  const docId = validationMsg?.actions?.find((a) => a.kind === "view_document")?.documentId;

  return (
    <section data-testid="demo-approval" data-conversion-demo-cockpit>
      <StepHeading
        eyebrow="Validation humaine"
        title="La décision sensible reste la vôtre."
        caption="Pierre prépare tout ; vous validez ou demandez une modification. Il reprend sans tout refaire."
      />

      <div className="pd-glass" style={{ padding: 18 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 650, color: "var(--pd-ink-1)" }}>
          {validationMsg?.title ?? "Document prêt pour validation."}
        </p>
        {(validationMsg?.lines ?? []).map((l, i) => (
          <p key={i} style={{ margin: "3px 0", fontSize: "0.85rem", color: "var(--pd-ink-2)" }}>{l}</p>
        ))}

        {state === "idle" || state === "choosing" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {docId ? (
              <button type="button" className="pd-btn pd-btn-secondary" style={{ minHeight: 40 }} onClick={() => onOpenDocument(docId)} data-step-id="approval-view">
                Voir le document
              </button>
            ) : null}
            <button
              type="button"
              className="pd-btn pd-btn-primary"
              style={{ minHeight: 40 }}
              onClick={() => { setState("validated"); onApprovalClick(); }}
              data-step-id="approval-validate"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Valider
            </button>
            <button
              type="button"
              className="pd-btn pd-btn-ghost"
              style={{ minHeight: 40 }}
              onClick={() => { setState("choosing"); onApprovalClick(); }}
              data-step-id="approval-request-change"
            >
              <PenSquare className="h-4 w-4" aria-hidden /> Demander une modification
            </button>
          </div>
        ) : null}

        {state === "choosing" ? (
          <div className="pd-card pd-animate-fade" style={{ marginTop: 12, padding: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--pd-ink-2)" }}>Que faut-il ajuster ?</p>
            <div style={{ display: "grid", gap: 6 }}>
              {CHANGE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="pd-btn pd-btn-secondary"
                  style={{ minHeight: 38, justifyContent: "space-between", width: "100%" }}
                  onClick={() => { setEcho(o.echo); setState("changed"); }}
                  data-step-id={`approval-change:${o.id}`}
                >
                  {o.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {state === "validated" ? (
          <div className="pd-card pd-animate-fade" style={{ marginTop: 12, padding: 12, borderColor: "var(--pd-ok-soft)" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--pd-ok)", fontWeight: 700 }}>
              <CheckCircle2 className="h-4 w-4" aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Validé. Pierre prépare la suite (préparation à la signature) — toujours sans action réelle ici.
            </p>
          </div>
        ) : null}

        {state === "changed" ? (
          <div className="pd-card pd-animate-fade" style={{ marginTop: 12, padding: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--pd-ink-2)" }}>{echo}</p>
            <button type="button" className="pd-btn pd-btn-ghost" style={{ minHeight: 36, marginTop: 8 }} onClick={() => setState("idle")}>
              Revenir à la validation
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
