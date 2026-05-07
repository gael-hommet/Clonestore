"use client";

import * as React from "react";
import {
  Clock3,
  FileText,
  History,
  Loader2,
  Mail,
  Pin,
  RefreshCw,
  Search,
  Star,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PierreHistoryItem } from "@/hooks/pierre/usePierreHistory";

type Props = {
  items?: PierreHistoryItem[] | null;
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onLoadMore?: () => void | Promise<void>;
  onSelectMission?: (missionId: string) => void;
};

type FilterMode = "all" | "missions" | "documents" | "emails" | "important";

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusTone(statusRaw?: string | null) {
  const status = normalize(statusRaw);

  if (["done", "completed"].includes(status)) {
    return "border-[#d7e8da] bg-[#edf8ef] text-[#2f6c43]";
  }

  if (["blocked", "failed", "cancelled"].includes(status)) {
    return "border-[#f0c2bc] bg-[#fff1ef] text-[#8b3d33]";
  }

  if (["awaiting_validation", "awaiting_approval", "awaiting_info"].includes(status)) {
    return "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]";
  }

  if (["running", "in_progress"].includes(status)) {
    return "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]";
  }

  return "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]";
}

function kindMeta(kindRaw?: string | null) {
  const kind = normalize(kindRaw);

  switch (kind) {
    case "document":
      return {
        label: "Document",
        icon: FileText,
      };
    case "email":
      return {
        label: "Email",
        icon: Mail,
      };
    case "mission":
      return {
        label: "Mission",
        icon: Workflow,
      };
    default:
      return {
        label: "Historique",
        icon: Clock3,
      };
  }
}

function matchesFilter(item: PierreHistoryItem, filter: FilterMode) {
  switch (filter) {
    case "missions":
      return item.kind === "mission";
    case "documents":
      return item.kind === "document";
    case "emails":
      return item.kind === "email";
    case "important":
      return item.pinned || item.favorite;
    default:
      return true;
  }
}

function countByFilter(items: PierreHistoryItem[], filter: FilterMode) {
  return items.filter((item) => matchesFilter(item, filter)).length;
}

function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-[#d9c1a4] bg-[#fff4e6] text-[#5a4427]"
          : "border-[#eadfce] bg-[#fffdf9] text-[#6b5a49] hover:bg-white"
      )}
    >
      <span>{label}</span>
      <span className="rounded-full border border-[#eadbc9] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#735f4b]">
        {count}
      </span>
    </button>
  );
}

export function PierreHistoryPanel({
  items,
  loading = false,
  onRefresh,
  onLoadMore,
  onSelectMission,
}: Props) {
  const safeItems = Array.isArray(items) ? items : [];
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterMode>("all");

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return safeItems.filter((item) => {
      if (!matchesFilter(item, filter)) return false;

      if (!q) return true;

      const haystack = [
        item.title,
        item.subtitle,
        item.status,
        item.kind,
        item.mission_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [filter, query, safeItems]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#241b12]">Historique Pierre</p>
            <p className="mt-1 text-sm text-[#6b5b4b]">
              Continuité des missions, productions et actions passées.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1 xl:flex-none">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a856f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans l’historique..."
              className="w-full rounded-[18px] border border-[#e7d9c8] bg-white py-3 pl-11 pr-4 text-sm text-[#2a2118] outline-none transition placeholder:text-[#a18c77] focus:border-[#d8bd9d] focus:ring-4 focus:ring-[#f3e6d6]"
            />
          </div>

          <button
            type="button"
            onClick={() => void onRefresh?.()}
            className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualiser
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterTab
          active={filter === "all"}
          label="Tout"
          count={countByFilter(safeItems, "all")}
          onClick={() => setFilter("all")}
        />
        <FilterTab
          active={filter === "missions"}
          label="Missions"
          count={countByFilter(safeItems, "missions")}
          onClick={() => setFilter("missions")}
        />
        <FilterTab
          active={filter === "documents"}
          label="Documents"
          count={countByFilter(safeItems, "documents")}
          onClick={() => setFilter("documents")}
        />
        <FilterTab
          active={filter === "emails"}
          label="Emails"
          count={countByFilter(safeItems, "emails")}
          onClick={() => setFilter("emails")}
        />
        <FilterTab
          active={filter === "important"}
          label="Importants"
          count={countByFilter(safeItems, "important")}
          onClick={() => setFilter("important")}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-[#e6dacb] bg-[#fffdf9] px-4 py-10 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
            <History className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[#2e241a]">
            Aucun élément d’historique
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7a6957]">
            Les missions passées, artefacts et actions de Pierre apparaîtront ici
            pour permettre recherche, continuité et reprise rapide.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const meta = kindMeta(item.kind);
            const Icon = meta.icon;
            const missionId = item.mission_id || "";
            const clickable = Boolean(missionId);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (clickable) onSelectMission?.(missionId);
                }}
                className={cn(
                  "flex w-full items-start gap-4 rounded-[22px] border border-[#eadfce] bg-white px-4 py-4 text-left transition",
                  clickable ? "hover:bg-[#fffaf3]" : "cursor-default"
                )}
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#eadbc9] bg-[#fffdf8] px-2.5 py-1 text-[11px] font-semibold text-[#735f4b]">
                          {meta.label}
                        </span>

                        {item.status ? (
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              statusTone(item.status)
                            )}
                          >
                            {item.status}
                          </span>
                        ) : null}

                        {item.pinned ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#eadbc9] bg-[#fffdf8] px-2.5 py-1 text-[11px] font-semibold text-[#735f4b]">
                            <Pin className="h-3 w-3" />
                            Épinglé
                          </span>
                        ) : null}

                        {item.favorite ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#ecd8b4] bg-[#fff8ea] px-2.5 py-1 text-[11px] font-semibold text-[#8a5b17]">
                            <Star className="h-3 w-3" />
                            Favori
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm font-semibold text-[#2b2118]">
                        {text(item.title, "Élément Pierre")}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#5f5144]">
                        {text(item.subtitle, "Aucun détail complémentaire.")}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 text-xs text-[#8d7a67] xl:items-end">
                      <span>{formatDate(item.updated_at ?? item.created_at)}</span>
                      {clickable ? (
                        <span className="rounded-full border border-[#eadbc9] bg-[#fffdf8] px-2.5 py-1 font-medium text-[#735f4b]">
                          Mission liée
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {onLoadMore && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => void onLoadMore()}
                className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
                Charger plus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PierreHistoryPanel;