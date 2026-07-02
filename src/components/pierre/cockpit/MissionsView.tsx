"use client";

// P9.3 — Missions : liste réelle, recherche, filtres, tri, état vide.

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { compareUrgency, type CockpitMissionStatus, type CockpitMissionSummary } from "@/lib/client-cockpit";
import { EmptyView, ProgressBar, RelativeTime, SectionShell, StatusChip, UrgencyBadge } from "./primitives";

const STATUS_FILTERS: Array<{ value: "all" | CockpitMissionStatus; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "understanding", label: "Infos manquantes" },
  { value: "awaiting_approval", label: "À valider" },
  { value: "in_progress", label: "En cours" },
  { value: "blocked", label: "Bloquées" },
  { value: "done", label: "Terminées" },
];

export function MissionsView({
  missions,
  onSelectMission,
  onCompose,
}: {
  missions: readonly CockpitMissionSummary[];
  onSelectMission: (id: string) => void;
  onCompose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CockpitMissionStatus>("all");
  const [sort, setSort] = useState<"recent" | "urgency">("urgency");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = missions.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (q && !`${m.title} ${m.employee?.name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "urgency") sorted.sort((a, b) => compareUrgency(a.urgency, b.urgency) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    else sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return sorted;
  }, [missions, query, status, sort]);

  return (
    <SectionShell
      eyebrow="Missions"
      description="Tout ce que vous avez confié à Pierre."
      tourId="pierre-missions"
      right={
        <button type="button" onClick={onCompose} className="cs-liquid-button cs-liquid-button--primary">
          <Plus className="h-4 w-4" /><span>Nouvelle mission</span>
        </button>
      }
    >
      {/* Barre de filtres */}
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cs-ink-4)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une mission ou un salarié…"
            aria-label="Rechercher une mission"
            className="min-h-[44px] w-full rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 pl-10 pr-4 text-[0.9rem] outline-none focus-visible:border-[var(--cs-violet)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition",
                status === f.value
                  ? "border-[var(--cs-violet)] bg-[var(--cs-violet-soft)] text-[var(--cs-violet)]"
                  : "border-[var(--cs-line-soft)] bg-white/50 text-[var(--cs-ink-3)] hover:bg-white/80",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[0.76rem] text-[var(--cs-ink-4)]">
            <span>Tri :</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "urgency")}
              aria-label="Trier les missions"
              className="rounded-full border border-[var(--cs-line-soft)] bg-white/60 px-2 py-1 text-[0.76rem] outline-none focus-visible:border-[var(--cs-violet)]"
            >
              <option value="urgency">Priorité</option>
              <option value="recent">Récent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      {missions.length === 0 ? (
        <EmptyView
          title="Aucune mission pour le moment."
          text="Confiez une première mission à Pierre pour la voir apparaître ici."
          action={
            <button type="button" onClick={onCompose} className="cs-liquid-button cs-liquid-button--primary">
              <Plus className="h-4 w-4" /><span>Confier une mission</span>
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-[0.85rem] text-[var(--cs-ink-4)]">Aucune mission ne correspond à ces filtres.</p>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onSelectMission(m.id)} className="cs-card cs-card-tight cs-hover-lift block w-full text-left">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-[0.94rem] font-semibold text-[var(--cs-ink-1)]">{m.title}</p>
                      <StatusChip view={m.statusView} />
                      <UrgencyBadge urgency={m.urgency} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[0.76rem] text-[var(--cs-ink-4)]">
                      {m.employee ? <span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />{m.employee.name}</span> : null}
                      <RelativeTime iso={m.createdAt} />
                      <span>{m.tasksDone}/{m.tasksTotal} tâches</span>
                    </div>
                    <div className="max-w-md"><ProgressBar value={m.progress} label={`Progression de ${m.title}`} /></div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.8rem] font-medium text-[var(--cs-violet)]">
                    {m.nextAction.label}<ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
