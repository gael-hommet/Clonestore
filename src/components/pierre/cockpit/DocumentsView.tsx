"use client";

// P9.3 — Documents & livrables : dérivés des tâches documentaires RÉELLES
// (voir P9_3_RUNTIME_CONTRACT_GAPS GAP-2). Aucun faux document, aucune URL bucket,
// aucun token affiché. Le téléchargement réel passe par le lien signé sécurisé
// existant quand le runtime en émet un ; sinon on ouvre la mission source.

import { useMemo, useState } from "react";
import { FileCheck2, FileText, FileSignature, Mail, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitArtifact } from "@/lib/client-cockpit";
import { EmptyView, RelativeTime, SectionShell, StatusChip } from "./primitives";

export function DocumentsView({
  artifacts,
  onOpenMission,
}: {
  artifacts: readonly CockpitArtifact[];
  onOpenMission: (missionId: string) => void;
}) {
  const [family, setFamily] = useState<"all" | "Document" | "Communication">("all");
  const filtered = useMemo(
    () => artifacts.filter((a) => family === "all" || a.family === family),
    [artifacts, family],
  );

  return (
    <SectionShell
      eyebrow="Documents"
      description="Les livrables produits par Pierre au fil des missions."
      tourId="pierre-documents"
      right={
        artifacts.length > 0 ? (
          <div className="flex gap-1.5" role="group" aria-label="Filtrer les documents">
            {(["all", "Document", "Communication"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(f)}
                aria-pressed={family === f}
                className={cn(
                  "rounded-full border px-3 py-1 text-[0.76rem] font-medium transition",
                  family === f ? "border-[var(--cs-violet)] bg-[var(--cs-violet-soft)] text-[var(--cs-violet)]" : "border-[var(--cs-line-soft)] bg-white/50 text-[var(--cs-ink-3)]",
                )}
              >
                {f === "all" ? "Tous" : f === "Document" ? "Documents" : "Communications"}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {artifacts.length === 0 ? (
        <EmptyView
          title="Aucun document produit pour le moment."
          text="Les documents et communications préparés par Pierre (contrats, attestations, e-mails) apparaîtront ici."
        />
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-[0.85rem] text-[var(--cs-ink-4)]">Aucun document dans cette catégorie.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((d) => (
            <li key={d.id}>
              <div className="cs-card cs-card-tight h-full">
                <div className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]">
                      {d.family === "Communication" ? <Mail className="h-4 w-4" /> : d.isPdf ? <FileSignature className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <StatusChip view={d.statusView} />
                  </div>
                  <p className="text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{d.title}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-[var(--cs-ink-4)]">
                    <span>{d.family}</span>
                    {d.isPdf ? <span>PDF</span> : null}
                    {d.employee ? <span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />{d.employee.name}</span> : null}
                    <RelativeTime iso={d.createdAt} />
                  </div>
                  <div className="mt-auto flex items-center gap-3 pt-2">
                    {d.missionId ? (
                      <button type="button" onClick={() => onOpenMission(d.missionId!)} className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-[var(--cs-violet)] hover:underline">
                        <FileCheck2 className="h-4 w-4" />Ouvrir la mission
                      </button>
                    ) : null}
                    {d.requiresValidation && d.status === "awaiting_validation" ? (
                      <span className="text-[0.76rem] text-[var(--cs-warn)]">À valider</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
