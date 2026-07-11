"use client";

// src/components/pierre/autonomy/PierreAutonomyPanel.tsx
// P9.5 — Surface produit « Autonomie de Pierre ». Laisse l'entreprise CHOISIR le niveau
// d'autonomie de Pierre (brouillon → autonomie gouvernée → dirigeant), et affiche la matrice
// RÉELLE « ce que Pierre fait seul / prépare / propose en validation / réservé humain » —
// DÉRIVÉE côté serveur du moteur P8 decideValidation (jamais des labels cosmétiques). Le choix
// est écrit côté serveur (colonne P8 default_autonomy_mode, permission gouvernée). Copie produit :
// « Pierre — votre employé IA RH » (jamais « assistant » / « copilote »).

import { useCallback, useEffect, useState } from "react";

interface ModeView { id: string; label: string; tagline: string; description: string; engineMode: string; supervisor: "human_team" | "dirigeant"; order: number; }
interface MatrixEntry { key: string; label: string; decision: string; bucket: string; bucketLabel: string; }
interface AutonomyData {
  framing: { headline: string; subhead: string; governance: string; hybrid: string };
  companyResolved?: boolean;
  current: { productModeId: string; engineMode: string; version: number };
  modes: ModeView[];
  matrix: { productModeId: string; supervisor: string; entries: MatrixEntry[] };
}

// Groupes affichés (ordonnés) — libellés produit clairs.
const BUCKET_GROUPS: ReadonlyArray<{ buckets: readonly string[]; title: string; hint: string; tone: string }> = [
  { buckets: ["alone", "notify"], title: "Pierre le fait seul", hint: "Exécuté automatiquement (vous êtes notifié).", tone: "ok" },
  { buckets: ["prepare"], title: "Pierre prépare, vous décidez", hint: "Rédigé et prêt ; rien ne sort sans votre décision.", tone: "prep" },
  { buckets: ["validation"], title: "Pierre propose, un humain valide", hint: "Action importante soumise à validation.", tone: "warn" },
  { buckets: ["human_only"], title: "Réservé à une décision humaine", hint: "Sensible / restreint : jamais automatisé, quel que soit le mode.", tone: "human" },
  { buckets: ["blocked"], title: "Bloqué — escalade requise", hint: "Bloqué par une garde critique.", tone: "block" },
];

export function PierreAutonomyPanel({ authHeaders }: { authHeaders?: () => Record<string, string> } = {}) {
  const [data, setData] = useState<AutonomyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const headers = useCallback(() => ({ "Content-Type": "application/json", ...(authHeaders?.() ?? {}) }), [authHeaders]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/autonomy", { headers: authHeaders?.() ?? {}, credentials: "same-origin" });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) { setData(d as AutonomyData); setError(null); } else setError(d?.error ?? "Réglage d'autonomie indisponible.");
    } catch { setError("Réglage d'autonomie indisponible."); } finally { setLoading(false); }
  }, [authHeaders]);
  useEffect(() => { void load(); }, [load]);

  const select = useCallback(async (productModeId: string) => {
    if (saving || data?.current.productModeId === productModeId || data?.companyResolved === false) return;
    setSaving(productModeId); setError(null);
    try {
      const res = await fetch("/api/assistant/autonomy", { method: "POST", headers: headers(), credentials: "same-origin", body: JSON.stringify({ productModeId }) });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) setData((prev) => (prev ? { ...prev, current: d.current, matrix: d.matrix } : prev));
      else setError(d?.error ?? "Le réglage n'a pas pu être enregistré.");
    } catch { setError("Le réglage n'a pas pu être enregistré."); } finally { setSaving(null); }
  }, [saving, data, headers]);

  if (loading) return <div className="p-8 text-sm text-[var(--cs-ink-3)]" aria-busy="true">Chargement du niveau d'autonomie de Pierre…</div>;
  if (!data) return <div className="p-8 text-sm text-[var(--cs-danger)]" role="alert">{error ?? "Réglage indisponible."}</div>;

  const current = data.modes.find((m) => m.id === data.current.productModeId);
  const entriesByBucket = (buckets: readonly string[]) => data.matrix.entries.filter((e) => buckets.includes(e.bucket));

  return (
    <section data-tour-id="pierre-autonomy" className="mx-auto max-w-4xl px-1 py-2">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cs-violet)]">Autonomie de Pierre</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--cs-ink-1)]">{data.framing.headline}</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--cs-ink-3)]">{data.framing.subhead}</p>
        <p className="mt-1 max-w-2xl text-xs text-[var(--cs-ink-4)]">{data.framing.governance} {data.framing.hybrid}</p>
      </header>

      {error ? <div className="mb-4 rounded-lg border border-[var(--cs-danger)]/30 bg-[var(--cs-danger)]/5 px-3 py-2 text-sm text-[var(--cs-danger)]" role="alert">{error}</div> : null}
      {data.companyResolved === false ? <div className="mb-4 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-ink-1)]/[0.03] px-3 py-2 text-xs text-[var(--cs-ink-3)]">Rattachez-vous à une entreprise active pour enregistrer le niveau d'autonomie de Pierre. Les niveaux et leur portée restent consultables ci-dessous.</div> : null}

      {/* Sélecteur de mode */}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Niveau d'autonomie de Pierre">
        {data.modes.map((m) => {
          const selected = m.id === data.current.productModeId;
          const busy = saving === m.id;
          const disabled = !!saving || data.companyResolved === false;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => void select(m.id)}
              className={[
                "text-left rounded-xl border p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-violet)]",
                selected ? "border-[var(--cs-violet)] bg-[var(--cs-violet)]/5 shadow-[var(--cs-shadow-soft)]" : "border-[var(--cs-line)] hover:border-[var(--cs-ink-4)]",
                saving ? "opacity-70" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--cs-ink-1)]">{m.label}</span>
                {selected ? <span className="rounded-full bg-[var(--cs-violet)] px-2 py-0.5 text-[10px] font-semibold text-white">Actif</span> : busy ? <span className="text-[10px] text-[var(--cs-ink-4)]">…</span> : null}
                {m.supervisor === "dirigeant" ? <span className="rounded-full border border-[var(--cs-line)] px-2 py-0.5 text-[10px] text-[var(--cs-ink-3)]">Dirigeant</span> : null}
              </div>
              <p className="mt-1 text-xs font-medium text-[var(--cs-ink-2)]">{m.tagline}</p>
              <p className="mt-1 text-xs text-[var(--cs-ink-4)]">{m.description}</p>
            </button>
          );
        })}
      </div>

      {/* Matrice DÉRIVÉE du moteur pour le mode courant */}
      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[var(--cs-ink-1)]">En mode « {current?.label} », concrètement</h3>
          <span className="text-[11px] text-[var(--cs-ink-4)]">Dérivé de la politique réelle de Pierre</span>
        </div>
        <div className="mt-3 space-y-3">
          {BUCKET_GROUPS.map((g) => {
            const items = entriesByBucket(g.buckets);
            if (items.length === 0) return null;
            return (
              <div key={g.title} className="rounded-xl border border-[var(--cs-line)] p-3">
                <div className="flex items-center gap-2">
                  <span className={["inline-block h-2 w-2 rounded-full",
                    g.tone === "ok" ? "bg-[var(--cs-violet)]" : g.tone === "prep" ? "bg-[var(--cs-ink-4)]" : g.tone === "warn" ? "bg-[var(--cs-warn)]" : g.tone === "human" ? "bg-[var(--cs-danger)]" : "bg-[var(--cs-danger)]"].join(" ")} aria-hidden="true" />
                  <span className="text-xs font-semibold text-[var(--cs-ink-1)]">{g.title}</span>
                  <span className="text-[11px] text-[var(--cs-ink-4)]">· {g.hint}</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((e) => (
                    <li key={e.key} className="rounded-full border border-[var(--cs-line)] bg-white/60 px-2.5 py-1 text-[11px] text-[var(--cs-ink-2)]" title={e.decision}>{e.label}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-[var(--cs-ink-4)]">
          Les décisions réservées à un humain (disciplinaire, licenciement, médical, juridique) restent gouvernées et ne
          sont JAMAIS automatisées, quel que soit le niveau choisi.
        </p>
      </div>
    </section>
  );
}
