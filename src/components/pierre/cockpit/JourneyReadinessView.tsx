"use client";

// P9.6 — Vue « Parcours » du cockpit : indicateur de PRÉPARATION de bout en bout.
// Résume — pour l'humain — l'état RÉEL remonté par P8/le cockpit (entreprise, autonomie,
// mission en cours, validations requises, preuves, dernier résultat). Ce n'est PAS un
// planificateur RH : aucune décision, aucune logique métier. La logique RH reste dans P8.
// Entreprise + autonomie : lus via GET /api/assistant/autonomy (colonne P8). Le reste : props
// dérivées des données V1 déjà chargées par le hook cockpit.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Clock3, Sparkles, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeJourneyReadiness, type JourneyReadiness, type ReadinessState } from "@/lib/clonestore/pierre-journey/journey-status";
import type { CockpitMissionSummary, CockpitArtifact } from "@/lib/client-cockpit";
import { SectionShell } from "./primitives";
import type { CockpitView } from "./shell-nav";

interface AutonomySignal {
  companyResolved: boolean;
  productModeId: string | null;
  label: string | null;
}

function isTerminal(status: CockpitMissionSummary["status"]): boolean {
  return status === "done" || status === "cancelled";
}

const STATE_UI: Record<ReadinessState, { chip: string; icon: typeof CheckCircle2; label: string }> = {
  done: { chip: "cs-status cs-status--success", icon: CheckCircle2, label: "OK" },
  pending: { chip: "cs-status cs-status--warn", icon: Clock3, label: "En attente" },
  todo: { chip: "cs-status", icon: CircleDashed, label: "À faire" },
  blocked: { chip: "cs-status cs-status--danger", icon: AlertTriangle, label: "Bloqué" },
};

export function JourneyReadinessView({
  missions,
  artifacts,
  pendingValidations,
  onOpenMission,
  onGoView,
  onCompose,
}: {
  missions: readonly CockpitMissionSummary[];
  artifacts: readonly CockpitArtifact[];
  pendingValidations: number;
  onOpenMission: (id: string) => void;
  onGoView: (v: CockpitView) => void;
  onCompose: () => void;
}) {
  const [autonomy, setAutonomy] = useState<AutonomySignal | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/assistant/autonomy", { headers: { accept: "application/json" } });
        const data = await res.json().catch(() => null);
        if (!alive || !data?.ok) { if (alive) setAutonomy({ companyResolved: false, productModeId: null, label: null }); return; }
        const id = data.current?.productModeId ?? null;
        const label = Array.isArray(data.modes) ? (data.modes.find((m: { id: string }) => m.id === id)?.label ?? null) : null;
        setAutonomy({ companyResolved: !!data.companyResolved, productModeId: id, label });
      } catch {
        if (alive) setAutonomy({ companyResolved: false, productModeId: null, label: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  const activeMission = useMemo(
    () => missions.find((m) => !isTerminal(m.status)) ?? null,
    [missions],
  );
  const latestResult = useMemo(
    () => missions.find((m) => m.status === "done") ?? null,
    [missions],
  );

  const readiness: JourneyReadiness | null = useMemo(() => {
    if (!autonomy) return null;
    return computeJourneyReadiness({
      companyResolved: autonomy.companyResolved,
      autonomy: autonomy.companyResolved && autonomy.productModeId
        ? { productModeId: autonomy.productModeId, label: autonomy.label ?? autonomy.productModeId }
        : null,
      missionCount: missions.length,
      activeMission: activeMission ? { id: activeMission.id, title: activeMission.title, statusLabel: activeMission.statusView.label } : null,
      pendingValidations,
      evidenceCount: artifacts.length,
      latestResult: latestResult ? { id: latestResult.id, title: latestResult.title, statusLabel: latestResult.statusView.label } : null,
    });
  }, [autonomy, missions.length, activeMission, latestResult, pendingValidations, artifacts.length]);

  const levelChip =
    readiness?.level === "operating" ? "cs-status cs-status--success"
    : readiness?.level === "onboarding" ? "cs-status cs-status--info"
    : "cs-status cs-status--warn";
  const levelLabel =
    readiness?.level === "operating" ? "Opérationnel"
    : readiness?.level === "onboarding" ? "Prêt à démarrer"
    : "À rattacher";

  return (
    <div data-tour-id="pierre-journey" aria-live="polite" className="space-y-4">
      <SectionShell
        eyebrow="Parcours"
        title="Où en est Pierre pour votre entreprise"
        description="Un résumé honnête de l'état réel — de l'entreprise au résultat. Pierre reste gouverné par ses règles ; ceci n'est qu'un tableau de bord."
        right={readiness ? <span className={levelChip} data-testid="journey-level">{levelLabel}</span> : null}
      >
        {!readiness ? (
          <p className="text-[0.86rem] text-[var(--cs-ink-3)]">Chargement de l'état du parcours…</p>
        ) : (
          <>
            <p className="text-[0.92rem] font-medium text-[var(--cs-ink-1)]" data-testid="journey-summary">{readiness.summary}</p>

            <ol className="space-y-2">
              {readiness.items.map((item) => {
                const ui = STATE_UI[item.state];
                const Icon = ui.icon;
                return (
                  <li
                    key={item.id}
                    data-journey-item={item.id}
                    data-journey-state={item.state}
                    className="flex items-start gap-3 rounded-[1rem] border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3"
                  >
                    <Icon className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      item.state === "done" ? "text-[var(--cs-success)]"
                      : item.state === "pending" ? "text-[var(--cs-warn)]"
                      : item.state === "blocked" ? "text-[var(--cs-danger)]"
                      : "text-[var(--cs-ink-4)]",
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{item.label}</span>
                        <span className={ui.chip}>{ui.label}</span>
                      </div>
                      <p className="text-[0.82rem] leading-6 text-[var(--cs-ink-3)]">{item.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Actions — pontent vers les surfaces existantes ; aucune logique RH ici. */}
            <div className="flex flex-wrap gap-2 pt-1">
              {readiness.canOperate ? (
                <button type="button" onClick={onCompose} className="cs-liquid-button cs-liquid-button--primary">
                  <Sparkles className="h-4 w-4" /><span>Confier une mission</span>
                </button>
              ) : (
                <button type="button" onClick={() => onGoView("autonomy")} className="cs-liquid-button">
                  <SlidersHorizontal className="h-4 w-4" /><span>Rattacher / configurer</span>
                </button>
              )}
              <button type="button" onClick={() => onGoView("autonomy")} className="cs-liquid-button">
                <SlidersHorizontal className="h-4 w-4" /><span>Régler l'autonomie</span>
              </button>
              {pendingValidations > 0 ? (
                <button type="button" onClick={() => onGoView("validations")} className="cs-liquid-button">
                  <Clock3 className="h-4 w-4" /><span>Voir les validations ({pendingValidations})</span>
                </button>
              ) : null}
              {activeMission ? (
                <button type="button" onClick={() => onOpenMission(activeMission.id)} className="cs-liquid-button">
                  <ArrowRight className="h-4 w-4" /><span>Ouvrir la mission en cours</span>
                </button>
              ) : latestResult ? (
                <button type="button" onClick={() => onOpenMission(latestResult.id)} className="cs-liquid-button">
                  <ArrowRight className="h-4 w-4" /><span>Voir le dernier résultat</span>
                </button>
              ) : null}
            </div>
          </>
        )}
      </SectionShell>
    </div>
  );
}
