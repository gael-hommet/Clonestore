"use client";

// P9.3 — Activité : timeline lisible des événements réels (mission active),
// regroupement du bruit technique, filtres. Aucun payload/hash/ID interne exposé.

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, FileText, Mail, ShieldAlert, UserRound, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupTimeline, type CockpitTimelineEvent, type CockpitTimelineKind } from "@/lib/client-cockpit";
import { EmptyView, RelativeTime, SectionShell } from "./primitives";

const KIND_ICON: Record<CockpitTimelineKind, React.ReactNode> = {
  mission: <Workflow className="h-4 w-4" />,
  task: <Bot className="h-4 w-4" />,
  validation: <ShieldAlert className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  communication: <Mail className="h-4 w-4" />,
  incident: <ShieldAlert className="h-4 w-4" />,
  system: <Bot className="h-4 w-4" />,
};

const FILTERS: Array<{ value: "all" | CockpitTimelineKind; label: string }> = [
  { value: "all", label: "Tout" },
  { value: "mission", label: "Missions" },
  { value: "validation", label: "Validations" },
  { value: "document", label: "Documents" },
  { value: "communication", label: "Communications" },
  { value: "incident", label: "Incidents" },
];

const ACTOR_LABEL = { pierre: "Pierre", human: "Vous", system: "Système", import: "Import", unknown: "—" } as const;

export function ActivityView({
  events,
  contextLabel,
}: {
  events: readonly CockpitTimelineEvent[];
  contextLabel?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | CockpitTimelineKind>("all");

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.kind === filter || (filter === "incident" && e.kind === "incident"))),
    [events, filter],
  );
  const groups = useMemo(() => groupTimeline(filtered), [filtered]);

  return (
    <SectionShell
      eyebrow="Activité"
      description={contextLabel ? `Historique — ${contextLabel}` : "Sélectionnez une mission pour voir son historique détaillé."}
      tourId="pierre-activity"
      right={
        events.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer l'activité">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.74rem] font-medium transition",
                  filter === f.value ? "border-[var(--cs-violet)] bg-[var(--cs-violet-soft)] text-[var(--cs-violet)]" : "border-[var(--cs-line-soft)] bg-white/50 text-[var(--cs-ink-3)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {events.length === 0 ? (
        <EmptyView
          title="Aucune activité à afficher."
          text="Ouvrez une mission depuis l'onglet Missions pour suivre pas à pas ce que Pierre a fait."
        />
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-[0.85rem] text-[var(--cs-ink-4)]">Aucun événement pour ce filtre.</p>
      ) : (
        <ol className="relative space-y-3 pl-2">
          {groups.map((g, gi) => (
            <li key={gi} className="space-y-2">
              {g.collapsed ? (
                <details className="cs-card cs-card-tight">
                  <summary className="cursor-pointer text-[0.82rem] text-[var(--cs-ink-3)]">
                    {g.events.length} étapes internes de Pierre
                  </summary>
                  <ul className="mt-2 space-y-2 border-t border-[var(--cs-line-soft)] pt-2">
                    {g.events.map((e) => <TimelineRow key={e.id} e={e} />)}
                  </ul>
                </details>
              ) : (
                g.events.map((e) => (
                  <div key={e.id} className="cs-card cs-card-tight"><TimelineRow e={e} /></div>
                ))
              )}
            </li>
          ))}
        </ol>
      )}
    </SectionShell>
  );
}

function TimelineRow({ e }: { e: CockpitTimelineEvent }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn(
        "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/58",
        e.tone === "danger" ? "text-[var(--cs-danger)]" : e.tone === "warning" ? "text-[var(--cs-warn)]" : e.tone === "success" ? "text-[var(--cs-success)]" : "text-[var(--cs-violet)]",
      )}>
        {e.kind === "mission" && e.title.toLowerCase().includes("complet") ? <CheckCircle2 className="h-4 w-4" /> : e.actor === "human" ? <UserRound className="h-4 w-4" /> : KIND_ICON[e.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{e.title}</p>
        {e.detail ? <p className="text-[0.8rem] leading-5 text-[var(--cs-ink-3)]">{e.detail}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-[0.74rem] text-[var(--cs-ink-4)]">
          <span>{ACTOR_LABEL[e.actor]}</span>
          <span aria-hidden="true">·</span>
          <RelativeTime iso={e.at} />
        </div>
      </div>
    </div>
  );
}
