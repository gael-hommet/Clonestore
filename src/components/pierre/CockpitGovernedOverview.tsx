"use client";
// src/components/pierre/CockpitGovernedOverview.tsx
// PHASE 8.6 — the REAL, governed cockpit overview. It renders ONLY from GET /api/pierre/v1/cockpit/snapshot
// (server-authoritative, tenant resolved server-side). No localStorage, no mock, no demo, no hardcoded
// counter, no silent fallback: a fetch error becomes a DISTINCT error state (never an empty/zero overview),
// and the product-access decision drives distinct UX states (onboarding_required / grace / suspended /
// read_only / forbidden). The "Lancer la première mission de Pierre" CTA calls the real
// POST /api/pierre/v1/missions/first route and then reloads the server snapshot — never an optimistic or
// client-fabricated terminal state. On (re)mount it always fetches fresh for the ACTIVE tenant, so a
// tenant switch (which reloads the page) never shows the previous tenant's data.

import { useCallback, useEffect, useState } from "react";

type Decision = "allowed" | "grace" | "onboarding_required" | "read_only" | "suspended" | "denied";

type Snapshot = {
  company: { id: string; name: string | null; legal_name: string | null };
  role: string | null;
  product_access: { decision: Decision; reason: string };
  entitlement: { status: string } | null;
  onboarding: { status: string; progress_percent: number } | null;
  overview: {
    active_missions: number; waiting_missions: number; required_validations: number;
    pending_documents: number; pending_signatures: number; blocked_communications: number;
    active_members: number; employees_count: number;
  };
  next_action: string;
  blockers: string[];
};

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "forbidden" }
  | { kind: "ready"; snapshot: Snapshot };

const DECISION_LABEL: Record<Decision, string> = {
  allowed: "Actif",
  grace: "Paiement en attente (continuité)",
  onboarding_required: "Configuration requise",
  read_only: "Lecture seule",
  suspended: "Suspendu",
  denied: "Aucun accès",
};

export default function CockpitGovernedOverview() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setView({ kind: "loading" });
    try {
      const res = await fetch("/api/pierre/v1/cockpit/snapshot", { cache: "no-store", credentials: "include" });
      if (res.status === 401 || res.status === 403) { setView({ kind: "forbidden" }); return; }
      if (!res.ok) { setView({ kind: "error", message: `Le tableau de bord n'a pas pu être chargé (HTTP ${res.status}).` }); return; }
      const body = (await res.json()) as { snapshot?: Snapshot };
      if (!body.snapshot) { setView({ kind: "error", message: "Réponse du tableau de bord invalide." }); return; }
      setView({ kind: "ready", snapshot: body.snapshot });
    } catch {
      // a transport failure is an ERROR — never silently shown as an empty / zeroed dashboard.
      setView({ kind: "error", message: "Le tableau de bord est momentanément indisponible." });
    }
  }, []);

  // fetch fresh on mount (the active tenant is server-resolved; a tenant switch reloads the page → refetch).
  useEffect(() => { void load(); }, [load]);

  const launchFirstMission = useCallback(async () => {
    setLaunching(true); setLaunchError(null);
    try {
      const res = await fetch("/api/pierre/v1/missions/first", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: "{}" });
      if (!res.ok) { setLaunchError(`Le lancement a échoué (HTTP ${res.status}).`); return; }
      await load(); // reload the REAL server snapshot — no optimistic/terminal client state
    } catch {
      setLaunchError("Le lancement de la mission a échoué.");
    } finally {
      setLaunching(false);
    }
  }, [load]);

  if (view.kind === "loading") {
    return <section aria-busy="true" data-cockpit-overview="loading" className="rounded-xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-500">Chargement du tableau de bord…</section>;
  }
  if (view.kind === "forbidden") {
    return <section data-cockpit-overview="forbidden" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Accès au tableau de bord non autorisé pour cet espace.</section>;
  }
  if (view.kind === "error") {
    return (
      <section data-cockpit-overview="error" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>{view.message}</p>
        <button type="button" onClick={() => void load()} className="mt-2 rounded-md border border-red-300 px-3 py-1 text-red-800 hover:bg-red-100">Réessayer</button>
      </section>
    );
  }

  const s = view.snapshot;
  const d = s.product_access.decision;
  const o = s.overview;
  const cards: Array<{ label: string; value: number }> = [
    { label: "Missions actives", value: o.active_missions },
    { label: "En attente", value: o.waiting_missions },
    { label: "Validations requises", value: o.required_validations },
    { label: "Documents en cours", value: o.pending_documents },
    { label: "Signatures en cours", value: o.pending_signatures },
    { label: "Communications bloquées", value: o.blocked_communications },
    { label: "Membres actifs", value: o.active_members },
    { label: "Salariés", value: o.employees_count },
  ];

  return (
    <section data-cockpit-overview="ready" data-decision={d} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{s.company.name ?? "Mon entreprise"}</h2>
          <p className="text-xs text-slate-500">Rôle : {s.role ?? "—"} · État : {DECISION_LABEL[d]}</p>
        </div>
        {s.onboarding && s.onboarding.status !== "completed" && (
          <span data-onboarding="incomplete" className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">Onboarding {s.onboarding.progress_percent}%</span>
        )}
      </header>

      {d === "onboarding_required" && (
        <p data-state="onboarding_required" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">Terminez la configuration de votre espace pour activer Pierre.</p>
      )}
      {d === "grace" && (
        <p data-state="grace" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Votre paiement est en attente. L'accès continue, mais les nouvelles actions facturées sont suspendues.</p>
      )}
      {(d === "suspended" || d === "read_only") && (
        <p data-state="suspended" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Abonnement {DECISION_LABEL[d].toLowerCase()} : consultation et export uniquement. Réactivez pour reprendre les opérations.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-2xl font-semibold text-slate-900">{c.value}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {d === "allowed" && o.active_missions === 0 && (
        <div data-cta="first-mission" className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900">Tout est prêt. Lancez la première mission de Pierre.</p>
          <button type="button" disabled={launching} onClick={() => void launchFirstMission()}
            className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {launching ? "Lancement…" : "Lancer la première mission de Pierre"}
          </button>
          {launchError && <p className="mt-2 text-xs text-red-700">{launchError}</p>}
        </div>
      )}
    </section>
  );
}
