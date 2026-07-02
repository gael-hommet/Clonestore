"use client";

// P9.3 — Salariés : quick-list réelle (V1, tenant-scoped) + accès au dossier 360
// canonique (/agents/pierre/employees). Le cockpit ne RECONSTRUIT pas Employee 360.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitEmployeeListItem } from "@/lib/client-cockpit";
import { EmptyView, SectionShell } from "./primitives";

export function EmployeesView({ employees }: { employees: readonly CockpitEmployeeListItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.name} ${e.role ?? ""}`.toLowerCase().includes(q));
  }, [employees, query]);

  return (
    <SectionShell
      eyebrow="Salariés"
      description="Les salariés suivis par Pierre. Ouvrez un dossier pour le détail complet."
      tourId="pierre-employees"
      right={
        <Link href="/agents/pierre/employees" className="cs-liquid-button">
          <UserRound className="h-4 w-4" /><span>Ouvrir Employee 360</span>
        </Link>
      }
    >
      {employees.length === 0 ? (
        <EmptyView
          title="Aucun salarié enregistré pour le moment."
          text="Ajoutez vos salariés depuis Employee 360 pour que Pierre puisse rattacher missions et documents."
          action={
            <Link href="/agents/pierre/employees" className="cs-liquid-button cs-liquid-button--primary">
              <ArrowRight className="h-4 w-4" /><span>Ouvrir Employee 360</span>
            </Link>
          }
        />
      ) : (
        <>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cs-ink-4)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un salarié…"
              aria-label="Rechercher un salarié"
              className="min-h-[44px] w-full rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 pl-10 pr-4 text-[0.9rem] outline-none focus-visible:border-[var(--cs-violet)]"
            />
          </label>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[0.85rem] text-[var(--cs-ink-4)]">Aucun salarié ne correspond.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {filtered.map((e) => (
                <li key={e.id}>
                  <Link href={e.href} className="cs-card cs-card-tight cs-hover-lift flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{e.name}</span>
                        <span className="block truncate text-[0.76rem] text-[var(--cs-ink-4)]">{e.role ?? "Salarié"}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={cn("cs-status", e.tone === "success" ? "cs-status--success" : e.tone === "warning" ? "cs-status--warn" : e.tone === "info" ? "cs-status--info" : "")}>{e.statusLabel}</span>
                      <ArrowRight className="h-4 w-4 text-[var(--cs-ink-4)]" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SectionShell>
  );
}
