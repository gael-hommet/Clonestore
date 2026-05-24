// src/app/agents/pierre/use/components/PierreCockpitShell.tsx
// Main layout shell — left rail + center + right panel — Pierre Cockpit B31.1.
// Handles workspace routing, responsive layout, accessibility.

"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileDown,
  FileText,
  Fingerprint,
  FlaskConical,
  History,
  LogIn,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { PierreCockpitWorkspace } from "@/lib/pierre/cockpit/types";
import type { PierreCockpitState } from "../hooks/usePierreCockpit";
import { cn } from "@/lib/utils";

import { PierreCommandCenter } from "./PierreCommandCenter";
import { PierreWorkBoard } from "./PierreWorkBoard";
import { PierreValidationCenter } from "./PierreValidationCenter";
import { PierreArtifactStudio } from "./PierreArtifactStudio";
import { PierreDocumentStudio } from "./PierreDocumentStudio";
import { PierreEmployeeFilesPanel } from "./PierreEmployeeFilesPanel";
import { PierreCloneADNPanel } from "./PierreCloneADNPanel";
import { PierreTraceTimeline } from "./PierreTraceTimeline";
import { PierreValuePanel } from "./PierreValuePanel";
import { PierreScenariosPanel } from "./PierreScenariosPanel";
import { PierreMobileActionBar } from "./PierreMobileActionBar";

type CockpitHook = PierreCockpitState;

// ── Auth gate ───────────────────────────────────────────────────

function AuthGate({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "var(--cs-bg)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--cs-surface-strong)", border: "1px solid var(--cs-line)" }}
      >
        <LogIn className="h-7 w-7" style={{ color: "var(--cs-ink-3)" }} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--cs-ink-1)" }}>
          Connexion requise
        </h2>
        <p className="mt-2 max-w-xs text-sm" style={{ color: "var(--cs-ink-4)" }}>
          Connectez-vous à votre compte CloneStore pour utiliser Pierre.
        </p>
      </div>
      <div className="flex w-full max-w-[220px] flex-col gap-2">
        <a
          href="/login?redirect=/agents/pierre/use"
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Se connecter
        </a>
        <button
          onClick={() => { void handleRetry(); }}
          disabled={retrying}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: "var(--cs-surface-strong)",
            color: "var(--cs-ink-2)",
            border: "1px solid var(--cs-line)",
          }}
        >
          <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} aria-hidden="true" />
          {retrying ? "Vérification…" : "Réessayer"}
        </button>
        <a
          href="/profile"
          className="flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "transparent",
            color: "var(--cs-ink-4)",
          }}
        >
          Retour à Mon CloneStore
        </a>
      </div>
    </div>
  );
}

// ── Rail nav items ──────────────────────────────────────────────

type NavItem = {
  workspace: PierreCockpitWorkspace;
  icon: React.ReactNode;
  label: string;
  badge?: (c: CockpitHook) => number;
};

const NAV_PRIMARY: NavItem[] = [
  { workspace: "mission",     icon: <Sparkles className="h-4 w-4" />,    label: "Mission" },
  { workspace: "validations", icon: <ShieldCheck className="h-4 w-4" />, label: "Validations", badge: (c) => c.validations.length },
  { workspace: "documents",   icon: <FileText className="h-4 w-4" />,    label: "Documents" },
  { workspace: "emails",      icon: <Mail className="h-4 w-4" />,        label: "Emails" },
  { workspace: "pdf",         icon: <FileDown className="h-4 w-4" />,    label: "PDF" },
  {
    workspace: "employees",
    icon: <Users className="h-4 w-4" />,
    label: "Employés",
    badge: (c) => c.employees.filter((e) => e.riskLevel === "high" || e.riskLevel === "critical").length,
  },
  { workspace: "cloneadn", icon: <Fingerprint className="h-4 w-4" />, label: "CloneADN" },
  { workspace: "trace",    icon: <History className="h-4 w-4" />,      label: "Trace" },
  { workspace: "value",    icon: <TrendingUp className="h-4 w-4" />,   label: "Valeur" },
];

const NAV_ADVANCED: NavItem[] = [
  { workspace: "scenarios", icon: <FlaskConical className="h-4 w-4" />, label: "Scénarios" },
  { workspace: "settings",  icon: <Settings2 className="h-4 w-4" />,    label: "Paramètres" },
];

// ── Workspace title map ─────────────────────────────────────────

const WORKSPACE_TITLES: Record<PierreCockpitWorkspace, string> = {
  mission:     "Centre de Mission",
  validations: "Validations",
  documents:   "Documents",
  emails:      "Emails",
  pdf:         "PDF",
  employees:   "Fiches Employés",
  cloneadn:    "CloneADN",
  trace:       "Chronologie",
  value:       "Valeur & ROI",
  scenarios:   "Scénarios",
  settings:    "Paramètres",
};

// ── Nav button ──────────────────────────────────────────────────

function NavButton({
  item,
  active,
  collapsed,
  cockpit,
  onOpen,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  cockpit: CockpitHook;
  onOpen: () => void;
}) {
  const badgeCount = item.badge ? item.badge(cockpit) : 0;

  return (
    <button
      onClick={onOpen}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        collapsed ? "justify-center" : "",
        active ? "font-semibold" : "hover:bg-black/5",
      )}
      style={
        active
          ? { background: "rgba(255,255,255,0.72)", color: "var(--cs-ink-1)" }
          : { color: "var(--cs-ink-3)" }
      }
      title={collapsed ? item.label : undefined}
    >
      <span className="shrink-0" aria-hidden="true">
        {item.icon}
      </span>
      {!collapsed && (
        <span className="flex-1 truncate text-sm">{item.label}</span>
      )}
      {badgeCount > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
            collapsed ? "absolute right-1 top-1" : "",
          )}
          style={{ background: "var(--cs-danger)", color: "#fff" }}
          aria-label={`${badgeCount} en attente`}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}

// ── Left rail ───────────────────────────────────────────────────

function LeftRail({
  cockpit,
  collapsed,
  onCollapse,
}: {
  cockpit: CockpitHook;
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
}) {
  const { activeWorkspace, openWorkspace } = cockpit;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[220px]",
      )}
      style={{
        background: "rgba(245,240,230,0.82)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderRight: "1px solid var(--cs-line)",
      }}
      aria-label="Navigation Pierre"
    >
      {/* Logo / Brand */}
      <div
        className="flex h-14 shrink-0 items-center gap-2.5 border-b px-3"
        style={{ borderColor: "var(--cs-line)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black"
          style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
          aria-hidden="true"
        >
          P
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight" style={{ color: "var(--cs-ink-1)" }}>
              Pierre
            </p>
            <p className="text-[10px] leading-tight" style={{ color: "var(--cs-ink-4)" }}>
              HR Cockpit
            </p>
          </div>
        )}
        <button
          onClick={() => onCollapse(!collapsed)}
          className="ml-auto shrink-0 rounded-lg p-1 transition-opacity hover:opacity-70"
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
          style={{ color: "var(--cs-ink-4)" }}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-2" aria-label="Espaces de travail">
        {NAV_PRIMARY.map((item) => (
          <NavButton
            key={item.workspace}
            item={item}
            active={activeWorkspace === item.workspace}
            collapsed={collapsed}
            cockpit={cockpit}
            onOpen={() => openWorkspace(item.workspace)}
          />
        ))}

        <div className="my-2 border-t" style={{ borderColor: "var(--cs-line)" }} />

        {!collapsed && (
          <p
            className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--cs-ink-4)" }}
          >
            Avancé
          </p>
        )}

        {NAV_ADVANCED.map((item) => (
          <NavButton
            key={item.workspace}
            item={item}
            active={activeWorkspace === item.workspace}
            collapsed={collapsed}
            cockpit={cockpit}
            onOpen={() => openWorkspace(item.workspace)}
          />
        ))}
      </nav>

      {/* RC status bar */}
      {cockpit.rcStatus && (
        <div className="shrink-0 border-t px-2 py-2" style={{ borderColor: "var(--cs-line)" }}>
          <div
            className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5"
            style={{
              background: cockpit.rcStatus.canStartCockpit ? "var(--cs-success-bg)" : "var(--cs-warn-bg)",
              color: cockpit.rcStatus.canStartCockpit ? "var(--cs-success)" : "var(--cs-warn)",
            }}
          >
            {cockpit.rcStatus.canStartCockpit ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            {!collapsed && (
              <p className="truncate text-[10px] font-semibold">
                RC · {cockpit.rcStatus.score}%
                {cockpit.rcStatus.blockingIssues > 0 && (
                  <span> · {cockpit.rcStatus.blockingIssues} pb.</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Right info panel ────────────────────────────────────────────

function RightPanel({ cockpit }: { cockpit: CockpitHook }) {
  const { aiStatus, rcStatus, employees, validations } = cockpit;

  return (
    <aside
      className="hidden xl:flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-l p-4"
      style={{ background: "var(--cs-surface-soft)", borderColor: "var(--cs-line)" }}
      aria-label="Informations contextuelles"
    >
      {/* AI Status */}
      {aiStatus && (
        <div
          className="flex items-center gap-2 rounded-xl p-3"
          style={{ background: aiStatus.configured ? "var(--cs-success-bg)" : "var(--cs-warn-bg)" }}
        >
          {aiStatus.configured ? (
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cs-success)" }} aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cs-warn)" }} aria-hidden="true" />
          )}
          <div>
            <p
              className="text-xs font-semibold"
              style={{ color: aiStatus.configured ? "var(--cs-success)" : "var(--cs-warn)" }}
            >
              {aiStatus.configured ? "IA opérationnelle" : "IA non configurée"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--cs-ink-4)" }}>
              {aiStatus.providersCount} fournisseur{aiStatus.providersCount !== 1 ? "s" : ""} ·{" "}
              {aiStatus.contractsCount} contrat{aiStatus.contractsCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div
        className="rounded-xl p-3"
        style={{ background: "var(--cs-surface-strong)", border: "1px solid var(--cs-line)" }}
      >
        <p
          className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--cs-ink-4)" }}
        >
          Vue d'ensemble
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--cs-ink-3)" }}>Employés</span>
            <span className="text-xs font-semibold" style={{ color: "var(--cs-ink-1)" }}>{employees.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--cs-ink-3)" }}>Validations</span>
            <span
              className="text-xs font-semibold"
              style={{ color: validations.length > 0 ? "var(--cs-warn)" : "var(--cs-ink-1)" }}
            >
              {validations.length}
            </span>
          </div>
          {cockpit.activeMission && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--cs-ink-3)" }}>Tâches</span>
                <span className="text-xs font-semibold" style={{ color: "var(--cs-ink-1)" }}>
                  {cockpit.tasks.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--cs-ink-3)" }}>Documents</span>
                <span className="text-xs font-semibold" style={{ color: "var(--cs-ink-1)" }}>
                  {cockpit.documents.length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RC summary */}
      {rcStatus && (
        <div
          className="rounded-xl p-3"
          style={{ background: rcStatus.canStartCockpit ? "var(--cs-success-bg)" : "var(--cs-warn-bg)" }}
        >
          <p
            className="text-xs font-semibold"
            style={{ color: rcStatus.canStartCockpit ? "var(--cs-success)" : "var(--cs-warn)" }}
          >
            Release Candidate · {rcStatus.score}%
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--cs-ink-4)" }}>
            {rcStatus.status}
          </p>
          {rcStatus.recommendation && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--cs-ink-3)" }}>
              {rcStatus.recommendation}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

// ── Workspace renderer ──────────────────────────────────────────

function WorkspaceContent({ cockpit }: { cockpit: CockpitHook }) {
  const { activeWorkspace } = cockpit;

  switch (activeWorkspace) {
    case "mission":
      return (
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 h-full">
          <div
            className="flex flex-col border-r overflow-hidden"
            style={{ borderColor: "var(--cs-line)" }}
          >
            <PierreCommandCenter
              messages={cockpit.messages}
              inputDraft={cockpit.inputDraft}
              loadingSubmit={cockpit.loadingSubmit}
              onInputChange={cockpit.setInputDraft}
              onSubmit={(input) => { void cockpit.submitMission(input); }}
            />
          </div>
          <div className="overflow-y-auto p-4">
            <PierreWorkBoard
              mission={cockpit.activeMission}
              tasks={cockpit.tasks}
              loadingMission={cockpit.loadingMission}
              taskActions={{
                onApprove: cockpit.approveTask,
                onCancel: cockpit.cancelTask,
                onRun: cockpit.runTask,
              }}
            />
          </div>
        </div>
      );

    case "validations":
      return (
        <div className="overflow-y-auto p-4">
          <PierreValidationCenter
            validations={cockpit.validations}
            onApprove={cockpit.approveTask}
            onCancel={cockpit.cancelTask}
          />
        </div>
      );

    case "documents":
    case "emails":
    case "pdf":
      return (
        <div className="overflow-y-auto p-4">
          <PierreArtifactStudio documents={cockpit.documents} />
        </div>
      );

    case "employees":
      return (
        <div className="overflow-y-auto p-4">
          <PierreEmployeeFilesPanel
            employees={cockpit.employees}
            loading={cockpit.loadingEmployees}
            onSelectEmployee={cockpit.selectEmployeeFile}
          />
        </div>
      );

    case "cloneadn":
      return (
        <div className="overflow-y-auto p-4">
          <PierreCloneADNPanel cloneADN={cockpit.cloneADN} onUpdate={cockpit.updateCloneADN} />
        </div>
      );

    case "trace":
      return (
        <div className="overflow-y-auto p-4">
          <PierreTraceTimeline messages={cockpit.messages} />
        </div>
      );

    case "value":
      return (
        <div className="overflow-y-auto p-4">
          <PierreValuePanel roi={cockpit.roi} />
        </div>
      );

    case "scenarios":
      return (
        <div className="overflow-y-auto p-4">
          <PierreScenariosPanel
            scenarios={cockpit.scenarios}
            onRunScenario={cockpit.runScenario}
            onRunSuite={cockpit.runScenarioSuite}
            loadingScenario={cockpit.loadingScenario}
          />
        </div>
      );

    case "settings":
      return (
        <div className="overflow-y-auto p-4">
          <PierreDocumentStudio templates={cockpit.documentTemplates} onPreview={cockpit.previewDocument} />
        </div>
      );

    default:
      return null;
  }
}

// ── Global error banner ─────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
      style={{ background: "var(--cs-danger-bg)", color: "var(--cs-danger)" }}
      role="alert"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {message}
      </span>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Fermer l'erreur"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Main Shell ──────────────────────────────────────────────────

export function PierreCockpitShell({ cockpit }: { cockpit: CockpitHook }) {
  return (
    <div
      className="flex w-full overflow-hidden"
      style={{
        height: "calc(100dvh - 70px)",
        background: "var(--cs-bg)",
        color: "var(--cs-ink-1)",
      }}
    >
      {cockpit.authRequired ? (
        <AuthGate onRetry={cockpit.retryAuth} />
      ) : (
        <>
          {/* Left rail */}
          <LeftRail
            cockpit={cockpit}
            collapsed={cockpit.sidebarCollapsed}
            onCollapse={cockpit.setSidebarCollapsed}
          />

          {/* Center */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {/* Header bar */}
            <header
              className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
              style={{ borderColor: "var(--cs-line)", background: "var(--cs-surface-strong)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black md:hidden"
                  style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
                  aria-hidden="true"
                >
                  P
                </div>
                <h1 className="text-sm font-semibold" style={{ color: "var(--cs-ink-1)" }}>
                  {WORKSPACE_TITLES[cockpit.activeWorkspace]}
                </h1>
                {cockpit.activeMission && (
                  <span
                    className="hidden max-w-[200px] truncate text-xs sm:inline"
                    style={{ color: "var(--cs-ink-4)" }}
                  >
                    · {cockpit.activeMission.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {cockpit.validations.length > 0 && (
                  <button
                    onClick={() => cockpit.openWorkspace("validations")}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: "var(--cs-warn-bg)", color: "var(--cs-warn)" }}
                    aria-label={`${cockpit.validations.length} validation(s) en attente`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {cockpit.validations.length}
                  </button>
                )}
                <button
                  onClick={() => { void cockpit.refreshAll(); }}
                  className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
                  style={{ color: "var(--cs-ink-4)" }}
                  aria-label="Rafraîchir les données"
                  title="Rafraîchir"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Error banner (never shows auth errors — those render AuthGate) */}
            {cockpit.globalError && (
              <ErrorBanner
                message={cockpit.globalError}
                onDismiss={() => cockpit.setGlobalError(null)}
              />
            )}

            {/* Workspace content */}
            <div className="flex-1 overflow-hidden pb-14 md:pb-0">
              <WorkspaceContent cockpit={cockpit} />
            </div>
          </main>

          {/* Right panel (desktop xl) */}
          <RightPanel cockpit={cockpit} />

          {/* Mobile bottom nav */}
          <PierreMobileActionBar
            activeWorkspace={cockpit.activeWorkspace}
            onWorkspace={cockpit.openWorkspace}
          />
        </>
      )}
    </div>
  );
}
