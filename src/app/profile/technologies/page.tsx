"use client";

// B46 — /profile/technologies — Technologies Configuration Page
// Premium UI for CloneStore technologies. Crème/ivoire palette, glass cards.

import { useState } from "react";
import { Shield, Activity, Cpu, Dna, Mic, MessageCircle, Lock, AlertTriangle, CheckCircle2, Zap, RefreshCw, ChevronRight } from "lucide-react";
import type { B46TechnologyItem } from "../../../lib/clonestore/technologies/technology-b46-types";
import { buildAllB46TechnologyItems } from "../../../lib/clonestore/technologies/technology-b46-registry";
import { getDefaultB46ReadinessContext } from "../../../lib/clonestore/technologies/technology-readiness";
import { getRuntimeModeLabel } from "../../../lib/clonestore/technologies/technology-runtime-modes";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  cpu: Cpu,
  dna: Dna,
  shield: Shield,
  activity: Activity,
  mic: Mic,
  "message-circle": MessageCircle,
};

// ── Status helpers ────────────────────────────────────────────────────────────

function statusLabel(status: B46TechnologyItem["status"]): string {
  switch (status) {
    case "active":              return "Actif";
    case "ready":               return "Prêt";
    case "needs_configuration": return "À configurer";
    case "degraded":            return "Dégradé";
    case "disabled":            return "Désactivé";
    case "draft":               return "Brouillon";
    case "blocked":             return "Bloqué";
    case "archived":            return "Archivé";
    default:                    return "Inconnu";
  }
}

function statusColor(status: B46TechnologyItem["status"]): string {
  switch (status) {
    case "active":  return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "ready":   return "text-blue-700 bg-blue-50 border-blue-200";
    case "degraded": return "text-amber-700 bg-amber-50 border-amber-200";
    case "disabled": return "text-stone-500 bg-stone-100 border-stone-200";
    case "blocked":  return "text-red-700 bg-red-50 border-red-200";
    default:         return "text-stone-600 bg-stone-50 border-stone-200";
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

// ── Technology Card ───────────────────────────────────────────────────────────

function TechnologyCard({ item }: { item: B46TechnologyItem }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[item.display.icon_key] ?? Cpu;

  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderTopColor: item.display.accent, borderTopWidth: 3 }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl p-2.5 flex-shrink-0"
            style={{ backgroundColor: `${item.display.accent}15` }}
          >
            <Icon size={20} style={{ color: item.display.accent }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-800 text-sm">{item.display.name}</span>
              {item.locked && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
                  <Lock size={10} />
                  Essentiel
                </span>
              )}
              {item.launch_critical && !item.locked && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                  Critique
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5 leading-snug">{item.display.short_label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-1 ${statusColor(item.status)}`}>
            {statusLabel(item.status)}
          </span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Voir détails"
          >
            <ChevronRight size={16} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      {/* Scores row */}
      <div className="px-5 pb-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-400">Score</span>
          <span className={`text-sm font-semibold ${scoreColor(item.readiness.score)}`}>
            {item.readiness.score}/100
          </span>
        </div>
        <div className="h-3 flex-1 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${item.readiness.score}%`,
              backgroundColor: item.readiness.score >= 70 ? "#059669" : item.readiness.score >= 50 ? "#D97706" : "#DC2626",
            }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-stone-400">
          <Zap size={11} />
          <span className="text-stone-500">{getRuntimeModeLabel(item.runtime_mode)}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-3 bg-stone-50/50">
          <p className="text-xs text-stone-600 leading-relaxed">{item.display.customer_description}</p>

          {item.readiness.blockers.length > 0 && (
            <div className="space-y-1">
              {item.readiness.blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {item.readiness.warnings.length > 0 && (
            <div className="space-y-1">
              {item.readiness.warnings.slice(0, 2).map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {item.readiness.blockers.length === 0 && item.readiness.warnings.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 size={12} />
              <span>Configuration nominale</span>
            </div>
          )}

          {item.locked && (
            <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-500">
              <div className="flex items-center gap-1.5 font-medium text-stone-700 mb-1">
                <Lock size={11} />
                Technologie verrouillée
              </div>
              Cette technologie est essentielle à Pierre et ne peut pas être désactivée.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TechnologiesPage() {
  const context = getDefaultB46ReadinessContext();
  const items = buildAllB46TechnologyItems(context);
  const criticalOk = items.filter((t) => t.launch_critical).every((t) => t.readiness.score >= 60);
  const avgScore = Math.round(items.filter((t) => t.launch_critical).reduce((a, t) => a + t.readiness.score, 0) / items.filter((t) => t.launch_critical).length);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF8F5" }}>
      {/* Header */}
      <div className="border-b border-stone-200 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-800">Technologies CloneStore</h1>
            <p className="text-xs text-stone-500 mt-0.5">Configuration et état des systèmes IA</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-sm font-medium ${criticalOk ? "text-emerald-700" : "text-amber-600"}`}>
              {criticalOk ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              Score critique : {avgScore}/100
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Status banner */}
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${criticalOk ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          {criticalOk
            ? <><CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" /><span className="text-sm font-medium text-emerald-800">Toutes les technologies critiques sont opérationnelles.</span></>
            : <><AlertTriangle size={18} className="text-amber-600 flex-shrink-0" /><span className="text-sm font-medium text-amber-800">Certaines technologies critiques nécessitent votre attention.</span></>
          }
        </div>

        {/* Critical technologies */}
        <div>
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-4">Technologies essentielles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.filter((t) => t.launch_critical).map((item) => (
              <TechnologyCard key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Optional technologies */}
        <div>
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-4">Technologies optionnelles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.filter((t) => !t.launch_critical).map((item) => (
              <TechnologyCard key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center text-xs text-stone-400 pb-4">
          <RefreshCw size={12} className="inline mr-1" />
          Configuration mise à jour à chaque chargement. B46 — CloneStore Technologies.
        </div>
      </div>
    </div>
  );
}
