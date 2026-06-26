// src/app/agents/pierre/employees/page.tsx
// PHASE 8.2-C — Employee 360 premium UI. Reads ONLY the canonical v1 runtime
// (/api/pierre/v1/employees…). Real search (debounced), filters, cursor
// pagination, skeletons, empty/error states, and a tabbed employee folder
// (summary, identity, employment, contracts, documents, absences, missions,
// tasks, timeline, completeness, sensitive-by-permission). Beige/écru/crème +
// Liquid Glass; responsive. Sensitive values never render without permission
// (the server enforces it; the UI only reflects the result).

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Users, AlertTriangle, ShieldAlert, CheckCircle2, Clock, FileText, Briefcase, CalendarDays, ListChecks } from "lucide-react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";

// ── v1 fetch helper (cookie session; same-origin) ────────────────────────────
type Json = Record<string, unknown>;
async function v1<T = Json>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(`/api/pierre/v1${path}`, { credentials: "same-origin", headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, ...init });
    let data: unknown = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const code = (data as { error?: { code?: string; message?: string } })?.error?.code ?? `HTTP ${res.status}`;
      return { ok: false, status: res.status, data: null, error: code };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : "network_error" };
  }
}

type EmployeeListItem = { id: string; first_name: string; last_name: string; status: string; role_title: string | null; department: string | null; site_id: string | null; employee_number: string | null };
type ListResp = { items: EmployeeListItem[]; next_cursor: string | null };

const STATUS_LABEL: Record<string, string> = { active: "Actif", onboarding: "Onboarding", candidate: "Candidat", suspended: "Suspendu", offboarding: "Départ", left: "Parti" };
const STATUS_TONE: Record<string, string> = { active: "var(--cs-success)", onboarding: "var(--cs-violet)", suspended: "var(--cs-warn)", left: "var(--cs-ink-4)" };

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// ── List ─────────────────────────────────────────────────────────────────────
function EmployeeList({ onOpen }: { onOpen: (id: string) => void }) {
  const [rawQuery, setRawQuery] = useState("");
  const query = useDebounced(rawQuery, 280);
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<EmployeeListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (append: boolean) => {
    const myReq = ++reqId.current;
    setLoading(true); setError(null);
    let resp;
    if (query.trim()) {
      resp = await v1<EmployeeListItem[]>(`/employees/search?q=${encodeURIComponent(query.trim())}&limit=30`);
      if (myReq !== reqId.current) return;
      if (resp.ok && Array.isArray(resp.data)) { setItems(resp.data); setNextCursor(null); }
      else setError(resp.error ?? "Erreur");
    } else {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (status) params.set("status", status);
      if (append && cursor) params.set("cursor", cursor);
      resp = await v1<ListResp>(`/employees?${params.toString()}`);
      if (myReq !== reqId.current) return;
      if (resp.ok && resp.data) { setItems((prev) => append ? [...prev, ...resp!.data!.items] : resp!.data!.items); setNextCursor(resp.data.next_cursor); }
      else setError(resp.error ?? "Erreur");
    }
    setLoading(false);
  }, [query, status, cursor]);

  useEffect(() => { setCursor(null); void load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query, status]);

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.5rem] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cs-ink-4)]" />
            <input
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Rechercher un salarié (nom, matricule, poste…)"
              aria-label="Rechercher un salarié"
              className="w-full rounded-full border border-white/55 bg-white/40 py-2 pl-9 pr-3 text-sm text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)] focus:border-[var(--cs-violet)]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {["", "active", "onboarding", "suspended", "left"].map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setStatus(s)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                style={status === s ? { background: "var(--cs-ink-1)", color: "white", borderColor: "var(--cs-ink-1)" } : { borderColor: "var(--cs-line)", color: "var(--cs-ink-3)" }}
              >
                {s ? STATUS_LABEL[s] : "Tous"}
              </button>
            ))}
          </div>
        </div>
      </LiquidGlass>

      {/* Results */}
      {error && (
        <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.25rem] p-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--cs-warn)" }}>
            <AlertTriangle className="h-4 w-4" /> {error === "forbidden" ? "Vous n'avez pas la permission de lire les salariés." : `Erreur de chargement (${error}).`}
            <button type="button" onClick={() => load(false)} className="ml-2 rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ borderColor: "var(--cs-line)", color: "var(--cs-ink-2)" }}>Réessayer</button>
          </div>
        </LiquidGlass>
      )}

      {loading && items.length === 0 && (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[1.1rem] border border-white/40 bg-white/20" />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.5rem] p-8 text-center">
          <Users className="mx-auto mb-3 h-7 w-7 text-[var(--cs-ink-4)]" />
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">Aucun salarié</p>
          <p className="mt-1 text-xs text-[var(--cs-ink-4)]">{rawQuery ? "Aucun résultat pour cette recherche." : "Importez un fichier CSV ou créez un salarié pour commencer."}</p>
        </LiquidGlass>
      )}

      {items.length > 0 && (
        <div className="grid gap-2">
          {items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e.id)}
              className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/50 bg-white/26 px-4 py-3 text-left transition hover:bg-white/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/60 bg-white/45 text-xs font-bold text-[var(--cs-ink-2)]">
                  {(e.first_name?.[0] ?? "?")}{(e.last_name?.[0] ?? "")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--cs-ink-1)]">{e.first_name} {e.last_name}</p>
                  <p className="truncate text-xs text-[var(--cs-ink-4)]">{[e.role_title, e.department, e.employee_number].filter(Boolean).join(" · ") || "—"}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-bold" style={{ borderColor: "var(--cs-line)", color: STATUS_TONE[e.status] ?? "var(--cs-ink-3)" }}>
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {nextCursor && !query.trim() && (
        <div className="flex justify-center">
          <button type="button" onClick={() => { setCursor(nextCursor); void load(true); }} className="rounded-full border px-4 py-2 text-xs font-semibold" style={{ borderColor: "var(--cs-line)", color: "var(--cs-ink-2)" }}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Charger plus"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Detail (folder) ──────────────────────────────────────────────────────────
const TABS = [
  { key: "summary", label: "Résumé", icon: CheckCircle2 },
  { key: "employment", label: "Emploi", icon: Briefcase },
  { key: "contracts", label: "Contrats", icon: FileText },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "absences", label: "Absences", icon: CalendarDays },
  { key: "missions", label: "Missions", icon: ListChecks },
  { key: "tasks", label: "Tâches", icon: ListChecks },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "sensitive", label: "Sensible", icon: ShieldAlert },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function CompletenessBar({ score }: { score: number }) {
  const tone = score >= 80 ? "var(--cs-success)" : score >= 50 ? "var(--cs-violet)" : "var(--cs-warn)";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs"><span className="font-semibold text-[var(--cs-ink-2)]">Complétude du dossier</span><span className="font-bold" style={{ color: tone }}>{score}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: tone }} /></div>
    </div>
  );
}

function EmployeeFolder({ id, onBack }: { id: string; onBack: () => void }) {
  const [tab, setTab] = useState<TabKey>("summary");
  const [emp, setEmp] = useState<Json | null>(null);
  const [completeness, setCompleteness] = useState<Json | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabData, setTabData] = useState<Record<string, unknown[]>>({});
  const [sensitiveDenied, setSensitiveDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const [e, c] = await Promise.all([v1(`/employees/${id}`), v1(`/employees/${id}/completeness`)]);
      if (cancelled) return;
      if (!e.ok) { setError(e.error ?? "Erreur"); setLoading(false); return; }
      setEmp(e.data); setCompleteness(c.ok ? c.data : null); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const loadTab = useCallback(async (k: TabKey) => {
    if (k === "summary" || tabData[k]) return;
    const map: Partial<Record<TabKey, string>> = { contracts: "contracts", documents: "documents", absences: "absences", missions: "missions", tasks: "tasks", timeline: "timeline", sensitive: "sensitive", employment: "" };
    if (k === "employment") return; // rendered from the 360 payload
    const sub = map[k]!;
    const resp = await v1<unknown[]>(`/employees/${id}/${sub}`);
    if (k === "sensitive" && !resp.ok && resp.error === "forbidden") { setSensitiveDenied(true); return; }
    if (resp.ok) setTabData((prev) => ({ ...prev, [k]: Array.isArray(resp.data) ? resp.data : [] }));
  }, [id, tabData]);

  useEffect(() => { void loadTab(tab); }, [tab, loadTab]);

  const employee = (emp?.employee ?? {}) as Json;
  const score = Number((completeness?.completeness_score as number) ?? 0);
  const nextActions = (completeness?.next_actions as Array<{ label?: string }> | undefined) ?? [];

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--cs-ink-3)] transition hover:text-[var(--cs-ink-1)]">
        <ArrowLeft className="h-4 w-4" /> Retour à la liste
      </button>

      {loading && <div className="h-40 animate-pulse rounded-[1.5rem] border border-white/40 bg-white/20" />}
      {error && <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.25rem] p-4"><p className="text-sm" style={{ color: "var(--cs-warn)" }}>{error === "forbidden" ? "Accès refusé à ce dossier." : `Erreur (${error}).`}</p></LiquidGlass>}

      {!loading && !error && (
        <>
          {/* Header */}
          <LiquidGlass variant="panel" intensity="strong" className="rounded-[1.75rem] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/60 bg-white/45 text-base font-bold text-[var(--cs-ink-2)]">
                  {String(employee.first_name ?? "?")[0]}{String(employee.last_name ?? "")[0]}
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-[var(--cs-ink-1)]">{String(employee.first_name ?? "")} {String(employee.last_name ?? "")}</h2>
                  <p className="text-xs text-[var(--cs-ink-4)]">{[employee.role_title, employee.department, employee.employee_number].filter(Boolean).map(String).join(" · ") || "—"}</p>
                </div>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--cs-line)", color: STATUS_TONE[String(employee.status)] ?? "var(--cs-ink-3)" }}>
                {STATUS_LABEL[String(employee.status)] ?? String(employee.status)}
              </span>
            </div>
            <div className="mt-4"><CompletenessBar score={score} /></div>
            {nextActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nextActions.slice(0, 4).map((a, i) => (
                  <span key={i} className="rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)]">{a.label ?? "Action recommandée"}</span>
                ))}
              </div>
            )}
          </LiquidGlass>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.key} type="button" onClick={() => setTab(t.key)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                  style={tab === t.key ? { background: "var(--cs-ink-1)", color: "white", borderColor: "var(--cs-ink-1)" } : { borderColor: "var(--cs-line)", color: "var(--cs-ink-3)" }}>
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.5rem] p-5">
            {tab === "summary" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email professionnel" value={employee.professional_email} />
                <Field label="Email personnel" value={employee.personal_email} />
                <Field label="Téléphone" value={employee.phone} />
                <Field label="Type de contrat" value={employee.contract_type} />
                <Field label="Département" value={employee.department} />
                <Field label="Équipe" value={employee.team} />
                <Field label="Date d'embauche" value={employee.hired_at} />
                <Field label="Matricule" value={employee.employee_number} />
              </div>
            )}
            {tab === "employment" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Poste" value={employee.role_title} />
                <Field label="Famille de métier" value={employee.job_family} />
                <Field label="Centre de coût" value={employee.cost_center} />
                <Field label="Mode de travail" value={employee.location_mode} />
                <Field label="Date d'ancienneté" value={employee.seniority_date} />
                <Field label="Fin de période d'essai" value={employee.probation_end_date} />
              </div>
            )}
            {tab === "sensitive" && (
              sensitiveDenied
                ? <p className="text-sm" style={{ color: "var(--cs-warn)" }}>Données sensibles non accessibles — permission requise.</p>
                : <SensitiveList rows={(tabData.sensitive as string[] | undefined) ?? []} />
            )}
            {(["contracts", "documents", "absences", "missions", "tasks", "timeline"] as TabKey[]).includes(tab) && (
              <RowList rows={tabData[tab] ?? []} kind={tab} />
            )}
          </LiquidGlass>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-[0.9rem] border border-white/40 bg-white/16 px-3 py-2">
      <p className="text-[0.58rem] font-bold uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">{label}</p>
      <p className="truncate text-sm font-medium text-[var(--cs-ink-1)]">{value ? String(value) : "—"}</p>
    </div>
  );
}

function SensitiveList({ rows }: { rows: string[] }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--cs-ink-4)]">Aucune donnée sensible enregistrée.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--cs-ink-4)]">Catégories présentes — chaque lecture de valeur est journalisée.</p>
      <div className="flex flex-wrap gap-1.5">{rows.map((c) => <span key={c} className="rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-2)]">{c}</span>)}</div>
    </div>
  );
}

function RowList({ rows, kind }: { rows: unknown[]; kind: string }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--cs-ink-4)]">Aucun élément.</p>;
  return (
    <div className="grid gap-2">
      {rows.slice(0, 50).map((r, i) => {
        const o = r as Json;
        const primary = String(o.type ?? o.title ?? o.summary ?? o.contract_type ?? o.objective ?? "—");
        const secondary = [o.status, o.start_date, o.created_at, o.at, o.new_status].filter(Boolean).map(String).join(" · ");
        return (
          <div key={i} className="rounded-[0.9rem] border border-white/40 bg-white/16 px-3 py-2">
            <p className="text-sm font-medium text-[var(--cs-ink-1)]">{primary}</p>
            {secondary && <p className="text-[0.62rem] text-[var(--cs-ink-4)]">{secondary}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────
function Employees360() {
  useRequireAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const header = useMemo(() => (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="cs-heading text-[1.5rem] leading-tight tracking-tight">Salariés</h1>
        <p className="mt-1 text-xs text-[var(--cs-ink-4)]">Dossier 360 · données du runtime gouverné (V1).</p>
      </div>
      <Link href="/agents/pierre/use" className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--cs-line)", color: "var(--cs-ink-2)" }}>Cockpit Pierre</Link>
    </div>
  ), []);

  return (
    <main className="cs-page">
      <div className="cs-page-shell space-y-5">
        {header}
        {selected ? <EmployeeFolder id={selected} onBack={() => setSelected(null)} /> : <EmployeeList onOpen={setSelected} />}
      </div>
    </main>
  );
}

export default function PierreEmployeesPage() {
  return (
    <Suspense fallback={<main className="cs-page"><div className="cs-page-shell flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--cs-violet)]" /></div></main>}>
      <Employees360 />
    </Suspense>
  );
}
