"use client";

// TECH-04 — /profile/technologies — Centre de contrôle des technologies CloneStore
// Données pilotées par la projection publique canonique P20 (identité/statut/ownership) +
// GlobalTechnologyConfig (TECH-03, configuration tenant) + profile-tech-ui.ts (TECH-04, projection UI).
//
// Technologies couvertes (15, dérivées de la projection canonique — jamais une liste locale) :
//   Essentiels : cloneos, cloneadn, cloneguard, clonetrace
//   Interfaces : clonechat (ownership externe — CloneChat), clonecontinuum, clonevoice
//   En développement : clonetrust, clonereview, clonesignals, clonelearn, clonebrief,
//                       clonecall (À venir), cloneroom (À venir)
//   Moteurs internes : clonepolicy
//
// Corrections appliquées :
//   [FIX-1] clonevoice — status=disabled, mode=disabled, score=15
//   [FIX-2] clonetrust — "autonomie graduelle", calibration progressive (pas zéro-accès)
//   [FIX-3] clonepolicy — moteur interne actif dans CloneGuard, pas roadmap

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";
import {
  Shield,
  Activity,
  Cpu,
  Dna,
  Mic,
  MessageCircle,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Clock,
  ChevronRight,
  Eye,
  Layers,
  Settings2,
  User,
  Info,
  BarChart3,
  GitBranch,
  Settings,
  Filter,
} from "lucide-react";

// ── TECH-04 UI data layer ──────────────────────────────────────────────────────
import type {
  TechUICardData,
  TechUISection,
  TechUIBadge,
  TechUIPageData,
} from "../../../lib/clonestore/technologies/profile-tech-ui";
import { buildProfileTechPageData } from "../../../lib/clonestore/technologies/profile-tech-ui";

// ── TECH-03 GlobalTechConfig ──────────────────────────────────────────────────
import { buildTenantConfiguredTechnologies } from "../../../lib/clonestore/technologies/canonical/tenant-configuration-adapter";
import { buildGlobalTechnologyConfigSnapshot } from "../../../lib/clonestore/technologies/global-tech-snapshot";

// ── TECH-02 Employee Runtime ──────────────────────────────────────────────────
import { PIERRE_EMPLOYEE_RUNTIME_CONTRACT } from "../../../lib/clonestore/employees/employee-registry";

// ── Static data (computed once, pure/deterministic) ───────────────────────────
const PAGE_DATA: TechUIPageData = buildProfileTechPageData();
const SNAPSHOT = buildGlobalTechnologyConfigSnapshot();
const PIERRE = PIERRE_EMPLOYEE_RUNTIME_CONTRACT;

const PIERRE_HARD_TECHS = PIERRE.required_technologies.filter((t) => t.required);
const PIERRE_SOFT_TECHS = PIERRE.required_technologies.filter((t) => !t.required);
// P20 : dérivé de l'autorité canonique jointe à la configuration TECH-03 (adaptateur officiel).
// Une technologie sans configuration P20 (à venir / chantier externe) n'apparaît dans aucune de
// ces deux listes — elle n'est ni configurable, ni verrouillée plateforme.
const CANONICAL_TECHS = buildTenantConfiguredTechnologies();
const CONFIGURABLE_TECHS = CANONICAL_TECHS.flatMap((t) =>
  t.config && t.config.configurable_by_customer ? [t.config] : [],
);
const LOCKED_PLATFORM_TECHS = CANONICAL_TECHS.flatMap((t) =>
  t.config && t.config.locked_by_platform && t.config.control_level !== "internal_only"
    ? [t.config]
    : [],
);
const ALL_CARDS = PAGE_DATA.sections.flatMap((s) => s.cards);
const PIERRE_TECH_KEYS = new Set(PIERRE.required_technologies.map((t) => t.slug as string));

// ── Filter tabs ───────────────────────────────────────────────────────────────

type FilterTab =
  | "all"
  | "active"
  | "partial"
  | "roadmap"
  | "client"
  | "internal"
  | "locked"
  | "pierre";

const FILTER_TABS: { id: FilterTab; label: string; count: number }[] = [
  { id: "all",      label: "Toutes",             count: ALL_CARDS.length },
  { id: "active",   label: "Actives",             count: ALL_CARDS.filter((c) => c.status_variant === "active").length },
  { id: "partial",  label: "Partielles",          count: ALL_CARDS.filter((c) => c.status_variant === "partial").length },
  { id: "roadmap",  label: "Roadmap",             count: ALL_CARDS.filter((c) => c.status_variant === "roadmap").length },
  { id: "client",   label: "Visibles client",     count: ALL_CARDS.filter((c) => !c.is_internal).length },
  { id: "internal", label: "Internes",            count: ALL_CARDS.filter((c) => c.is_internal).length },
  { id: "locked",   label: "Verrouillées",        count: ALL_CARDS.filter((c) => c.is_locked).length },
  { id: "pierre",   label: "Requises par Pierre", count: ALL_CARDS.filter((c) => PIERRE_TECH_KEYS.has(c.key)).length },
];

function getFilteredCards(filter: FilterTab): TechUICardData[] {
  switch (filter) {
    case "active":   return ALL_CARDS.filter((c) => c.status_variant === "active");
    case "partial":  return ALL_CARDS.filter((c) => c.status_variant === "partial");
    case "roadmap":  return ALL_CARDS.filter((c) => c.status_variant === "roadmap");
    case "client":   return ALL_CARDS.filter((c) => !c.is_internal);
    case "internal": return ALL_CARDS.filter((c) => c.is_internal);
    case "locked":   return ALL_CARDS.filter((c) => c.is_locked);
    case "pierre":   return ALL_CARDS.filter((c) => PIERRE_TECH_KEYS.has(c.key));
    default:         return ALL_CARDS;
  }
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
> = {
  cpu:              Cpu,
  dna:              Dna,
  shield:           Shield,
  activity:         Activity,
  mic:              Mic,
  "message-circle": MessageCircle,
};

// ── Badge component ───────────────────────────────────────────────────────────

function TechBadge({ badge }: { badge: TechUIBadge }) {
  switch (badge.variant) {
    case "visibility_client":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
          <Eye size={9} />
          Visible client
        </span>
      );
    case "internal_engine":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
          <Layers size={9} />
          Moteur interne
        </span>
      );
    case "active":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
          <CheckCircle2 size={9} />
          Actif
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          <Activity size={9} />
          En cours
        </span>
      );
    case "coming_soon":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
          <Clock size={9} />
          Bientôt
        </span>
      );
    case "protected":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
          <Shield size={9} />
          Protégé
        </span>
      );
    default:
      return null;
  }
}

// ── Status style helpers ──────────────────────────────────────────────────────

function statusStyle(variant: TechUICardData["status_variant"]): string {
  switch (variant) {
    case "active":   return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "partial":  return "text-amber-600 bg-amber-50 border-amber-200";
    case "disabled": return "text-stone-500 bg-stone-100 border-stone-200";
    case "roadmap":  return "text-stone-400 bg-stone-50 border-stone-100";
    case "internal": return "text-indigo-600 bg-indigo-50 border-indigo-100";
    default:         return "text-stone-500 bg-stone-100 border-stone-200";
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

// ── Technology card ───────────────────────────────────────────────────────────

function TechnologyCard({ card }: { card: TechUICardData }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[card.icon_key] ?? Cpu;

  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderTopColor: card.accent, borderTopWidth: 3 }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="rounded-xl p-2.5 flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${card.accent}18` }}
          >
            <Icon size={18} style={{ color: card.accent }} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-semibold text-stone-800 text-sm">{card.display_name}</span>
              {card.is_locked && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
                  <Lock size={9} />
                  Verrouillé
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {card.badges.map((badge, i) => (
                <TechBadge key={i} badge={badge} />
              ))}
            </div>
            <p className="text-xs text-stone-500 leading-snug">{card.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-1 ${statusStyle(card.status_variant)}`}
          >
            {card.status_label}
          </span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label={`Détails ${card.display_name}`}
          >
            <ChevronRight
              size={16}
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 pb-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-400">Score</span>
          <span className={`text-sm font-semibold ${scoreColor(card.readiness_score)}`}>
            {card.readiness_score}/100
          </span>
        </div>
        <div className="h-2 flex-1 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${card.readiness_score}%`,
              backgroundColor:
                card.readiness_score >= 70
                  ? "#059669"
                  : card.readiness_score >= 50
                    ? "#D97706"
                    : "#9CA3AF",
            }}
          />
        </div>
        {card.planned ? (
          <div className="flex items-center gap-1 text-xs text-stone-400">
            <Clock size={11} />
            <span>{card.planned}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-stone-400">
            <Zap size={11} />
            <span>{card.category_label}</span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-3 bg-stone-50/40">
          <div>
            <p className="text-xs font-medium text-stone-600 mb-1">Impact client</p>
            <p className="text-xs text-stone-600 leading-relaxed">{card.impact}</p>
          </div>

          {(card.active_now || card.roadmap_note) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {card.active_now && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
                  <p className="text-xs font-medium text-emerald-700 mb-1">Actif maintenant</p>
                  <p className="text-xs text-emerald-700 leading-relaxed">{card.active_now}</p>
                </div>
              )}
              {card.roadmap_note && (
                <div
                  className={`rounded-lg p-2.5 ${card.active_now ? "bg-blue-50 border border-blue-100" : "bg-stone-50 border border-stone-100 col-span-full sm:col-span-2"}`}
                >
                  <p
                    className={`text-xs font-medium mb-1 ${card.active_now ? "text-blue-700" : "text-stone-600"}`}
                  >
                    Feuille de route
                  </p>
                  <p
                    className={`text-xs leading-relaxed ${card.active_now ? "text-blue-700" : "text-stone-600"}`}
                  >
                    {card.roadmap_note}
                  </p>
                </div>
              )}
            </div>
          )}

          {card.is_required && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-emerald-700 mb-0.5">
                <CheckCircle2 size={11} />
                Requis pour les employés IA
              </div>
              <span className="text-emerald-700">
                Technologie indispensable au runtime des employés IA.
              </span>
            </div>
          )}

          {card.is_locked && (
            <div className="rounded-lg border border-violet-100 bg-violet-50 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-violet-700 mb-0.5">
                <Lock size={11} />
                Verrouillé par la plateforme
              </div>
              <span className="text-violet-700">
                Gouvernance et sécurité garanties par CloneStore — ne peut pas être désactivé.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Internal engine card (compact) ────────────────────────────────────────────

function InternalEngineCard({ card }: { card: TechUICardData }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[card.icon_key] ?? Settings2;

  return (
    <div
      className="rounded-xl border border-stone-200 bg-white/60 backdrop-blur-sm overflow-hidden"
      style={{ borderLeftColor: card.accent, borderLeftWidth: 3 }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div
          className="rounded-lg p-2 flex-shrink-0 mt-0.5"
          style={{ backgroundColor: `${card.accent}14` }}
        >
          <Icon size={15} style={{ color: card.accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="font-medium text-stone-700 text-sm">{card.display_name}</span>
            <span className="text-xs text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
              Interne
            </span>
          </div>
          <p className="text-xs text-stone-500 leading-snug">{card.impact}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-stone-400">{card.readiness_score}/100</span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label={`Détails ${card.display_name}`}
          >
            <ChevronRight
              size={14}
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>
      {expanded && card.active_now && (
        <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/30 text-xs text-stone-500 leading-relaxed">
          {card.active_now}
        </div>
      )}
    </div>
  );
}

// ── Section renderer (vue "Toutes") ───────────────────────────────────────────

function TechSection({ section }: { section: TechUISection }) {
  if (section.id === "internal_engines") {
    return (
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wider">
            {section.title} — {section.count}
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">{section.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {section.cards.map((card) => (
            <InternalEngineCard key={card.key} card={card} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-stone-800 uppercase tracking-wider">
          {section.title} — {section.count}
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">{section.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.cards.map((card) => (
          <TechnologyCard key={card.key} card={card} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// P19 — état réel Technologies Prime du tenant, servi par /api/clonestore/technologies (champ `canonical`),
// lui-même produit par la MÊME source canonique (buildTenantTechnologyView). Aucune liste statique
// concurrente : la page affiche ce que l'API renvoie pour CE tenant (readiness, provider, dispo, raison).
type CanonicalPrimeEntry = {
  id: string; version: string; readiness: string; providerState: string;
  claimableNow: string; mustNotClaim: string[]; dependencies: string[]; t1Capabilities: string[];
  tenantStatus: string | null; tenantConfigured: boolean; availableForTenant: boolean;
  unavailabilityReason: string | null;
};

function PrimeStateSection({ entries, error }: { entries: CanonicalPrimeEntry[] | null; error: string | null }) {
  // data-testid inertes (P19 §5) : ciblage e2e stable des trois états réels de la
  // section — aucun changement de comportement ni de texte utilisateur.
  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6" data-testid="technologies-prime-section">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="technologies-prime-error">
          État réel des Technologies Prime indisponible : {error}
        </div>
      </div>
    );
  }
  if (!entries) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6" data-testid="technologies-prime-section">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500" data-testid="technologies-prime-loading">Chargement de l'état réel…</div>
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6" data-testid="technologies-prime-section">
      <h2 className="text-base font-semibold text-stone-800 mb-1">Technologies Prime — état réel de votre entreprise</h2>
      <p className="text-xs text-stone-500 mb-3">Source canonique unique (identique à l'API). Un provider externe non configuré est affiché désactivé — jamais actif.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="prime-state-grid">
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-stone-200 bg-white p-4" data-testid={`prime-${e.id}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-800">{e.id}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.availableForTenant ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                {e.availableForTenant ? "Disponible" : "Indisponible"}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">readiness : {e.readiness} · provider : {e.providerState} · v{e.version}</p>
            <p className="text-xs text-stone-600 mt-2">{e.claimableNow}</p>
            {e.unavailabilityReason ? <p className="text-xs text-amber-700 mt-2">{e.unavailabilityReason}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TechnologiesPage() {
  useRequireAuth();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const { sections, total, essential_score, essential_ok } = PAGE_DATA;
  const { summary } = SNAPSHOT;

  // P19 — fetch de l'état réel tenant (même source canonique que l'API ; pas de constante build-time).
  const [primeEntries, setPrimeEntries] = useState<CanonicalPrimeEntry[] | null>(null);
  const [primeError, setPrimeError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clonestore/technologies", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(json.canonical)) { setPrimeError(json?.error || `HTTP ${res.status}`); return; }
        setPrimeEntries(json.canonical as CanonicalPrimeEntry[]);
      } catch (e) {
        if (!cancelled) setPrimeError(e instanceof Error ? e.message : "réseau");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredCards = getFilteredCards(activeFilter);
  const activeFilterLabel = FILTER_TABS.find((t) => t.id === activeFilter)?.label ?? "";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF8F5" }}>

      {/* ── Sticky header ── */}
      <div className="border-b border-stone-200 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-stone-800">Technologies CloneStore</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {total} couches système — orchestration, gouvernance, mémoire, traçabilité
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 text-sm font-medium flex-shrink-0 ${
              essential_ok ? "text-emerald-700" : "text-amber-600"
            }`}
          >
            {essential_ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span className="hidden sm:inline">Score critique : </span>
            <span>{essential_score}/100</span>
          </div>
        </div>
      </div>

      {/* ── P19 — état réel Technologies Prime (source canonique via l'API, jamais une constante) ── */}
      <PrimeStateSection entries={primeEntries} error={primeError} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── 1. Hero ── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 leading-tight">
              Couches système<br className="hidden sm:block" /> de CloneStore
            </h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed max-w-2xl">
              Les technologies CloneStore sont les couches système globales qui alimentent chaque
              employé IA. Elles ne sont pas des employés — les employés IA se branchent dessus via
              leur contrat de runtime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 rounded-full px-3 py-1">
              <User size={11} />
              Pierre est connecté à {PIERRE.required_technologies.length} technologies
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
              <GitBranch size={11} />
              Les futurs employés IA utiliseront les mêmes couches
            </span>
          </div>
        </div>

        {/* ── 2. Verdict / résumé ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: summary.total, color: "text-stone-700", bg: "bg-white/80", border: "border-stone-200" },
            { label: "Actives", value: summary.active, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
            { label: "Partielles", value: summary.partial, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
            { label: "Roadmap", value: summary.roadmap, color: "text-stone-500", bg: "bg-stone-50", border: "border-stone-100" },
            { label: "Verrouillées plateforme", value: summary.platform_locked, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
            { label: "Configurables client", value: summary.customer_configurable, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
            { label: "Score moyen", value: `${summary.average_readiness_score}/100`, color: essential_ok ? "text-emerald-700" : "text-amber-600", bg: essential_ok ? "bg-emerald-50" : "bg-amber-50", border: "border-emerald-100" },
            { label: "Requises runtime", value: summary.required_for_employee_runtime, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} border ${stat.border} rounded-xl px-4 py-3`}
            >
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── 3. Filtres ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-stone-400" />
            <span className="text-xs font-medium text-stone-500">Filtrer les technologies</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                  activeFilter === tab.id
                    ? "bg-stone-800 text-white border-stone-800"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 ${
                    activeFilter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 4. Grille de technologies ── */}
        {activeFilter === "all" ? (
          <div className="space-y-10">
            {sections.map((section) => (
              <TechSection key={section.id} section={section} />
            ))}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-stone-800 uppercase tracking-wider">
                {activeFilterLabel} — {filteredCards.length}
              </h2>
            </div>
            {filteredCards.length === 0 ? (
              <div className="rounded-xl border border-stone-100 bg-white/60 px-5 py-8 text-center text-sm text-stone-400">
                Aucune technologie dans ce filtre.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCards.map((card) =>
                  card.is_internal ? (
                    <InternalEngineCard key={card.key} card={card} />
                  ) : (
                    <TechnologyCard key={card.key} card={card} />
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 5. Pierre utilise ces technologies ── */}
        <div className="rounded-2xl border border-stone-200 bg-white/70 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2 bg-stone-100 flex-shrink-0 mt-0.5">
                <User size={15} className="text-stone-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">
                  Pierre utilise ces technologies
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Pierre — employé IA RH — déclare {PIERRE.required_technologies.length} technologies
                  dans son contrat de runtime. Les employés futurs utiliseront les mêmes couches.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">

            {/* Hard requirements — Indispensables */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Indispensables
                </span>
                <span className="text-xs text-stone-400">
                  — sans ces {PIERRE_HARD_TECHS.length} technologies, Pierre ne peut pas fonctionner
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PIERRE_HARD_TECHS.map((tech) => {
                  const card = ALL_CARDS.find((c) => c.key === tech.slug);
                  return (
                    <div
                      key={tech.slug}
                      className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                    >
                      <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-stone-700 text-sm">
                          {card?.display_name ?? tech.slug}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                          {tech.rationale.slice(0, 85)}…
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Soft requirements — Recommandées */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Recommandées
                </span>
                <span className="text-xs text-stone-400">
                  — enrichissent l'expérience, non bloquantes
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PIERRE_SOFT_TECHS.map((tech) => {
                  const card = ALL_CARDS.find((c) => c.key === tech.slug);
                  return (
                    <div
                      key={tech.slug}
                      className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5"
                    >
                      <Zap size={14} className="text-stone-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-stone-600 text-sm">
                          {card?.display_name ?? tech.slug}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5 leading-snug">
                          {tech.rationale.slice(0, 85)}…
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-400 leading-relaxed">
              Pierre prépare des brouillons RH — validation humaine obligatoire pour toute décision
              officielle. Il ne prend pas de décisions légales, n'exécute pas la paie officielle et
              ne signe pas de contrats.
            </div>
          </div>
        </div>

        {/* ── 6. Technologies configurables ── */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-blue-600" />
              <div>
                <h2 className="text-sm font-semibold text-stone-800">
                  Technologies configurables
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {CONFIGURABLE_TECHS.length} technologies peuvent être ajustées selon les besoins
                  de votre organisation.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONFIGURABLE_TECHS.map((config) => {
              const card = ALL_CARDS.find((c) => c.key === config.key);
              return (
                <div
                  key={config.key}
                  className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-white px-3 py-2.5"
                >
                  <Settings size={14} className="text-blue-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-stone-700">
                      {config.display_name}
                    </span>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {card?.category_label ?? config.category}
                    </p>
                  </div>
                  <span className="text-xs text-blue-500 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 flex-shrink-0">
                    Configurable
                  </span>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-4 text-xs text-stone-400 italic">
            Configuration avancée disponible prochainement — lecture seule pour l'instant.
          </div>
        </div>

        {/* ── 7. Technologies verrouillées ── */}
        <div className="rounded-2xl border border-violet-100 bg-violet-50/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-violet-100">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-violet-600" />
              <div>
                <h2 className="text-sm font-semibold text-stone-800">
                  Technologies verrouillées plateforme
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {LOCKED_PLATFORM_TECHS.length} technologies contrôlées exclusivement par
                  CloneStore pour garantir la gouvernance et la sécurité.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LOCKED_PLATFORM_TECHS.map((config) => (
              <div
                key={config.key}
                className="flex items-start gap-2.5 rounded-lg border border-violet-100 bg-white px-3 py-2.5"
              >
                <Lock size={14} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-stone-700 text-sm">{config.display_name}</div>
                  <p className="text-xs text-stone-400 mt-0.5 leading-snug">
                    {config.short_description.slice(0, 72)}…
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4 space-y-1.5">
            {[
              "Gouvernance — règles et validations non désactivables.",
              "Traçabilité — audit complet de chaque action IA, immuable.",
              "Sécurité — blocage des actions risquées garanti par la plateforme.",
              "Décisions critiques — toujours soumises à validation humaine.",
            ].map((rule) => (
              <div key={rule} className="flex items-start gap-2 text-xs text-stone-500">
                <Shield size={11} className="mt-0.5 flex-shrink-0 text-violet-400" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 8. Roadmap technologies ── */}
        <div className="rounded-2xl border border-stone-200 bg-white/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-stone-500" />
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Roadmap technologies</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  En construction — elles enrichiront CloneStore progressivement, sans être vendues
                  comme actives avant d'être prêtes.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {ALL_CARDS.filter((c) => c.status_variant === "roadmap").map((card) => (
              <div
                key={card.key}
                className="flex items-start gap-2.5 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5"
              >
                <Clock size={14} className="text-stone-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-600 text-sm">{card.display_name}</span>
                    {card.planned && (
                      <span className="text-xs text-stone-400">{card.planned}</span>
                    )}
                  </div>
                  {card.roadmap_note && (
                    <p className="text-xs text-stone-400 mt-0.5 leading-snug">
                      {card.roadmap_note.slice(0, 80)}…
                    </p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 flex-shrink-0">
                  <Clock size={9} />
                  Bientôt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 9. Points importants ── */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50/30 px-5 py-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <Info size={15} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-stone-800">Points importants</h2>
          </div>
          <div className="space-y-3 text-xs text-stone-600 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <Mic size={11} className="mt-0.5 text-amber-500 flex-shrink-0" />
              <p>
                <strong>CloneVoice</strong> prépare l'entrée vocale naturelle, mais le pipeline
                voix complet n'est pas activé en production. Ce n'est pas un pipeline vocal
                opérationnel — statut : non actif en production (readiness 15/100).
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Shield size={11} className="mt-0.5 text-amber-500 flex-shrink-0" />
              <p>
                <strong>CloneTrust</strong> est un moteur d'<strong>autonomie graduelle</strong> —
                la confiance est accordée progressivement à l'employé IA au fur et à mesure que
                des comportements validés sont démontrés. Ce n'est pas un système de blocage
                permanent. L'autonomie graduelle permet d'élargir l'autonomie de l'IA selon
                le contexte et les validations humaines accumulées.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Layers size={11} className="mt-0.5 text-amber-500 flex-shrink-0" />
              <p>
                <strong>ClonePolicy</strong> est un moteur interne exécuté dans le pipeline
                CloneGuard → ClonePolicy → CloneTrust. Il n'est pas exposé directement au
                client comme technologie produit principale.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={11} className="mt-0.5 text-amber-500 flex-shrink-0" />
              <p>
                Le lancement public reste géré par le processus GO-LIVE (GO-LIVE 01 → GO-LIVE 10),
                pas par cette page. Aucune modification ici n'affecte les conditions de lancement.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-xl border border-stone-100 bg-white/40 px-4 py-3 text-xs text-stone-400 text-center">
          CloneStore orchestre, trace et gouverne vos employés IA. Pierre prépare des brouillons
          RH — validation humaine finale obligatoire pour toute décision officielle.
        </div>

      </div>
    </div>
  );
}
