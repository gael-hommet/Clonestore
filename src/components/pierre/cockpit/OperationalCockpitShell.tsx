"use client";

// P9.3 — Shell du cockpit opérationnel client de Pierre. Header humain, navigation
// interne (query param stable ?view=), deep-link mission (?mission=), composer,
// drawer détail. Une seule route /agents/pierre/use. Données réelles via le hook.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, Building2, RefreshCw, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOperationalCockpit } from "@/app/agents/pierre/use/hooks/useOperationalCockpit";
import { COCKPIT_NAV, parseCockpitView, type CockpitView } from "./shell-nav";
import { ErrorView, LoadingView, StaleBanner } from "./primitives";
import { OverviewView } from "./OverviewView";
import { MissionsView } from "./MissionsView";
import { ValidationsView } from "./ValidationsView";
import { DocumentsView } from "./DocumentsView";
import { EmployeesView } from "./EmployeesView";
import { ActivityView } from "./ActivityView";
import { MissionComposer } from "./MissionComposer";
import { MissionDetailDrawer } from "./MissionDetailDrawer";

function humanState(tone: string, loading: boolean): { label: string; dot: string } {
  if (loading) return { label: "Chargement…", dot: "bg-[var(--cs-ink-4)]" };
  switch (tone) {
    case "danger": return { label: "Action requise", dot: "bg-[var(--cs-danger)]" };
    case "warning": return { label: "En attente de votre validation", dot: "bg-[var(--cs-warn)]" };
    case "progress": return { label: "En cours de travail", dot: "bg-[var(--cs-violet)]" };
    default: return { label: "Disponible", dot: "bg-[var(--cs-success)]" };
  }
}

export function OperationalCockpitShell() {
  const cockpit = useOperationalCockpit();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = parseCockpitView(searchParams.get("view"));
  const missionParam = searchParams.get("mission");
  const [composerOpen, setComposerOpen] = useState(false);
  const appliedMissionRef = useRef<string | null>(null);

  // Sync deep-link mission → sélection (restauration après reload).
  useEffect(() => {
    if (missionParam && missionParam !== appliedMissionRef.current) {
      appliedMissionRef.current = missionParam;
      cockpit.selectMission(missionParam);
    }
    if (!missionParam) appliedMissionRef.current = null;
  }, [missionParam, cockpit]);

  const setView = useCallback((v: CockpitView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const openMission = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mission", id);
    appliedMissionRef.current = id;
    cockpit.selectMission(id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams, cockpit]);

  const closeMission = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mission");
    appliedMissionRef.current = null;
    cockpit.selectMission(null);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams, cockpit]);

  const state = humanState(cockpit.overview.health.tone, cockpit.phase === "loading");
  const validationBadge = cockpit.pendingValidations.length;

  const lastUpdatedLabel = useMemo(() => {
    if (!cockpit.lastUpdated) return null;
    const d = new Date(cockpit.lastUpdated);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }, [cockpit.lastUpdated]);

  if (cockpit.authRequired) {
    return (
      <main className="cs-page"><div className="cs-page-shell">
        <ErrorView message="Votre session a expiré. Reconnectez-vous pour accéder au cockpit de Pierre." onRetry={() => cockpit.refresh()} />
      </div></main>
    );
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell space-y-5">
        {/* Header */}
        <section data-tour-id="pierre-cockpit-header" className="cs-panel relative overflow-hidden p-5 md:p-6">
          <div className="cs-system-halo" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]">
                <Bot className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">Pierre</h1>
                  <span className="cs-status">Employé IA RH</span>
                </div>
                <p className="flex items-center gap-2 text-[0.84rem] text-[var(--cs-ink-3)]">
                  <span className={cn("inline-block h-2 w-2 rounded-full", state.dot)} aria-hidden="true" />
                  {state.label}
                  {lastUpdatedLabel ? <span className="text-[var(--cs-ink-4)]">· actualisé {lastUpdatedLabel}</span> : null}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/agents/pierre/setup" className="cs-liquid-button" data-tour-id="pierre-settings">
                <Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Configuration</span>
              </Link>
              <Link href="/profile" className="cs-liquid-button">
                <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Mon CloneStore</span>
              </Link>
              <button
                type="button"
                onClick={() => cockpit.refresh()}
                aria-label="Rafraîchir"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--cs-line-soft)] bg-white/60 px-4 text-[0.86rem] font-medium text-[var(--cs-ink-2)] hover:bg-white/88"
              >
                <RefreshCw className={cockpit.refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                <span className="hidden sm:inline">Rafraîchir</span>
              </button>
              <button type="button" onClick={() => setComposerOpen(true)} className="cs-liquid-button cs-liquid-button--primary">
                <Sparkles className="h-4 w-4" /><span>Confier une mission</span>
              </button>
            </div>
          </div>
        </section>

        {/* Navigation interne */}
        <nav aria-label="Navigation du cockpit" className="flex gap-1.5 overflow-x-auto rounded-full border border-[var(--cs-line-soft)] bg-white/40 p-1.5">
          {COCKPIT_NAV.map((n) => (
            <button
              key={n.view}
              type="button"
              data-tour-id={n.tourId}
              onClick={() => setView(n.view)}
              aria-current={view === n.view ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap rounded-full px-4 py-2 text-[0.84rem] font-medium transition",
                view === n.view ? "bg-white text-[var(--cs-violet)] shadow-[var(--cs-shadow-soft)]" : "text-[var(--cs-ink-3)] hover:text-[var(--cs-ink-1)]",
              )}
            >
              {n.label}
              {n.view === "validations" && validationBadge > 0 ? (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--cs-danger)] px-1 text-[0.62rem] font-bold text-white">{validationBadge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        {cockpit.stale && cockpit.phase === "ready" ? <StaleBanner onRefresh={() => cockpit.refresh()} /> : null}

        {/* Contenu */}
        {cockpit.phase === "loading" ? (
          <LoadingView label="Chargement du cockpit de Pierre…" />
        ) : cockpit.phase === "error" && cockpit.missions.length === 0 ? (
          <ErrorView message={cockpit.error ?? "Le cockpit n'a pas pu être chargé."} onRetry={() => cockpit.refresh()} />
        ) : (
          <div aria-live="polite">
            {view === "overview" && (
              <OverviewView overview={cockpit.overview} onSelectMission={openMission} onGoView={setView} onCompose={() => setComposerOpen(true)} />
            )}
            {view === "missions" && (
              <MissionsView missions={cockpit.missions} onSelectMission={openMission} onCompose={() => setComposerOpen(true)} />
            )}
            {view === "validations" && (
              <ValidationsView validations={cockpit.validations} mutating={cockpit.mutating} onDecide={cockpit.decideValidation} onOpenMission={openMission} />
            )}
            {view === "documents" && (
              <DocumentsView artifacts={cockpit.artifacts} onOpenMission={openMission} />
            )}
            {view === "employees" && (
              <EmployeesView employees={cockpit.employees} />
            )}
            {view === "activity" && (
              <ActivityView events={cockpit.missionDetail?.timeline ?? []} contextLabel={cockpit.missionDetail?.mission.title ?? null} />
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <MissionComposer open={composerOpen} mutating={cockpit.mutating} onClose={() => setComposerOpen(false)} onCreate={cockpit.createMission} />

      {/* Drawer détail mission */}
      {cockpit.activeMissionId ? (
        <MissionDetailDrawer
          detail={cockpit.missionDetail}
          loading={cockpit.loadingDetail}
          mutating={cockpit.mutating}
          canCancel={cockpit.permissions.canCancelMission}
          onClose={closeMission}
          onDecide={cockpit.decideValidation}
          onCancelMission={cockpit.cancelMission}
        />
      ) : null}
    </main>
  );
}
