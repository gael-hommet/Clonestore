"use client";

// B48 — /profile/launch-readiness — Final Launch Readiness Dashboard
// Internal premium dashboard. Crème/ivoire palette, glass cards.

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, RefreshCw, Shield, Zap, Scale, CreditCard, Globe, Lock } from "lucide-react";
import type { LaunchReadinessStatus, LaunchSeverity, LaunchSurface } from "../../../lib/launch-readiness/types";
import { buildB48FinalVerdict } from "../../../lib/launch-readiness/launch-verdict";
import { buildAllReadinessReports, getBlockingChecks } from "../../../lib/launch-readiness/readiness-checks";
import { getBlocRegistrySummary } from "../../../lib/launch-readiness/block-registry";

// ── Status helpers ─────────────────────────────────────────────────────────────

function statusIcon(status: LaunchReadinessStatus) {
  switch (status) {
    case "ready":               return <CheckCircle2 size={16} className="text-emerald-600" />;
    case "ready_with_warnings": return <AlertTriangle size={16} className="text-amber-500" />;
    case "blocked":             return <XCircle size={16} className="text-red-500" />;
    case "disabled":            return <XCircle size={16} className="text-stone-400" />;
    default:                    return <ChevronRight size={16} className="text-stone-400" />;
  }
}

function statusLabel(status: LaunchReadinessStatus): string {
  switch (status) {
    case "ready":               return "Prêt";
    case "ready_with_warnings": return "Avertissements";
    case "blocked":             return "Bloqué";
    case "disabled":            return "Désactivé";
    case "not_applicable":      return "N/A";
    default:                    return status;
  }
}

function statusBadge(status: LaunchReadinessStatus): string {
  switch (status) {
    case "ready":               return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "ready_with_warnings": return "bg-amber-50 text-amber-700 border border-amber-200";
    case "blocked":             return "bg-red-50 text-red-700 border border-red-200";
    case "disabled":            return "bg-stone-100 text-stone-500 border border-stone-200";
    default:                    return "bg-stone-50 text-stone-500 border border-stone-200";
  }
}

function severityColor(severity: LaunchSeverity): string {
  switch (severity) {
    case "critical": return "text-red-600";
    case "blocking": return "text-orange-600";
    case "warning":  return "text-amber-600";
    default:         return "text-stone-500";
  }
}

function surfaceIcon(surface: LaunchSurface) {
  switch (surface) {
    case "security":    return <Shield size={14} />;
    case "billing":
    case "checkout":    return <CreditCard size={14} />;
    case "legal":
    case "rgpd":        return <Scale size={14} />;
    case "pierre":      return <Zap size={14} />;
    case "public_site": return <Globe size={14} />;
    case "technologies": return <Lock size={14} />;
    default:            return <ChevronRight size={14} />;
  }
}

function surfaceLabel(surface: LaunchSurface): string {
  const labels: Record<LaunchSurface, string> = {
    public_site:   "Site public",
    checkout:      "Checkout",
    billing:       "Facturation",
    auth:          "Auth",
    cockpit:       "Cockpit",
    pierre:        "Pierre IA",
    demo:          "Démo",
    documents:     "Documents",
    email:         "Email",
    security:      "Sécurité",
    rgpd:          "RGPD",
    observability: "Observabilité",
    technologies:  "Technologies",
    legal:         "Légal",
    operations:    "Opérations",
  };
  return labels[surface] ?? surface;
}

// ── Verdict banner ─────────────────────────────────────────────────────────────

function VerdictBanner({ status, score, blockingCount }: {
  status: string;
  score: number;
  blockingCount: number;
}) {
  if (status === "technical_ready_public_blocked") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-4">
        <AlertTriangle size={28} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-amber-900 text-lg">Techniquement prêt — Lancement public bloqué</p>
          <p className="text-amber-800 text-sm mt-1">
            Le code est complet. {blockingCount} action{blockingCount > 1 ? "s" : ""} manuelle{blockingCount > 1 ? "s" : ""} bloquante{blockingCount > 1 ? "s" : ""} avant lancement public
            (CGU/CGV, revue juridique, RLS, Stripe live).
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-amber-200 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${score}%` }} />
            </div>
            <span className="text-xs font-mono text-amber-700">{score}/100</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === "public_launch_ready") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-4">
        <CheckCircle2 size={28} className="text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-900 text-lg">Prêt pour le lancement public</p>
          <p className="text-emerald-800 text-sm mt-1">
            Toutes les vérifications bloquantes sont résolues. Score: {score}/100.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-start gap-4">
      <XCircle size={28} className="text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-red-900 text-lg">Lancement bloqué</p>
        <p className="text-red-800 text-sm mt-1">
          {blockingCount} blocage{blockingCount > 1 ? "s" : ""} critique{blockingCount > 1 ? "s" : ""} à résoudre. Score: {score}/100.
        </p>
      </div>
    </div>
  );
}

// ── Surface card ───────────────────────────────────────────────────────────────

function SurfaceCard({ report }: { report: ReturnType<typeof buildAllReadinessReports>[number] }) {
  const [expanded, setExpanded] = useState(report.status === "blocked");

  return (
    <div className="rounded-xl border border-stone-200 bg-white/60 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-stone-400">{surfaceIcon(report.surface)}</span>
          <span className="text-sm font-medium text-stone-700">{surfaceLabel(report.surface)}</span>
          {report.blocking_count > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
              {report.blocking_count} bloquant
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(report.status)}`}>
            {statusLabel(report.status)}
          </span>
          {expanded ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
        </div>
      </button>

      {expanded && report.checks.length > 0 && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {report.checks.map((check) => (
            <div key={check.id} className="px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{statusIcon(check.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-stone-700">{check.label}</span>
                  {check.blocking_public_launch && check.status !== "ready" && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                      BLOQUANT
                    </span>
                  )}
                  {check.is_manual && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-stone-50 text-stone-500 border border-stone-200">
                      Manuel
                    </span>
                  )}
                  <span className={`text-xs font-mono ${severityColor(check.severity)}`}>
                    {check.severity}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{check.description}</p>
                {check.remediation && check.status !== "ready" && (
                  <p className="text-xs text-stone-400 italic mt-1">→ {check.remediation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LaunchReadinessPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const verdict = buildB48FinalVerdict({});
  const reports = buildAllReadinessReports();
  const blockingChecks = getBlockingChecks();
  const blocsSummary = getBlocRegistrySummary();

  const surface_order: LaunchSurface[] = [
    "legal", "security", "billing", "checkout", "auth",
    "pierre", "demo", "documents", "email",
    "rgpd", "technologies", "cockpit", "public_site",
    "observability", "operations",
  ];

  const sortedReports = [...reports].sort(
    (a, b) =>
      surface_order.indexOf(a.surface) - surface_order.indexOf(b.surface)
  );

  return (
    <div className="min-h-screen bg-[#faf9f6] font-[system-ui,sans-serif]">
      {/* Header */}
      <div className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-800">Launch Readiness</h1>
            <p className="text-xs text-stone-500">Tableau de bord pré-lancement — Interne</p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors px-3 py-1.5 rounded-lg border border-stone-200 hover:border-stone-300"
          >
            <RefreshCw size={12} />
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6" key={refreshKey}>

        {/* Verdict banner */}
        <VerdictBanner
          status={verdict.status}
          score={verdict.score_0_to_100}
          blockingCount={verdict.blocking_items.length}
        />

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-stone-200 bg-white/60 p-4">
            <p className="text-2xl font-semibold text-stone-800">{blocsSummary.complete}</p>
            <p className="text-xs text-stone-500 mt-0.5">Blocs complétés</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white/60 p-4">
            <p className="text-2xl font-semibold text-stone-800">{blocsSummary.total_tests.toLocaleString()}</p>
            <p className="text-xs text-stone-500 mt-0.5">Tests validés</p>
          </div>
          <div className={`rounded-xl border p-4 ${blockingChecks.length > 0 ? "border-red-200 bg-red-50" : "border-stone-200 bg-white/60"}`}>
            <p className={`text-2xl font-semibold ${blockingChecks.length > 0 ? "text-red-700" : "text-stone-800"}`}>
              {blockingChecks.length}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">Blocages restants</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white/60 p-4">
            <p className="text-2xl font-semibold text-stone-800">{verdict.score_0_to_100}</p>
            <p className="text-xs text-stone-500 mt-0.5">Score /100</p>
          </div>
        </div>

        {/* Blocking items */}
        {blockingChecks.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
            <h2 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
              <XCircle size={16} className="text-red-500" />
              Actions bloquantes ({blockingChecks.length})
            </h2>
            <div className="space-y-2">
              {blockingChecks.map((check) => (
                <div key={check.id} className="flex items-start gap-2 text-sm">
                  <span className="text-red-400 mt-0.5 shrink-0">•</span>
                  <div>
                    <span className="font-medium text-red-800">{check.label}</span>
                    {check.remediation && (
                      <p className="text-xs text-red-600 mt-0.5 italic">{check.remediation}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Surface reports */}
        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Surfaces ({reports.length})</h2>
          <div className="space-y-2">
            {sortedReports.map((report) => (
              <SurfaceCard key={report.surface} report={report} />
            ))}
          </div>
        </div>

        {/* Warnings */}
        {verdict.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
            <h2 className="text-sm font-semibold text-amber-900 mb-3">Avertissements légaux</h2>
            <ul className="space-y-1.5">
              {verdict.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-800 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer disclaimer */}
        <p className="text-xs text-stone-400 text-center pb-4">
          Tableau de bord interne. Pierre n'est pas avocat, juriste ou logiciel de paie officiel.
          Ce rapport est une aide technique — la conformité juridique finale nécessite une revue humaine.
        </p>
      </div>
    </div>
  );
}
