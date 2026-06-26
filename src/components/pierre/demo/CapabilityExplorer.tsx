"use client";

// PIERRE FINAL INTERACTIVE DEMO — compact capability map (exploration depth).
// Each domain opens a drawer with a few extra capabilities. Honest statuses come
// from the truth registry where a capability maps to one.

import { useState } from "react";
import { Brain, CalendarRange, FileText, MessagesSquare, Activity, ShieldCheck, Database, History } from "lucide-react";
import { getCapability } from "@/lib/pierre/demo";
import { DemoDrawer } from "./DemoDrawer";
import { StepHeading } from "./parts";

interface Domain {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  items: string[];
  /** capability ids whose honest disclosure we surface */
  capabilityIds: string[];
}

const DOMAINS: Domain[] = [
  { id: "comprendre", label: "Comprendre", Icon: Brain, items: ["demande libre", "plusieurs intentions", "langue et ton", "informations manquantes", "contexte salarié", "contexte entreprise"], capabilityIds: ["request_understanding", "missing_info_detection", "context_recall"] },
  { id: "planifier", label: "Planifier", Icon: CalendarRange, items: ["tâches", "échéances", "priorités", "dépendances", "files de travail", "reprise sur erreur"], capabilityIds: ["mission_planning", "parallel_execution"] },
  { id: "produire", label: "Produire", Icon: FileText, items: ["contrats", "avenants", "offres", "convocations", "comptes rendus", "courriers", "PDF", "DOCX"], capabilityIds: ["document_generation", "signature_preparation"] },
  { id: "communiquer", label: "Communiquer", Icon: MessagesSquare, items: ["emails", "messages internes", "relances", "demandes de validation", "communications candidats", "communications collaborateurs"], capabilityIds: ["email_preparation", "real_email_send"] },
  { id: "suivre", label: "Suivre", Icon: Activity, items: ["rappels", "blocages", "échéances", "historique", "briefings", "missions parallèles"], capabilityIds: ["scheduling_followup", "parallel_execution"] },
  { id: "securiser", label: "Sécuriser", Icon: ShieldCheck, items: ["validations humaines", "permissions", "refus hors rôle", "absence d'invention", "contrôle des informations sensibles", "journalisation"], capabilityIds: ["human_approval", "guardrails"] },
  { id: "memoriser", label: "Mémoriser", Icon: Database, items: ["contexte conservé", "reprise plus tard", "préférences entreprise", "empreinte"], capabilityIds: ["continuity_memory", "context_recall"] },
  { id: "tracer", label: "Tracer", Icon: History, items: ["décisions", "générations", "actions", "validations", "horodatage"], capabilityIds: ["traceability"] },
];

const STATUS_LABEL: Record<string, string> = {
  available: "Disponible",
  available_with_validation: "Disponible avec validation",
  prepared_not_executed: "Préparé — exécution distincte",
  demo_only: "Démonstration uniquement",
};

export function CapabilityExplorer() {
  const [open, setOpen] = useState<Domain | null>(null);

  return (
    <section data-testid="capability-explorer">
      <StepHeading eyebrow="Profondeur" title="Ce que Pierre vient de démontrer." caption="Huit domaines — ouvrez-en un pour voir le détail honnête." />
      <div className="pd-grid-4 pd-stagger">
        {DOMAINS.map((d) => {
          const Icon = d.Icon;
          return (
            <button key={d.id} type="button" className="pd-mission" style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={() => setOpen(d)} data-step-id={`capability:${d.id}`} data-domain-id={d.id}>
              <span className="pd-tech__badge" aria-hidden><Icon className="h-4 w-4" aria-hidden /></span>
              <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>{d.label}</span>
            </button>
          );
        })}
      </div>

      <DemoDrawer open={open !== null} title={open ? `Domaine — ${open.label}` : ""} onClose={() => setOpen(null)}>
        {open ? (
          <div>
            <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
              {open.items.map((it) => (
                <li key={it} style={{ margin: "4px 0", color: "var(--pd-ink-2)", fontSize: "0.88rem" }}>{it}</li>
              ))}
            </ul>
            <p className="pd-eyebrow" style={{ marginBottom: 8 }}>Statuts réels</p>
            <div style={{ display: "grid", gap: 8 }}>
              {open.capabilityIds.map((cid) => {
                const c = getCapability(cid);
                if (!c) return null;
                return (
                  <div key={cid} className="pd-card" style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "var(--pd-ink-1)", fontSize: "0.86rem" }}>{c.label}</span>
                      <span className={c.productionStatus === "available" ? "pd-chip pd-chip--ok" : "pd-chip pd-chip--warn"} style={{ marginLeft: "auto", minHeight: 24, fontSize: "0.68rem" }}>
                        {STATUS_LABEL[c.productionStatus]}
                      </span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--pd-ink-3)" }}>{c.demoDisclosure}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </DemoDrawer>
    </section>
  );
}
