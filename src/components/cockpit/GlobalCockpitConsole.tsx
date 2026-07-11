"use client";

// src/components/cockpit/GlobalCockpitConsole.tsx
// P12 §7 — Global Cockpit : centre de commande de la main-d'œuvre IA (company-wide, dirigeant).
// Premier écran = surface de commande CloneOS (§5). Le panneau de contexte agrège la main-d'œuvre
// + les opérations (missions/validations/blocages/résultats) sur DONNÉES V1 RÉELLES (réutilise le
// hook cockpit — aucune logique RH réimplémentée). N'est PAS le cockpit de Pierre (company-wide).

import Link from "next/link";
import { Bot, ArrowRight, ShieldAlert, ClipboardList, CheckCircle2, Activity } from "lucide-react";
import { CloneOsAppShell } from "@/components/cloneos/CloneOsAppShell";
import { CloneOsCommandSurface } from "@/components/cloneos/CloneOsCommandSurface";
import { useOperationalCockpit } from "@/app/agents/pierre/use/hooks/useOperationalCockpit";
import { CLONEOS_ROUTES } from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

export function GlobalCockpitConsole({ companyLabel }: { companyLabel?: string | null }) {
  const cockpit = useOperationalCockpit();
  const inProgress = cockpit.missions.filter((m) => m.status === "in_progress" || m.status === "awaiting_approval").length;
  const blocked = cockpit.missions.filter((m) => m.status === "blocked").length;
  const pending = cockpit.pendingValidations.length;
  const recentDone = cockpit.missions.find((m) => m.status === "done") ?? null;
  const healthTone = cockpit.overview.health.tone;

  const context = (
    <div className="space-y-3" data-testid="global-context">
      {/* Main-d'œuvre IA */}
      <div>
        <p className="cs-eyebrow mb-1.5">Main-d'œuvre IA</p>
        <Link href={CLONEOS_ROUTES.pierre} className="cs-card cs-card-tight flex items-center gap-2" data-testid="workforce-pierre">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]"><Bot className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.86rem] font-medium text-[var(--cs-ink-1)]">Pierre — employé IA RH</span>
            <span className="block text-[0.72rem] text-[var(--cs-ink-3)]">{inProgress > 0 ? "En cours de travail" : "Disponible"}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-[var(--cs-ink-4)]" />
        </Link>
        <p className="mt-1 text-[0.7rem] text-[var(--cs-ink-4)]">D'autres employés IA rejoindront votre effectif.</p>
      </div>

      {/* Opérations */}
      <div>
        <p className="cs-eyebrow mb-1.5">Opérations</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="cs-card cs-card-tight"><ClipboardList className="h-4 w-4 text-[var(--cs-violet)]" /><p className="mt-1 text-[1.3rem] font-semibold text-[var(--cs-ink-1)]">{inProgress}</p><p className="text-[0.68rem] text-[var(--cs-ink-3)]">Missions en cours</p></div>
          <Link href={CLONEOS_ROUTES.pierreValidations} className="cs-card cs-card-tight"><ShieldAlert className="h-4 w-4 text-[var(--cs-warn)]" /><p className="mt-1 text-[1.3rem] font-semibold text-[var(--cs-ink-1)]">{pending}</p><p className="text-[0.68rem] text-[var(--cs-ink-3)]">Validations en attente</p></Link>
          <div className="cs-card cs-card-tight"><ShieldAlert className="h-4 w-4 text-[var(--cs-danger)]" /><p className="mt-1 text-[1.3rem] font-semibold text-[var(--cs-ink-1)]">{blocked}</p><p className="text-[0.68rem] text-[var(--cs-ink-3)]">Blocages</p></div>
          <div className="cs-card cs-card-tight"><Activity className="h-4 w-4 text-[var(--cs-violet)]" /><p className="mt-1 text-[0.82rem] font-medium text-[var(--cs-ink-1)]">{healthTone === "danger" ? "Action requise" : healthTone === "warning" ? "À surveiller" : "Sain"}</p><p className="text-[0.68rem] text-[var(--cs-ink-3)]">Santé système</p></div>
        </div>
      </div>

      {/* Résultat récent */}
      <div>
        <p className="cs-eyebrow mb-1.5">Résultat récent</p>
        {recentDone ? (
          <div className="cs-card cs-card-tight flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--cs-success)]" /><span className="text-[0.84rem] text-[var(--cs-ink-1)]">{recentDone.title}</span></div>
        ) : (
          <p className="text-[0.78rem] text-[var(--cs-ink-4)]">Aucun résultat abouti pour l'instant.</p>
        )}
      </div>
    </div>
  );

  return (
    <CloneOsAppShell
      companyLabel={companyLabel}
      main={<CloneOsCommandSurface />}
      context={context}
      contextTitle="Ce qui compte maintenant"
      surfaceTestId="global-cockpit-console"
    />
  );
}
