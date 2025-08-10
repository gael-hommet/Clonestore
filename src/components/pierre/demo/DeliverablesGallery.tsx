"use client";

// PIERRE FINAL INTERACTIVE DEMO — beat 07 · DELIVERABLES.
// Not a feature list: the finished outputs of an AI employee. Each card reads as
// a real product artifact — type, title, state, provenance ("Produit par Pierre")
// and its validation status — and opens the real (demo) document in the drawer.
// All content is DERIVED from scenario.documents; no file is real, no data private.

import { FileText, FileSignature, ClipboardList, ScrollText, Scale, StickyNote, Bot, ShieldCheck, ArrowUpRight } from "lucide-react";
import type { DemoDocument, DemoScenario } from "@/lib/pierre/demo";
import { BeatHeading } from "./parts";

const KIND: Record<string, { label: string; Icon: typeof FileText }> = {
  checklist: { label: "Checklist", Icon: ClipboardList },
  offre: { label: "Offre d'emploi", Icon: ScrollText },
  avenant: { label: "Avenant", Icon: FileSignature },
  grille: { label: "Grille d'entretien", Icon: ClipboardList },
  comparatif: { label: "Comparatif", Icon: Scale },
  note: { label: "Note de contrôle", Icon: StickyNote },
};

function needsValidation(doc: DemoDocument): boolean {
  return /validation|valider|humaine|obligatoire/i.test(doc.badge);
}

export function DeliverablesGallery({
  scenario,
  onOpen,
}: {
  scenario: DemoScenario;
  onOpen: (docId: string) => void;
}) {
  return (
    <section aria-label="Les livrables produits par Pierre">
      <BeatHeading
        n="07"
        eyebrow="Les livrables"
        title="Voici ce que votre employé IA vient de produire."
        caption="Des documents ouvrables et tracés — pas des captures d'écran."
      />

      <div className="pd-outputs">
        {scenario.documents.map((d) => {
          const kind = KIND[d.kind] ?? { label: "Document", Icon: FileText };
          const gated = needsValidation(d);
          return (
            <button
              key={d.id}
              type="button"
              className="pd-output"
              onClick={() => onOpen(d.id)}
              data-step-id={`gallery-doc:${d.id}`}
            >
              <div className="pd-output__top">
                <span className="pd-output__ico" aria-hidden><kind.Icon className="h-4 w-4" aria-hidden /></span>
                <span className="pd-output__kind">{kind.label}</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden style={{ marginLeft: "auto", color: "var(--pd-ink-4)" }} />
              </div>
              <span className="pd-output__title">{d.title}</span>
              {d.subtitle ? <span className="pd-output__sub">{d.subtitle}</span> : null}
              <div className="pd-output__meta">
                <span className="pd-output__prov"><Bot className="h-3 w-3" aria-hidden /> Produit par Pierre</span>
                <span className="pd-output__ver">v1 · brouillon</span>
              </div>
              <span className={`pd-output__state pd-output__state--${gated ? "gated" : "ready"}`}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {gated ? "Validation humaine requise" : "Prêt à relire"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="pdc-note" style={{ marginTop: 12, justifyContent: "center" }}>
        Documents de démonstration — aucun fichier réel ni donnée privée. Chaque version est tracée par CloneTrace.
      </p>
    </section>
  );
}
