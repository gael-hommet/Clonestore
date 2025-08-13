"use client";

// SCENE 5 · RESULT — "Mission terminée." + the real outputs as product artifacts.
// Documents (scenario.documents, max 4 visible) render as openable cards; ONE opens
// in an internal preview (DemoDrawer + DemoDocumentViewer — the only place a bounded
// internal scroll is allowed). Plus an ultra-legible comparison from scenario.roleSplit:
// "Sans Pierre" (humans[] manual work) vs "Avec Pierre" (pierre[] done + human decision
// kept). No invented numbers.

import { useState } from "react";
import { ArrowRight, ArrowLeft, FileText, ExternalLink, User, Bot } from "lucide-react";
import { DemoDrawer } from "../../DemoDrawer";
import { DemoDocumentViewer } from "../../DemoDocumentViewer";
import { trackDemoEvent, type DemoScenario, type DemoDocument } from "@/lib/pierre/demo";

export function Scene5Result({
  scenario,
  onNext,
  onPrev,
}: {
  scenario: DemoScenario;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [openDoc, setOpenDoc] = useState<DemoDocument | null>(null);
  const docs = scenario.documents.slice(0, 4);
  const split = scenario.roleSplit;

  function open(doc: DemoDocument) {
    setOpenDoc(doc);
    trackDemoEvent("pierre_demo_document_opened", { scenario_id: scenario.id, step_index: 4 });
  }

  return (
    <div className="pdp-scene__inner pdp-scene__inner--wide">
      <header style={{ display: "grid", gap: 5 }}>
        <p className="pd-eyebrow">Le résultat</p>
        <h2 className="pd-h2">Mission terminée.</h2>
        <p className="pd-lede" style={{ fontSize: "0.82rem" }}>Les livrables, prêts à relire.</p>
      </header>

      <div className="pdp-result__grid">
        <div className="pdp-artifacts" aria-label="Livrables produits par Pierre">
          {docs.map((d) => (
            <button key={d.id} type="button" className="pdp-artifact" onClick={() => open(d)} data-step-id="result_open_document" data-conversion-demo-cockpit>
              <span className="pdp-artifact__top">
                <span className="pdp-output__ico" aria-hidden style={{ width: 26, height: 26 }}>
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="pdp-artifact__kind">{d.kind}</span>
                <ExternalLink className="pdp-artifact__open h-4 w-4" aria-hidden />
              </span>
              <span className="pdp-artifact__title">{d.title}</span>
              <span className="pd-chip pd-chip--warn" style={{ minHeight: 24, fontSize: "0.64rem", width: "fit-content" }}>{d.badge}</span>
            </button>
          ))}
        </div>

        {split ? (
          <div className="pdp-compare" aria-label="Sans Pierre / Avec Pierre">
            <div className="pdp-compare__col pdp-compare__col--without">
              <p className="pdp-compare__h"><User className="h-4 w-4" aria-hidden /> Sans Pierre</p>
              <ul>
                {split.humans.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </div>
            <div className="pdp-compare__col pdp-compare__col--with">
              <p className="pdp-compare__h"><Bot className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} /> Avec Pierre</p>
              <ul>
                {split.pierre.map((p) => <li key={p}>{p}</li>)}
                <li style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>+ vos décisions, gardées</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pdp-nav pdp-nav--between">
        <button type="button" className="pd-btn pd-btn-ghost" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </button>
        <button type="button" className="pd-btn pd-btn-primary" onClick={onNext} data-step-id="result_close" data-conversion-demo-cockpit>
          Découvrir l&apos;offre <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <DemoDrawer
        open={openDoc !== null}
        title={openDoc?.title ?? "Document"}
        onClose={() => setOpenDoc(null)}
        scrollResetKey={openDoc?.id ?? null}
      >
        {openDoc ? <DemoDocumentViewer doc={openDoc} /> : null}
      </DemoDrawer>
    </div>
  );
}
