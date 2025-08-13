"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — "Explorer Pierre" (level-2 overlay).
// The optional deep dive. A hub of short sections — NOT a second infinite landing
// page — holding the rich content that no longer belongs in the 6-scene main flow:
//   • Scénarios      — the other real scenarios (semaine RH · recrutement · avenant)
//   • Gouvernance    — the detailed PEUT / DOIT / NE + the concrete guardrail moment
//   • Autonomie      — the 4 real autonomy modes (PierreModes)
//   • Technologies   — the CloneStore technologies, surfaced while they act
//   • Livrables      — the produced documents, openable in a bounded preview
// A normal visitor can reserve WITHOUT ever opening this. Opening/closing it does not
// reset the scene index (that state lives above, in the player).

import { useState } from "react";
import { Layers, ShieldCheck, SlidersHorizontal, Cpu, FileText } from "lucide-react";
import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/pierre/demo";
import { PlayerOverlay } from "./PlayerOverlay";
import { GovernanceMatrix } from "../GovernanceMatrix";
import { TechnologyPulse } from "../TechnologyPulse";
import { PierreModes } from "@/components/pierre/PierreModes";
import { DemoDocumentViewer } from "../DemoDocumentViewer";

type TabId = "scenarios" | "gouvernance" | "autonomie" | "technologies" | "livrables";

const TABS: { id: TabId; label: string; Icon: typeof Layers }[] = [
  { id: "scenarios", label: "Scénarios", Icon: Layers },
  { id: "gouvernance", label: "Gouvernance", Icon: ShieldCheck },
  { id: "autonomie", label: "Autonomie", Icon: SlidersHorizontal },
  { id: "technologies", label: "Technologies", Icon: Cpu },
  { id: "livrables", label: "Livrables", Icon: FileText },
];

export function ExplorerPierre({ scenario, onClose }: { scenario: DemoScenario; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("scenarios");

  return (
    <PlayerOverlay title="Explorer Pierre" tag="Le détail, sans jamais quitter la démonstration" onClose={onClose}>
      <div className="pdp-explorer">
        <div className="pdp-explorer__tabs" role="tablist" aria-label="Sections de l'exploration">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`pdp-etab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`pdp-epanel-${t.id}`}
              className="pdp-etab"
              onClick={() => setTab(t.id)}
            >
              <t.Icon className="h-3.5 w-3.5" aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`pdp-epanel-${tab}`}
          aria-labelledby={`pdp-etab-${tab}`}
          style={{ marginTop: 18 }}
        >
          {tab === "scenarios" ? (
            <section aria-label="Autres scénarios">
              <p className="pd-lede" style={{ fontSize: "0.84rem", marginBottom: 12 }}>
                Trois missions réelles, une seule mécanique. Vous en avez vu une — voici les autres.
              </p>
              <div className="pdp-scenario-list">
                {DEMO_SCENARIOS.map((s) => (
                  <article key={s.id} className={`pdp-scenario-card${s.id === scenario.id ? "" : ""}`}>
                    <h3 className="pdp-scenario-card__name">{s.name}</h3>
                    <p className="pdp-scenario-card__promise">{s.promise}</p>
                    <p className="pdp-scenario-card__req">&ldquo;{s.request}&rdquo;</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "gouvernance" ? <GovernanceMatrix scenario={scenario} /> : null}

          {tab === "autonomie" ? <PierreModes headingLevel="h3" /> : null}

          {tab === "technologies" ? <TechnologyPulse /> : null}

          {tab === "livrables" ? (
            <section aria-label="Livrables" style={{ display: "grid", gap: 14 }}>
              <p className="pd-lede" style={{ fontSize: "0.84rem" }}>
                Les documents produits par Pierre — brouillons honnêtes, à relire, jamais envoyés seuls.
              </p>
              {scenario.documents.map((d) => (
                <DemoDocumentViewer key={d.id} doc={d} />
              ))}
            </section>
          ) : null}
        </div>
      </div>
    </PlayerOverlay>
  );
}
