"use client";

// src/components/cockpit/PierreCockpitConsole.tsx
// P12 §8 — Cockpit de l'EMPLOYÉ IA RH (Pierre) dans la console CloneOS (pas de scroll de page).
// Réutilise le socle de données V1 RÉEL (useOperationalCockpit) + les vues P9.3 — AUCUNE logique RH
// réimplémentée. Pierre est cadré « employé IA RH / équipe RH opérationnelle », jamais assistant.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bot, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CloneOsAppShell } from "@/components/cloneos/CloneOsAppShell";
import { useOperationalCockpit } from "@/app/agents/pierre/use/hooks/useOperationalCockpit";
import { OverviewView } from "@/components/pierre/cockpit/OverviewView";
import { MissionsView } from "@/components/pierre/cockpit/MissionsView";
import { ValidationsView } from "@/components/pierre/cockpit/ValidationsView";
import { DocumentsView } from "@/components/pierre/cockpit/DocumentsView";
import { ActivityView } from "@/components/pierre/cockpit/ActivityView";
import { JourneyReadinessView } from "@/components/pierre/cockpit/JourneyReadinessView";
import { MissionComposer } from "@/components/pierre/cockpit/MissionComposer";
import { MissionDetailDrawer } from "@/components/pierre/cockpit/MissionDetailDrawer";
import { PierreAutonomyPanel } from "@/components/pierre/autonomy/PierreAutonomyPanel";
import { LoadingView, ErrorView } from "@/components/pierre/cockpit/primitives";
import type { CockpitView } from "@/components/pierre/cockpit/shell-nav";

export type PierreConsoleView = "overview" | "missions" | "validations" | "documents" | "evidence" | "activity" | "settings";

const VIEW_TITLE: Record<PierreConsoleView, string> = {
  overview: "Vue d'ensemble RH",
  missions: "Missions RH",
  validations: "Validations",
  documents: "Documents",
  evidence: "Preuves",
  activity: "Activité de Pierre",
  settings: "Autonomie de Pierre",
};

export function PierreCockpitConsole({ view }: { view: PierreConsoleView }) {
  const cockpit = useOperationalCockpit();
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [missionSeed, setMissionSeed] = useState("");

  // Extraction d'action depuis CloneRoom : /cockpit/pierre/missions?compose=<texte> ouvre le VRAI
  // composer de Pierre pré-rempli avec le contenu du message (le texte est réellement transporté,
  // pas une route statique). Aucune mission n'est créée sans la validation de l'utilisateur.
  useEffect(() => {
    const compose = new URLSearchParams(window.location.search).get("compose");
    if (compose && compose.trim()) { setMissionSeed(compose.trim()); setComposerOpen(true); }
  }, []);

  const openMission = useCallback((id: string) => cockpit.selectMission(id), [cockpit]);
  const goView = useCallback((v: CockpitView) => {
    const map: Partial<Record<CockpitView, string>> = { missions: "/cockpit/pierre/missions", validations: "/cockpit/pierre/validations", documents: "/cockpit/pierre/documents", autonomy: "/cockpit/pierre/settings", activity: "/cockpit/pierre" };
    router.push(map[v] ?? "/cockpit/pierre");
  }, [router]);

  // ── Zone de travail centrale (vue sélectionnée) ──────────────────────────────
  let body: ReactNode;
  if (view === "settings") {
    body = <div className="p-4"><PierreAutonomyPanel /></div>;
  } else if (cockpit.phase === "loading") {
    body = <LoadingView label="Chargement du cockpit de Pierre…" />;
  } else if (cockpit.phase === "error" && cockpit.missions.length === 0) {
    body = <ErrorView message={cockpit.error ?? "Le cockpit n'a pas pu être chargé."} onRetry={() => cockpit.refresh()} />;
  } else if (view === "missions") {
    body = <div className="p-4"><MissionsView missions={cockpit.missions} onSelectMission={openMission} onCompose={() => setComposerOpen(true)} /></div>;
  } else if (view === "validations") {
    body = <div className="p-4"><ValidationsView validations={cockpit.validations} mutating={cockpit.mutating} onDecide={cockpit.decideValidation} onOpenMission={openMission} /></div>;
  } else if (view === "documents" || view === "evidence") {
    body = <div className="p-4"><DocumentsView artifacts={cockpit.artifacts} onOpenMission={openMission} /></div>;
  } else if (view === "activity") {
    body = <div className="p-4"><ActivityView events={cockpit.missionDetail?.timeline ?? []} contextLabel={cockpit.missionDetail?.mission.title ?? null} /></div>;
  } else {
    body = <div className="space-y-4 p-4"><OverviewView overview={cockpit.overview} onSelectMission={openMission} onGoView={goView} onCompose={() => setComposerOpen(true)} /><JourneyReadinessView missions={cockpit.missions} artifacts={cockpit.artifacts} pendingValidations={cockpit.pendingValidations.length} onOpenMission={openMission} onGoView={goView} onCompose={() => setComposerOpen(true)} /></div>;
  }

  const main = (
    <>
      <div className="flex items-center gap-3 border-b border-[var(--cs-line-soft)] px-4 py-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">Pierre</h1>
            <span className="cs-status" data-testid="pierre-framing">Employé IA RH</span>
          </div>
          <p className="text-[0.78rem] text-[var(--cs-ink-3)]">{VIEW_TITLE[view]} · équipe RH opérationnelle</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => cockpit.refresh()} aria-label="Rafraîchir" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/60 text-[var(--cs-ink-2)]"><RefreshCw className={cn("h-4 w-4", cockpit.refreshing && "animate-spin")} /></button>
          <button type="button" onClick={() => setComposerOpen(true)} className="cs-liquid-button cs-liquid-button--primary"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Confier une mission</span></button>
        </div>
      </div>
      <div className="cos-main-scroll" data-testid="pierre-view-body">{body}</div>
    </>
  );

  // ── Panneau contexte : validations + mission active + autonomie ──────────────
  const context = (
    <div className="space-y-3" data-testid="pierre-context">
      <div className="cs-card cs-card-tight">
        <p className="text-[0.72rem] text-[var(--cs-ink-3)]">Validations en attente</p>
        <p className="text-[1.4rem] font-semibold text-[var(--cs-ink-1)]">{cockpit.pendingValidations.length}</p>
      </div>
      <div className="cs-card cs-card-tight">
        <p className="text-[0.72rem] text-[var(--cs-ink-3)]">Mission en cours</p>
        <p className="text-[0.9rem] font-medium text-[var(--cs-ink-1)]">{cockpit.missions.find((m) => m.status === "in_progress" || m.status === "awaiting_approval")?.title ?? "—"}</p>
      </div>
      <a href="/cockpit/pierre/settings" className="cs-card cs-card-tight block">
        <p className="text-[0.72rem] text-[var(--cs-ink-3)]">Autonomie</p>
        <p className="text-[0.86rem] font-medium text-[var(--cs-violet)]">Régler ce que Pierre fait seul</p>
      </a>
      <a href="/cockpit/pierre/documents" className="cs-card cs-card-tight block">
        <p className="text-[0.72rem] text-[var(--cs-ink-3)]">Preuves / documents</p>
        <p className="text-[0.9rem] font-medium text-[var(--cs-ink-1)]">{cockpit.artifacts.length} livrable(s)</p>
      </a>
    </div>
  );

  return (
    <>
      <CloneOsAppShell companyLabel={null} main={main} context={context} contextTitle="RH — maintenant" surfaceTestId="pierre-cockpit-console" />
      <MissionComposer open={composerOpen} mutating={cockpit.mutating} initialValue={missionSeed} onClose={() => setComposerOpen(false)} onCreate={cockpit.createMission} />
      {cockpit.activeMissionId ? (
        <MissionDetailDrawer detail={cockpit.missionDetail} loading={cockpit.loadingDetail} mutating={cockpit.mutating} canCancel={cockpit.permissions.canCancelMission} onClose={() => cockpit.selectMission(null)} onDecide={cockpit.decideValidation} onCancelMission={cockpit.cancelMission} />
      ) : null}
    </>
  );
}
