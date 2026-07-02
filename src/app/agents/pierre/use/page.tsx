// src/app/agents/pierre/use/page.tsx
// Pierre Cockpit B31 — Mission Center root page.
// Access-gated: checks orders table before mounting the cockpit hook.
// PHASE 2.7 — Global integration : constants, NoAccessGate enrichi, CloneOS history.
// PHASE 3.11 — Empreinte Entreprise read-only (localStorage, pas de Supabase, pas de moteur Pierre).

"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Fingerprint,
  LayoutDashboard,
  Loader2,
  Lock,
  MessagesSquare,
  Network,
  Settings2,
  ShieldCheck,
} from "lucide-react";

// ── PHASE 3.11/3.12 — Empreinte Entreprise (localStorage read-only) ─────────
// Pas de Supabase, pas de DB write, pas de runtime Pierre, pas d'auto-submit.
import {
  loadPierreUseEnterpriseFootprint,
  buildPierreFootprintPrefillPayload,
  validatePierreFootprintPrefillPayload,
  sanitizePierreFootprintPrefillPrompt,
  buildPierreFootprintPrefillConfirmation,
} from "@/lib/clonestore/enterprise-footprint";
import type {
  PierreUseFootprintReadResult,
  PierreUseFootprintMissionSuggestion,
  PierreFootprintPrefillPayload,
} from "@/lib/clonestore/enterprise-footprint";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { getSessionClient } from "@/lib/auth/session-client";
import { buildCheckoutAuthHeaders } from "@/lib/checkout/checkout-helpers";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";
import { isAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { usePierreCockpit } from "./hooks/usePierreCockpit";
import { PierreCockpitShell } from "./components/PierreCockpitShell";
import CockpitGovernedOverview from "@/components/pierre/CockpitGovernedOverview";
import type { CloneOSCommandCenterResult } from "@/lib/clonestore/cloneos";
// P9.3 — nouveau cockpit opérationnel client (remplace l'expérience technique).
import { OperationalCockpitShell } from "@/components/pierre/cockpit/OperationalCockpitShell";

// ── PHASE 2.7 — Intégration globale CloneStore ────────────────────────────────
// Pierre n'est pas une page isolée. Il est branché sur le socle CloneStore.
// Ces constantes exposent le contexte global pour l'UI et les tests statiques.

const PIERRE_GLOBAL_LINKS = [
  { href: "/profile/agents",     label: "Mon espace CloneStore",     icon: LayoutDashboard },
  { href: "/profile/messages",   label: "Messages",                   icon: MessagesSquare },
  { href: "/profile/onboarding", label: "Onboarding entreprise",      icon: Fingerprint },
  { href: "/profile/technologies", label: "Technologies CloneStore",  icon: Network },
  { href: "/agents/pierre/setup", label: "Configuration Pierre",      icon: Settings2 },
] as const;

const PIERRE_CLONESTORE_TECH_STACK = [
  { key: "cloneos",    label: "CloneOS",    desc: "Orchestration des missions et demandes globales" },
  { key: "cloneadn",   label: "CloneADN",   desc: "Mémoire entreprise et contexte RH" },
  { key: "cloneguard", label: "CloneGuard", desc: "Validation humaine et gouvernance des risques" },
  { key: "clonetrace", label: "CloneTrace", desc: "Historique et audit de traçabilité" },
  { key: "clonebrief", label: "CloneBrief", desc: "Synthèses exécutives et briefings" },
] as const;

// Microcopy garde-fous PHASE 2.7
const PIERRE_VALIDATION_HUMAINE = "Validation humaine obligatoire sur les actions sensibles.";
const PIERRE_PLAN_ONLY_NOTE = "Plan préparé — non exécuté.";
const PIERRE_LECTURE_SEULE = "Lecture seule — aucune action exécutée depuis les résultats globaux.";
const PIERRE_SEUL_ACTIF = "Pierre est le seul employé IA actif en V1 — domaine RH.";

// ── PHASE 2.7 — CloneOS history reader (Option A) ────────────────────────────
// Lit le cloneOSHistory depuis localStorage (clé PHASE 2.4) côté client.
// Filtre les résultats routés vers Pierre / domaine hr.
// Aucune écriture. Aucune exécution. Plan préparé — non exécuté.

const CLONEOS_HISTORY_KEY = "clonestore.cloneos.commandHistory.v1";

function usePierreCloneOSHistory() {
  const [history, setHistory] = useState<CloneOSCommandCenterResult[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLONEOS_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CloneOSCommandCenterResult[];
      if (!Array.isArray(parsed)) return;
      // Filtrer : seulement domaine hr ou route Pierre
      const pierreResults = parsed
        .filter(
          (r) =>
            r.classified_command?.domain === "hr" ||
            r.selected_route?.employee_slug === "pierre",
        )
        .slice(0, 3);
      setHistory(pierreResults);
    } catch (_e) {
      /* skip — localStorage indisponible */
    }
  }, []);

  return history;
}

// ── PHASE 2.7 — PierreCloneOSHistoryPreview ──────────────────────────────────
// Affiche les 3 derniers plans CloneOS routés vers Pierre.
// Plan préparé — non exécuté. Lecture seule.

function PierreCloneOSHistoryPreview() {
  const history = usePierreCloneOSHistory();

  if (history.length === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-[1.25rem] border border-white/50 bg-white/20 p-4 backdrop-blur-xl">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
        Demandes globales préparées pour Pierre
      </p>
      <p className="mt-1 text-[0.65rem] text-[var(--cs-ink-4)]">
        {PIERRE_PLAN_ONLY_NOTE} {PIERRE_LECTURE_SEULE}
      </p>
      <div className="mt-3 grid gap-2">
        {history.map((result) => (
          <div
            key={result.command_id}
            className="rounded-[0.9rem] border border-white/45 bg-white/24 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--cs-success)]" />
              <p className="text-xs font-semibold text-[var(--cs-ink-1)]">
                {result.classified_command?.summary ?? "Demande RH analysée"}
              </p>
            </div>
            <p className="mt-1 text-[0.64rem] text-[var(--cs-ink-4)]">
              Statut : {result.status} · {PIERRE_PLAN_ONLY_NOTE}
            </p>
          </div>
        ))}
      </div>
      <Link
        href="/profile/agents"
        className="mt-3 inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--cs-violet)]"
      >
        <LayoutDashboard className="h-3 w-3" />
        Voir Mon espace
      </Link>
    </div>
  );
}

type AccessState = "checking" | "active" | "no_access" | "unauthenticated";

// ── PHASE 3.11/3.12 — PierreUseFootprintStrip ───────────────────────────────
// Bande compacte affichée au-dessus du cockpit actif.
// Lecture seule · Aucune action exécutée · Plan-only.
// Ne modifie pas le comportement du moteur Pierre.
// PHASE 3.12 : onUseSuggestion préremplie uniquement setInputDraft — aucun auto-submit.

function PierreUseFootprintStrip({
  result,
  onUseSuggestion,
  prefillConfirmation,
}: {
  result: PierreUseFootprintReadResult | null;
  onUseSuggestion?: (payload: PierreFootprintPrefillPayload) => void;
  prefillConfirmation?: string | null;
}) {
  if (!result) return null;

  if (!result.has_footprint) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[var(--cs-warn-bg)] px-4 py-2 text-xs" style={{ borderColor: "var(--cs-line)" }}>
        <span style={{ color: "var(--cs-warn)" }}>
          Empreinte Entreprise manquante — Pierre peut être utilisé, mais le contexte entreprise global n'est pas encore disponible.
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/45 bg-white/28 px-2 py-0.5 font-bold" style={{ color: "var(--cs-ink-3)" }}>
            Fallback local
          </span>
          <span className="rounded-full border border-white/45 bg-white/28 px-2 py-0.5 font-bold" style={{ color: "var(--cs-ink-3)" }}>
            Aucune action exécutée
          </span>
          <Link
            href="/profile/onboarding"
            className="rounded-full border px-2 py-0.5 font-semibold transition hover:opacity-80"
            style={{ borderColor: "var(--cs-warn)", color: "var(--cs-warn)" }}
          >
            Créer →
          </Link>
          <Link
            href="/agents/pierre/setup"
            className="rounded-full border px-2 py-0.5 font-semibold transition hover:opacity-80"
            style={{ borderColor: "var(--cs-line)", color: "var(--cs-ink-3)" }}
          >
            Configuration
          </Link>
        </div>
      </div>
    );
  }

  const s = result.summary!;
  // Suggestions non-disabled disponibles pour prefill
  const prefillableSuggestions = onUseSuggestion
    ? result.suggestions.filter((sg) => !sg.disabled).slice(0, 3)
    : [];

  function handleSuggestionClick(sg: PierreUseFootprintMissionSuggestion) {
    if (!onUseSuggestion) return;
    const payload = buildPierreFootprintPrefillPayload(sg);
    if (!payload) return;
    onUseSuggestion(payload);
  }

  return (
    <div
      className="border-b text-xs"
      style={{ background: "var(--cs-surface-strong)", borderColor: "var(--cs-line)" }}
    >
      {/* Ligne principale : contexte + badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold" style={{ color: "var(--cs-ink-1)" }}>
            Empreinte Entreprise
          </span>
          <span style={{ color: "var(--cs-ink-3)" }}>
            {s.company_name} · Readiness {s.readiness_score}% · Risque {s.risk_label}
          </span>
          {result.warnings.filter((w) => w.severity === "blocking").slice(0, 1).map((w) => (
            <span key={w.id} style={{ color: "var(--cs-warn)" }}>
              ⚠ {w.message}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/45 bg-white/28 px-2 py-0.5 font-bold" style={{ color: "var(--cs-ink-3)" }}>
            Lecture seule
          </span>
          <span className="rounded-full border border-white/45 bg-white/28 px-2 py-0.5 font-bold" style={{ color: "var(--cs-ink-3)" }}>
            Plan-only
          </span>
          <span className="rounded-full border border-white/45 bg-white/28 px-2 py-0.5 font-bold" style={{ color: "var(--cs-ink-3)" }}>
            Aucune action exécutée
          </span>
          <Link
            href="/profile/agents#empreinte-entreprise"
            className="rounded-full border px-2 py-0.5 font-semibold transition hover:opacity-80"
            style={{ borderColor: "var(--cs-line)", color: "var(--cs-ink-3)" }}
          >
            Voir empreinte
          </Link>
        </div>
      </div>

      {/* PHASE 3.12 — Suggestions plan-only avec bouton "Utiliser" */}
      {/* Préremplit uniquement le composer. Aucun envoi automatique. */}
      {prefillableSuggestions.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border-t px-4 py-1.5"
          style={{ borderColor: "var(--cs-line)" }}
        >
          <span style={{ color: "var(--cs-ink-4)" }}>
            Suggestions :
          </span>
          {prefillableSuggestions.map((sg) => (
            <button
              key={sg.id}
              type="button"
              onClick={() => handleSuggestionClick(sg)}
              title={`Préremplit uniquement le composer. Aucun envoi automatique.\n${sg.prompt}`}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition hover:opacity-80"
              style={{ borderColor: "var(--cs-line)", color: "var(--cs-ink-2)", background: "var(--cs-surface)" }}
            >
              {sg.title}
              <span style={{ color: "var(--cs-ink-4)" }}>↗</span>
            </button>
          ))}
          <span style={{ color: "var(--cs-ink-4)" }}>
            · Préremplit uniquement le composer · Aucun envoi automatique
          </span>
        </div>
      )}

      {/* Confirmation après préremplissage */}
      {prefillConfirmation && (
        <div
          className="flex items-center gap-2 border-t px-4 py-1.5"
          style={{ borderColor: "var(--cs-line)", background: "var(--cs-success-bg)" }}
          role="status"
          aria-live="polite"
        >
          <span style={{ color: "var(--cs-success)" }}>
            ✓ {prefillConfirmation}
          </span>
          <span style={{ color: "var(--cs-ink-4)" }}>
            — Suggestion ajoutée au composer · Relisez puis envoyez manuellement · Aucune action exécutée
          </span>
        </div>
      )}
    </div>
  );
}

// ── PHASE 2.7 — NoAccessGate enrichi ─────────────────────────────────────────
// Pierre dans l'espace CloneStore — navigation globale visible même sans accès.
// PHASE 3.11 — Panneau Empreinte Entreprise read-only intégré.
// {PIERRE_SEUL_ACTIF} — {PIERRE_VALIDATION_HUMAINE}

function NoAccessGate({ footprintResult }: { footprintResult: PierreUseFootprintReadResult | null }) {
  return (
    <main className="cs-page">
      <div className="cs-page-shell space-y-5">
        {/* Hero accès */}
        <LiquidGlass
          variant="panel"
          intensity="strong"
          refractive
          className="rounded-[2.25rem] p-8 text-center"
        >
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/60 bg-white/35 text-[#6f83ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="cs-heading text-[1.6rem] leading-tight tracking-tight">
            Accès non activé
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--cs-ink-3)]">
            Le cockpit Pierre est réservé aux abonnés actifs.{" "}
            {PIERRE_SEUL_ACTIF}
          </p>
          <p className="mt-2 text-xs text-[var(--cs-ink-4)]">
            {PIERRE_VALIDATION_HUMAINE}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/checkout?agent=pierre"
              className="clone-liquid-button clone-liquid-button--dark"
            >
              <span>Activer Pierre</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            {/* Lien /profile conservé pour compatibilité GO-LIVE 09 */}
            <Link href="/profile" className="clone-liquid-button">
              <span>Mon CloneStore</span>
              <Bot className="h-4 w-4" />
            </Link>
          </div>
        </LiquidGlass>

        {/* Stack technologique Pierre dans CloneStore */}
        <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.75rem] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
            Pierre est connecté à CloneStore
          </p>
          <h2 className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
            Technologies utilisées par Pierre
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-3)]">
            Ces technologies encadrent Pierre. {PIERRE_VALIDATION_HUMAINE}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PIERRE_CLONESTORE_TECH_STACK.map((tech) => (
              <div
                key={tech.key}
                className="rounded-[1.1rem] border border-white/50 bg-white/22 p-3"
              >
                <p className="text-xs font-bold text-[var(--cs-ink-1)]">{tech.label}</p>
                <p className="mt-0.5 text-[0.65rem] leading-4 text-[var(--cs-ink-4)]">{tech.desc}</p>
              </div>
            ))}
          </div>
        </LiquidGlass>

        {/* Navigation globale */}
        <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.75rem] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
            Votre espace CloneStore
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PIERRE_GLOBAL_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/34 px-4 py-2 text-sm font-semibold text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/48"
                >
                  <Icon className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </LiquidGlass>

        {/* CloneOS history preview */}
        <PierreCloneOSHistoryPreview />

        {/* PHASE 3.11 — Empreinte Entreprise read-only ──────────────────── */}
        {/* Lecture seule · Aucune action exécutée · Plan-only              */}
        <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.75rem] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
              Empreinte Entreprise
            </p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/45 bg-white/28 px-2 py-0.5 text-[0.58rem] font-bold text-[var(--cs-ink-3)]">
                Lecture seule
              </span>
              <span className="inline-flex items-center rounded-full border border-white/45 bg-white/28 px-2 py-0.5 text-[0.58rem] font-bold text-[var(--cs-ink-3)]">
                Aucune action exécutée
              </span>
              <span className="inline-flex items-center rounded-full border border-white/45 bg-white/28 px-2 py-0.5 text-[0.58rem] font-bold text-[var(--cs-ink-3)]">
                Plan-only
              </span>
            </div>
          </div>

          {footprintResult?.has_footprint && footprintResult.summary ? (
            <div className="mt-4 space-y-3">
              {/* Entreprise + readiness */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.9rem] border border-white/40 bg-white/16 px-3 py-2">
                <div>
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">Entreprise</p>
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                    {footprintResult.summary.company_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">Readiness</p>
                  <p className="text-sm font-bold text-[var(--cs-ink-1)]">
                    {footprintResult.summary.readiness_score}%
                  </p>
                </div>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-2 gap-2">
                {footprintResult.cards.slice(0, 4).map((card) => (
                  <div
                    key={card.id}
                    className="rounded-[0.9rem] border border-white/40 bg-white/14 p-2"
                  >
                    <p className="text-[0.56rem] font-bold uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">
                      {card.label}
                    </p>
                    <p className="text-xs font-semibold text-[var(--cs-ink-1)]">
                      {String(card.value)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Suggestions plan-only (UI seulement — copier le prompt) */}
              <div className="space-y-2">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">
                  Suggestions plan-only
                </p>
                {footprintResult.suggestions.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className={[
                      "rounded-[0.9rem] border p-2",
                      s.disabled
                        ? "border-white/30 bg-white/08 opacity-50"
                        : "border-white/40 bg-white/14",
                    ].join(" ")}
                  >
                    <p className="text-[0.62rem] font-semibold text-[var(--cs-ink-2)]">
                      {s.title}
                      {s.disabled && (
                        <span className="ml-1 text-[var(--cs-ink-4)]">— {s.disabled_reason}</span>
                      )}
                    </p>
                    {!s.disabled && (
                      <p className="mt-0.5 text-[0.58rem] leading-4 text-[var(--cs-ink-4)]">
                        {s.prompt}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {footprintResult.warnings.filter((w) => w.severity !== "info").slice(0, 2).map((w) => (
                <p key={w.id} className="text-[0.62rem] text-[var(--cs-ink-4)]">
                  ⚠ {w.message}
                </p>
              ))}

              {/* CTAs */}
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href="/profile/onboarding"
                  className="inline-flex items-center rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)] transition hover:bg-white/38"
                >
                  Modifier l&apos;empreinte
                </Link>
                <Link
                  href="/agents/pierre/setup"
                  className="inline-flex items-center rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)] transition hover:bg-white/38"
                >
                  Configuration Pierre
                </Link>
                <Link
                  href="/profile/agents#empreinte-entreprise"
                  className="inline-flex items-center rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)] transition hover:bg-white/38"
                >
                  Voir dans cockpit
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                Empreinte Entreprise manquante
              </p>
              <p className="text-xs text-[var(--cs-ink-3)]">
                Pierre peut être utilisé, mais le contexte entreprise global n&apos;est pas encore disponible.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Link
                  href="/profile/onboarding"
                  className="inline-flex items-center rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)] transition hover:bg-white/38"
                >
                  Créer l&apos;Empreinte Entreprise →
                </Link>
                <Link
                  href="/agents/pierre/setup"
                  className="inline-flex items-center rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)] transition hover:bg-white/38"
                >
                  Configuration Pierre
                </Link>
              </div>
            </div>
          )}
        </LiquidGlass>
      </div>
    </main>
  );
}

function CheckingGate() {
  return (
    <main className="cs-page">
      <div className="cs-page-shell flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--cs-ink-3)]">
          <Loader2 className="h-5 w-5 animate-spin text-[#667cff]" />
          <span className="text-sm font-medium">Vérification de l&apos;accès…</span>
        </div>
      </div>
    </main>
  );
}

// Mounted only after access confirmed — hooks run unconditionally inside.
// PHASE 3.12 — reçoit footprintResult pour accéder à cockpit.setInputDraft.
// Préremplit uniquement le composer. Aucun envoi automatique.
function CockpitWrapper(props: { footprintResult: PierreUseFootprintReadResult | null }) {
  const { footprintResult } = props;
  const cockpit = usePierreCockpit();
  const [prefillConfirmation, setPrefillConfirmation] = useState<string | null>(null);

  // PHASE 3.12 — Callback prefill safe : uniquement setInputDraft, jamais submitMission.
  // Préremplit uniquement le composer. Aucun envoi automatique.
  function handleUseFootprintSuggestion(payload: PierreFootprintPrefillPayload) {
    const validation = validatePierreFootprintPrefillPayload(payload);
    if (!validation.valid) return;
    const sanitized = sanitizePierreFootprintPrefillPrompt(payload.prompt);
    cockpit.setInputDraft(sanitized);
    const confirmation = buildPierreFootprintPrefillConfirmation(payload);
    setPrefillConfirmation(confirmation.message);
    // Effacer confirmation après 4 secondes
    setTimeout(() => setPrefillConfirmation(null), 4000);
  }

  return (
    <>
      {/* PHASE 8.6 — the governed, server-authoritative cockpit overview (real snapshot; no mocks). */}
      <CockpitGovernedOverview />
      <PierreUseFootprintStrip
        result={footprintResult}
        onUseSuggestion={handleUseFootprintSuggestion}
        prefillConfirmation={prefillConfirmation}
      />
      <PierreCockpitShell cockpit={cockpit} />
    </>
  );
}

function CockpitContent() {
  useRequireAuth();
  const [accessState, setAccessState] = useState<AccessState>("checking");

  // ── PHASE 3.11 — Empreinte Entreprise (localStorage read-only) ─────────────
  // Pas de Supabase, pas de DB write, pas de runtime Pierre, pas d'auto-submit.
  const [footprintResult, setFootprintResult] =
    useState<PierreUseFootprintReadResult | null>(null);

  useEffect(() => {
    try {
      const result = loadPierreUseEnterpriseFootprint();
      setFootprintResult(result);
    } catch {
      /* Silent fail — localStorage indisponible */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      // Dev/test uniquement (mort en production) : rendre le cockpit actif pour la QA.
      if (isAuthBypassEnabled()) {
        if (!cancelled) setAccessState("active");
        return;
      }
      try {
        const { data } = await getSessionClient().auth.getSession();
        const token = data.session?.access_token ?? null;

        if (!token) {
          if (!cancelled) setAccessState("unauthenticated");
          return;
        }

        const headers = buildCheckoutAuthHeaders(token);
        if (!headers) {
          if (!cancelled) setAccessState("unauthenticated");
          return;
        }

        const res = await fetch("/api/checkout?agent_slug=pierre", { headers });
        if (!res.ok) {
          if (!cancelled) setAccessState("no_access");
          return;
        }
        const body = (await res.json().catch(() => null)) as { active?: boolean } | null;
        if (!cancelled) setAccessState(body?.active === true ? "active" : "no_access");
      } catch {
        if (!cancelled) setAccessState("no_access");
      }
    }

    void checkAccess();
    return () => { cancelled = true; };
  }, []);

  if (accessState === "checking") return <CheckingGate />;
  if (accessState === "no_access" || accessState === "unauthenticated")
    return <NoAccessGate footprintResult={footprintResult} />;
  // P9.3 — cockpit opérationnel client final (données réelles V1 via client-cockpit).
  // L'ancien CockpitWrapper (overview technique + strip) reste défini mais n'est
  // plus rendu ; le nouveau shell est l'expérience client officielle.
  void CockpitWrapper;
  return <OperationalCockpitShell />;
}

export default function PierreCockpitPage() {
  return (
    <Suspense fallback={<CheckingGate />}>
      <CockpitContent />
    </Suspense>
  );
}
