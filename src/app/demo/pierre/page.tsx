// P-FINAL 01 — Phase 6 — /demo/pierre — Public illustrative demo page.
// ABSOLUTE: No real AI calls, no real emails, no real accounts, no Stripe checkout.
// All content is pre-defined and illustrative.

import { Play, AlertTriangle, Lock, ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import {
  DEMO_DISCLAIMER,
  DEMO_EMPLOYEES,
  DEMO_TASKS,
  DEMO_COCKPIT_STATS,
  DEMO_PERSONA,
  DEMO_SIMULATED_PIERRE_RESPONSES,
} from "@/lib/demo/public-demo/demo-content";
import { DEMO_SCENARIOS } from "@/lib/demo/public-demo/demo-scenario";

function DemoWarningBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="text-xs font-semibold leading-6 text-amber-800">
          Démonstration illustrative — Données fictives uniquement
        </p>
        <p className="text-xs leading-6 text-amber-700">{DEMO_DISCLAIMER.full}</p>
      </div>
    </div>
  );
}

function DemoSafetyBadges() {
  const badges = [
    { icon: Lock, label: "Aucun email envoyé" },
    { icon: Lock, label: "Aucun appel IA réel" },
    { icon: Lock, label: "Aucun compte créé" },
    { icon: Lock, label: "Aucun paiement" },
    { icon: Lock, label: "Données fictives" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-800"
        >
          <b.icon className="h-3 w-3" />
          {b.label}
        </span>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cs-card text-center">
      <p className="text-2xl font-bold tracking-tight text-[var(--cs-ink-1)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--cs-ink-4)]">{label}</p>
    </div>
  );
}

function EmployeeCard({ emp }: { emp: (typeof DEMO_EMPLOYEES)[number] }) {
  return (
    <div className="cs-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm text-[var(--cs-ink-1)]">{emp.name}</p>
          <p className="text-xs text-[var(--cs-ink-4)]">{emp.role}</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {emp.status}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs text-[var(--cs-ink-4)]">
          Contrat : <span className="font-medium text-[var(--cs-ink-2)]">{emp.contract_type}</span>
        </p>
        <p className="text-xs text-[var(--cs-ink-4)]">
          Depuis : <span className="font-medium text-[var(--cs-ink-2)]">{emp.start_date}</span>
        </p>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: (typeof DEMO_TASKS)[number] }) {
  return (
    <div className="cs-card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--cs-violet)]/10">
          <Play className="h-3 w-3 text-[var(--cs-violet)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--cs-ink-1)] leading-snug">{task.title}</p>
          <p className="mt-1 text-xs text-[var(--cs-ink-4)]">{task.assigned_to}</p>
          <div className="mt-3 rounded-lg bg-[var(--cs-violet)]/5 px-3 py-2 text-xs leading-6 text-[var(--cs-ink-3)]">
            <span className="font-semibold">Pierre (simulé) :</span> {task.simulated_output}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: (typeof DEMO_SCENARIOS)[number] }) {
  return (
    <div className="cs-card">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-[var(--cs-violet)]" />
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{scenario.name}</p>
        </div>
        <p className="text-xs leading-6 text-[var(--cs-ink-4)]">{scenario.description}</p>
        <p className="text-xs text-[var(--cs-ink-4)]">
          Persona : <span className="font-medium text-[var(--cs-ink-2)]">{scenario.persona}</span>
          <span className="ml-2 text-[var(--cs-violet)]">{scenario.steps.length} étapes</span>
        </p>
      </div>
    </div>
  );
}

export default function PierreDemoPage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-8">
          {/* Hero */}
          <section className="cs-command-surface overflow-hidden">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cs-pill">
                  <Play className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  <span>Démonstration Pierre</span>
                </span>
                <span className="cs-pill">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <span>Illustrative — Données fictives</span>
                </span>
              </div>
              <div className="space-y-4">
                <h1 className="cs-display text-[clamp(2rem,3.5vw,4.2rem)] leading-[0.96]">
                  Pierre en action —
                  <br />
                  <span className="cs-gradient-text">Votre employé IA RH.</span>
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                  Découvrez comment Pierre assiste les équipes RH au quotidien. Cette démonstration
                  utilise uniquement des données fictives et des réponses pré-définies —
                  aucun appel IA réel, aucun email envoyé, aucun compte créé.
                </p>
              </div>
              <DemoSafetyBadges />
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <span>Accéder à Pierre (abonnement)</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/legal/cgv"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.72)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.56)_100%)] px-5 text-sm font-semibold text-[var(--cs-ink-2)] shadow-[0_10px_30px_rgba(31,41,55,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all hover:-translate-y-0.5"
                >
                  Voir les CGV
                </Link>
              </div>
            </div>
          </section>

          <DemoWarningBanner />

          {/* Demo company context */}
          <section className="cs-panel px-5 py-4">
            <p className="text-xs font-semibold text-[var(--cs-ink-3)] mb-2">Contexte de la démo</p>
            <p className="text-sm text-[var(--cs-ink-2)]">
              <strong>{DEMO_PERSONA.company_name}</strong> — {DEMO_PERSONA.company_size} —
              Responsable RH : {DEMO_PERSONA.rh_manager_name}
            </p>
            <p className="text-xs mt-1 text-[var(--cs-ink-4)]">
              Toutes les personnes et données mentionnées sont entièrement fictives.
            </p>
          </section>

          {/* Cockpit stats */}
          <div>
            <h2 className="cs-heading mb-4">Cockpit Pierre (illustratif)</h2>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Tâches terminées" value={DEMO_COCKPIT_STATS.tasks_completed_this_month} />
              <StatCard label="En cours" value={DEMO_COCKPIT_STATS.tasks_in_progress} />
              <StatCard label="Documents préparés" value={DEMO_COCKPIT_STATS.documents_drafted} />
              <StatCard label="Emails prêts" value={DEMO_COCKPIT_STATS.emails_prepared} />
              <StatCard label="Absences gérées" value={DEMO_COCKPIT_STATS.absences_managed} />
              <StatCard label="Temps économisé" value={DEMO_COCKPIT_STATS.time_saved_hours} />
            </div>
            <p className="mt-2 text-xs text-[var(--cs-ink-4)]">{DEMO_COCKPIT_STATS.note}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Demo employees */}
            <div>
              <h2 className="cs-heading mb-4">Équipe fictive</h2>
              <div className="space-y-3">
                {DEMO_EMPLOYEES.map((emp) => (
                  <EmployeeCard key={emp.id} emp={emp} />
                ))}
              </div>
            </div>

            {/* Demo tasks */}
            <div>
              <h2 className="cs-heading mb-4">Missions Pierre simulées</h2>
              <div className="space-y-3">
                {DEMO_TASKS.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <div>
            <h2 className="cs-heading mb-4">Scénarios illustratifs</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {DEMO_SCENARIOS.map((scenario) => (
                <ScenarioCard key={scenario.id} scenario={scenario} />
              ))}
            </div>
          </div>

          {/* Pierre simulated response example */}
          <div>
            <h2 className="cs-heading mb-4">Exemple de réponse Pierre (pré-définie)</h2>
            <div className="cs-card">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cs-violet)]">
                  <span className="text-xs font-bold text-white">P</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--cs-ink-3)]">
                    Pierre — Réponse simulée (démo illustrative)
                  </p>
                  <p className="text-sm leading-7 text-[var(--cs-ink-2)]">
                    {DEMO_SIMULATED_PIERRE_RESPONSES.general}
                  </p>
                  <p className="text-xs leading-6 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                    {DEMO_DISCLAIMER.legal}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <section className="cs-command-surface">
            <div className="space-y-4 text-center">
              <h2 className="cs-heading">Prêt à utiliser Pierre en production ?</h2>
              <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
                L'abonnement Pierre à 449 € / mois donne accès à la version complète avec vos
                données réelles. Validation humaine obligatoire pour tous les documents officiels.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <span>Souscrire à Pierre</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/legal/cgu"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.72)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.56)_100%)] px-5 text-sm font-semibold text-[var(--cs-ink-2)] shadow-[0_10px_30px_rgba(31,41,55,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all hover:-translate-y-0.5"
                >
                  Lire les CGU
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
