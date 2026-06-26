// GO-LIVE 10 — /profile/go-live — Production Blockers Dashboard & Final Launch Gate.
// Internal page. noindex/nofollow. No API calls. No flags modified.
// Premium CloneStore design: crème/ivoire/graphite palette, glass cards.

import React from "react";
import type { Metadata } from "next";
import {
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building2,
  CreditCard,
  Scale,
  Shield,
  TerminalSquare,
  Sparkles,
  Globe,
  Users,
  Lock,
} from "lucide-react";

import { getFinalLaunchGateVerdict } from "@/lib/go-live/final-launch-gate/final-launch-verdict";
import { FINAL_LAUNCH_BLOCKERS } from "@/lib/go-live/final-launch-gate/final-launch-blockers";
import {
  GAEL_ACTIONS,
  WHILE_WAITING_ACTIONS,
} from "@/lib/go-live/final-launch-gate/final-launch-actions";
import { FINAL_LAUNCH_PROOF_MAP, getProofsByType } from "@/lib/go-live/final-launch-gate/final-launch-proof-map";
import type { BlockerStatus } from "@/lib/go-live/final-launch-gate/final-launch-gate-types";

export const metadata: Metadata = {
  title: "Production Blockers Dashboard — CloneStore",
  description: "Tableau de bord des blockers production avant lancement public de Pierre",
  robots: "noindex, nofollow",
};

const verdict = getFinalLaunchGateVerdict();

// ── Icon map ─────────────────────────────────────────────────────────────────

const BLOCKER_ICONS: Record<string, React.ElementType> = {
  product_core: TerminalSquare,
  public_site: Globe,
  supabase_preprod_security: Shield,
  first_customer_onboarding: Users,
  stripe_test: CreditCard,
  legal_public_copy: Scale,
  support_ops: Users,
  legal_entity: Building2,
  legal_review: Scale,
  stripe_live: CreditCard,
  production_rls: Shield,
  live_paid_customer_e2e: Users,
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BlockerStatus }) {
  if (status === "ready")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 size={10} />
        Prêt
      </span>
    );
  if (status === "partial_ready")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Clock size={10} />
        Partiel
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        <Clock size={10} />
        Pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <XCircle size={10} />
      Bloquant
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductionBlockersDashboardPage(): React.JSX.Element {
  const readyBlockers = FINAL_LAUNCH_BLOCKERS.filter((b) => b.status === "ready");
  const partialBlockers = FINAL_LAUNCH_BLOCKERS.filter((b) => b.status === "partial_ready");
  const hardBlockers = FINAL_LAUNCH_BLOCKERS.filter((b) => b.status === "blocked");
  const publicLaunchBlockers = FINAL_LAUNCH_BLOCKERS.filter(
    (b) => b.blocks_public_launch && b.status === "blocked"
  );

  const stagingProofs = getProofsByType("staging_test");
  const repoProofs = getProofsByType("repo_tooling");
  const liveProofs = getProofsByType("production_live");
  const humanProofs = getProofsByType("human_legal");

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F8F6F1 0%, #FAF8F5 100%)" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-stone-200/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-stone-800 sm:text-lg">
                Production Blockers Dashboard
              </h1>
              <span className="rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                Interne
              </span>
              <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                NO-GO
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-400">GO-LIVE 10 — Pierre est prêt côté repo. Lancement public bloqué côté externe.</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs text-stone-400">{FINAL_LAUNCH_BLOCKERS.length} domaines</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">

        {/* ── Hero verdict ─────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50/50 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-red-200 bg-red-100">
              <XCircle size={20} className="text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-red-900 sm:text-2xl">Lancement public : NO-GO</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  <span className="text-sm text-stone-700">Démo privée / produit : <strong>OK</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  <span className="text-sm text-stone-700">Repo Pierre produit : <strong>prêt</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="shrink-0 text-red-500" />
                  <span className="text-sm text-stone-700">Vente publique : <strong>bloquée</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="shrink-0 text-red-500" />
                  <span className="text-sm text-stone-700">Société / Stripe / Juridique : <strong>pending</strong></span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {publicLaunchBlockers.map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
                  >
                    {b.human_label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-700">{readyBlockers.length}</p>
            <p className="mt-0.5 text-xs text-stone-500">Domaines prêts</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-2xl font-bold text-amber-700">{partialBlockers.length}</p>
            <p className="mt-0.5 text-xs text-stone-500">Partiels / pending</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-2xl font-bold text-red-700">{hardBlockers.length}</p>
            <p className="mt-0.5 text-xs text-stone-500">Bloquants</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white/60 p-4">
            <p className="text-2xl font-bold text-stone-700">8039</p>
            <p className="mt-0.5 text-xs text-stone-500">Tests validés</p>
          </div>
        </div>

        {/* ── Ce qui est prêt ───────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
            <CheckCircle2 size={15} className="text-emerald-600" />
            Ce qui est prêt ({readyBlockers.length} domaines)
          </h2>
          <div className="space-y-2">
            {readyBlockers.map((b) => {
              const Icon = BLOCKER_ICONS[b.id] ?? Sparkles;
              return (
                <div
                  key={b.id}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white/60 p-4"
                >
                  <Icon size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-stone-800">{b.title}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{b.description}</p>
                    {b.next_action && (
                      <p className="mt-1 text-xs text-stone-400 italic">{b.next_action}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Partiels ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
            <AlertTriangle size={15} className="text-amber-500" />
            Partiels / pending ({partialBlockers.length} domaines)
          </h2>
          <div className="space-y-2">
            {partialBlockers.map((b) => {
              const Icon = BLOCKER_ICONS[b.id] ?? Clock;
              return (
                <div
                  key={b.id}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white/60 p-4"
                >
                  <Icon size={15} className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-stone-800">{b.title}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{b.description}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <ArrowRight size={11} className="shrink-0" />
                      {b.next_action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Ce qui bloque ────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
            <XCircle size={15} className="text-red-500" />
            Ce qui bloque le lancement public ({hardBlockers.length} bloquants)
          </h2>
          <div className="space-y-2">
            {hardBlockers.map((b) => {
              const Icon = BLOCKER_ICONS[b.id] ?? Lock;
              return (
                <div
                  key={b.id}
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-white/60 p-4"
                >
                  <Icon size={15} className="mt-0.5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-stone-800">{b.title}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{b.description}</p>
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-700">
                      <ArrowRight size={11} className="shrink-0" />
                      {b.next_action}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      Propriétaire : {b.owner} {b.can_be_done_now ? "· Peut démarrer maintenant" : "· Dépend d'étapes préalables"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Actions Gael ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-700">
            Actions Gaël — dans l&apos;ordre recommandé
          </h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/60 divide-y divide-stone-100">
            {GAEL_ACTIONS.map((step) => (
              <div key={step.priority} className="flex items-start gap-3 px-4 py-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 mt-0.5">
                  {step.priority}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">{step.action}</p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    Débloque → {step.unlocks}
                    {step.depends_on && <span className="ml-2 text-stone-300">· Dépend : {step.depends_on}</span>}
                  </p>
                </div>
                <div className="ml-auto shrink-0">
                  {step.can_start_now ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      Maintenant
                    </span>
                  ) : (
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-stone-400">
                      Après étape préc.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Actions repo ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Actions repo</h2>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Aucun travail repo urgent</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                  Le produit Pierre, le site public et l&apos;onboarding sont prêts côté repo. Ne pas rouvrir le moteur Pierre sans bug réel. Ne pas refaire le site ou /demo/pierre sans régression confirmée. Ne pas modifier les flags public launch.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── En attendant ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-700">
            Ce qu&apos;on peut faire en attendant société / Stripe / juriste
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {WHILE_WAITING_ACTIONS.map((action) => (
              <div
                key={action.priority}
                className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white/60 p-4"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-50 border border-violet-200 text-xs font-semibold text-violet-600 mt-0.5">
                  {action.priority}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">{action.action}</p>
                  <p className="mt-0.5 text-xs text-stone-400">→ {action.unlocks}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Proof map ────────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Cartographie des preuves</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                { label: "Staging / Test", proofs: stagingProofs, color: "blue" },
                { label: "Repo / Tooling", proofs: repoProofs, color: "emerald" },
                { label: "Production / Live", proofs: liveProofs, color: "red" },
                { label: "Humain / Juridique", proofs: humanProofs, color: "amber" },
              ] as const
            ).map(({ label, proofs, color }) => (
              <div
                key={label}
                className={`rounded-xl border p-4 ${
                  color === "emerald"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : color === "blue"
                    ? "border-blue-200 bg-blue-50/50"
                    : color === "red"
                    ? "border-red-200 bg-red-50/50"
                    : "border-amber-200 bg-amber-50/50"
                }`}
              >
                <p className="mb-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">{label}</p>
                <ul className="space-y-1">
                  {proofs.map((p) => (
                    <li key={p.proof_id} className="flex items-start gap-1.5 text-xs text-stone-600">
                      <span className="mt-0.5 shrink-0 text-stone-400">·</span>
                      <span>
                        <code className="font-mono text-[10px] text-stone-500">{p.proof_id}</code>
                        {p.auto_verifiable && (
                          <span className="ml-1 text-emerald-600 text-[10px]">(auto)</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Scripts de vérification ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Scripts de vérification</h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/60 divide-y divide-stone-100">
            {[
              { cmd: "npm run check:legal-public-copy", desc: "Scan légal et copy public (GO-LIVE 03)" },
              { cmd: "npm run check:stripe-live", desc: "Vérifier la config Stripe live (produit 449€/mois)" },
              { cmd: "npm run check:supabase-rls", desc: "Guide RLS Supabase" },
              { cmd: "npm run check:paid-customer-testmode", desc: "E2E test mode readiness (GO-LIVE 08)" },
              { cmd: "npm run test:pfinal02", desc: "Tests P-FINAL 02 + GO-LIVE" },
              { cmd: "npm run test:pfinal01", desc: "Tests P-FINAL 01" },
              { cmd: "npm run build", desc: "Build production" },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <code className="break-all rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-mono text-xs text-emerald-700">
                  {cmd}
                </code>
                <span className="text-xs text-stone-400">— {desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final gate ───────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-red-300 bg-red-50 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="font-semibold text-red-900">Règle finale — Ne jamais confondre</p>
              <p className="mt-2 text-sm leading-relaxed text-red-700">
                <strong>Repo prêt ≠ Commercialement lançable.</strong> Pierre est techniquement prêt côté produit. Le lancement public est impossible tant que les blockers externes ne sont pas levés: société immatriculée, Stripe live configuré, revue juridique humaine effectuée, RLS production vérifié, E2E live exécuté.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-red-700">
                <code className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs">
                  B48_PUBLIC_LAUNCH_ENABLED=true
                </code>{" "}
                ne doit jamais être passé sans que{" "}
                <code className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs">
                  buildGoLiveVerdictFromProofs().is_public_launch_go
                </code>{" "}
                retourne{" "}
                <code className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs">
                  true
                </code>.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <p className="pb-2 text-center text-xs text-stone-400">
          Page interne — GO-LIVE 10. Pierre n&apos;est pas avocat, juriste ni logiciel de paie officiel.
          La conformité juridique finale nécessite une revue humaine par un professionnel qualifié.
        </p>
      </div>
    </div>
  );
}
