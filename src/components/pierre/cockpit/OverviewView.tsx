"use client";

// P9.3 — Vue d'ensemble : « que fait Pierre, que dois-je faire maintenant ? ».
// 100 % données réelles via la couche client-cockpit. Aucun chiffre fictif.

import { ArrowRight, Briefcase, CheckCircle2, FileText, Users2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitAttentionItem, CockpitMissionSummary, CockpitOverview } from "@/lib/client-cockpit";
import { EmptyView, ProgressBar, RelativeTime, SectionShell, StatusChip, UrgencyBadge } from "./primitives";
import type { CockpitView } from "./shell-nav";

const ATTN_ACCENT: Record<CockpitAttentionItem["urgency"], string> = {
  critical: "border-l-[var(--cs-danger)]",
  high: "border-l-[var(--cs-warn)]",
  normal: "border-l-[var(--cs-violet)]",
  low: "border-l-[var(--cs-line-soft)]",
};

export function OverviewView({
  overview,
  onSelectMission,
  onGoView,
  onCompose,
}: {
  overview: CockpitOverview;
  onSelectMission: (id: string) => void;
  onGoView: (v: CockpitView) => void;
  onCompose: () => void;
}) {
  const attentionAction = (a: CockpitAttentionItem) => {
    if (a.kind === "validation") return onGoView("validations");
    if (a.kind === "document_review") return onGoView("documents");
    if (a.missionId) return onSelectMission(a.missionId);
    return onGoView("missions");
  };

  if (overview.isEmpty) {
    return (
      <SectionShell eyebrow="Vue d'ensemble" tourId="pierre-attention">
        <EmptyView
          title="Pierre n'a aucune mission active pour le moment."
          text="Confiez-lui une première mission RH — préparer un contrat, relancer un candidat, organiser un onboarding — et suivez son travail ici."
          action={
            <button type="button" onClick={onCompose} className="cs-liquid-button cs-liquid-button--primary">
              <ArrowRight className="h-4 w-4" /><span>Confier une mission à Pierre</span>
            </button>
          }
        />
      </SectionShell>
    );
  }

  return (
    <div className="space-y-5">
      {/* À traiter maintenant */}
      <SectionShell
        eyebrow="À traiter maintenant"
        description="Les éléments qui attendent une décision de votre part."
        tourId="pierre-attention"
        right={<span className={cn("cs-status", overview.health.tone === "danger" ? "cs-status--danger" : overview.health.tone === "warning" ? "cs-status--warn" : "cs-status--success")}>{overview.health.label}</span>}
      >
        {overview.attention.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-[var(--cs-success-bg)] px-4 py-3 text-[0.86rem] text-[var(--cs-success)]">
            <CheckCircle2 className="h-4 w-4" />
            {overview.health.summary}
          </div>
        ) : (
          <ul className="grid gap-3">
            {overview.attention.map((a) => (
              <li key={a.id}>
                <div className={cn("cs-card cs-card-tight border-l-4", ATTN_ACCENT[a.urgency])}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.92rem] font-semibold text-[var(--cs-ink-1)]">{a.title}</p>
                        <UrgencyBadge urgency={a.urgency} />
                      </div>
                      {a.context ? <p className="text-[0.82rem] leading-5 text-[var(--cs-ink-3)]">{a.context}</p> : null}
                      <div className="flex flex-wrap items-center gap-3 text-[0.76rem] text-[var(--cs-ink-4)]">
                        {a.employee ? <span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />{a.employee.name}</span> : null}
                        <RelativeTime iso={a.ageIso} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => attentionAction(a)}
                      className="cs-liquid-button cs-liquid-button--primary shrink-0"
                    >
                      <span>{a.action.label}</span><ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      {/* Pierre travaille actuellement sur */}
      <SectionShell eyebrow="Pierre travaille actuellement sur" tourId="pierre-missions">
        {overview.inProgress.length === 0 ? (
          <p className="text-[0.85rem] text-[var(--cs-ink-4)]">Aucune mission en cours.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {overview.inProgress.map((m) => (
              <li key={m.id}>
                <MissionMiniCard mission={m} onOpen={() => onSelectMission(m.id)} />
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      {/* Terminé récemment */}
      {overview.recentlyDone.length > 0 && (
        <SectionShell eyebrow="Terminé récemment">
          <ul className="grid gap-2">
            {overview.recentlyDone.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelectMission(m.id)}
                  className="cs-card cs-card-tight cs-hover-lift flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--cs-success)]" />
                    <span className="truncate text-[0.88rem] text-[var(--cs-ink-2)]">{m.title}</span>
                  </span>
                  <RelativeTime iso={m.createdAt} className="shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </SectionShell>
      )}

      {/* Indicateurs réels */}
      <SectionShell eyebrow="En un coup d'œil">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Indicator icon={<Briefcase className="h-4 w-4" />} label="Missions en cours" value={overview.indicators.missionsInProgress} />
          <Indicator icon={<ShieldAlert className="h-4 w-4" />} label="À valider" value={overview.indicators.validationsPending} tone={overview.indicators.validationsPending > 0 ? "warn" : undefined} />
          <Indicator icon={<FileText className="h-4 w-4" />} label="Documents" value={overview.indicators.documentsProduced} />
          <Indicator icon={<Users2 className="h-4 w-4" />} label="Salariés concernés" value={overview.indicators.employeesConcerned} />
          <Indicator icon={<AlertOpen />} label="Incidents ouverts" value={overview.indicators.incidentsOpen} tone={overview.indicators.incidentsOpen > 0 ? "danger" : undefined} />
        </div>
      </SectionShell>
    </div>
  );
}

function AlertOpen() {
  return <ShieldAlert className="h-4 w-4" />;
}

function Indicator({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "warn" | "danger" }) {
  return (
    <div className="cs-card cs-card-tight">
      <div className="flex flex-col gap-1">
        <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--cs-line-soft)] bg-white/58",
          tone === "danger" ? "text-[var(--cs-danger)]" : tone === "warn" ? "text-[var(--cs-warn)]" : "text-[var(--cs-violet)]")}>
          {icon}
        </span>
        <span className="text-[1.35rem] font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)] tabular-nums">{value}</span>
        <span className="text-[0.74rem] leading-4 text-[var(--cs-ink-4)]">{label}</span>
      </div>
    </div>
  );
}

function MissionMiniCard({ mission, onOpen }: { mission: CockpitMissionSummary; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="cs-card cs-card-tight cs-hover-lift block w-full text-left">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{mission.title}</p>
          <StatusChip view={mission.statusView} />
        </div>
        {mission.employee ? <p className="text-[0.78rem] text-[var(--cs-ink-4)]">{mission.employee.name}</p> : null}
        <ProgressBar value={mission.progress} label={`Progression de ${mission.title}`} />
        <div className="flex items-center justify-between text-[0.76rem] text-[var(--cs-ink-4)]">
          <span>{mission.tasksDone}/{mission.tasksTotal} tâches</span>
          <span className="inline-flex items-center gap-1 font-medium text-[var(--cs-violet)]">{mission.nextAction.label}<ArrowRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </button>
  );
}
