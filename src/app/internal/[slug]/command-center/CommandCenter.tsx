"use client";

// Phase E.6 — Founder Command Center (client). Tour de contrôle CloneStore : thème sombre
// premium, glassmorphism, anneaux/mini-graphes alimentés UNIQUEMENT par les vraies données
// du snapshot. Aucune donnée fictive ; ce qui n'est pas connecté affiche « Source non
// connectée » (jamais de faux zéro). Toute la logique, les appels API, les actions, la
// pagination, les filtres et les mutations sont inchangés — seule la couche visuelle change.

import * as React from "react";
import {
  Activity, AlertTriangle, BellRing, Compass, Cpu, Database, Filter, Flame, Inbox, LineChart,
  Lock, Mail, MailCheck, MailX, PhoneCall, Radar, Radio, Rocket, Send, Share2,
  ShieldCheck, TrendingUp, Users, Wifi, Zap,
} from "lucide-react";
import type { ReservationRow, ReservationDetail } from "@/lib/founder-access/store";
import type { CommandCenterSnapshot, FounderClientRow, FounderAlert } from "@/lib/founder-access/command-center";
import { RESERVATION_STATUSES, COMPANY_SIZES, CONTACT_STATUSES, type ReservationStatus, type ContactStatus } from "@/lib/founder-access/types";
import {
  ACCENTS, type AccentName, ratioPct, GlassCard, FounderSectionShell, FounderProgressRing,
  FounderSparkline, FounderMiniBars, type MiniBarItem, FounderProgressBar, FounderMetricCard,
  FounderEmptyState, FounderStatusPill,
} from "./visuals";

type ListResult = { rows: ReservationRow[]; total: number; page: number; pageSize: number };
type Overview = CommandCenterSnapshot["overview"];

const TABS = ["overview", "revenue", "prospects", "clients", "funnel", "acquisition", "presence", "emails", "alerts", "sources"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  overview: "Vue d'ensemble", revenue: "Revenus", prospects: "Prospects", clients: "Clients", funnel: "Funnel",
  acquisition: "Acquisition", presence: "Présence", emails: "Emails", alerts: "Alertes", sources: "Sources",
};
const TAB_ICONS: Record<(typeof TABS)[number], typeof Radar> = {
  overview: Radar, revenue: TrendingUp, prospects: Users, clients: ShieldCheck, funnel: Filter,
  acquisition: Compass, presence: Activity, emails: Mail, alerts: BellRing, sources: Database,
};

function eur(cents: number): string { return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }); }

// ── styles partagés (sombre) ────────────────────────────────────────────────
const BTN_PRIMARY = "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#8b7cff] to-[#6b5cf0] px-4 py-2 text-[0.78rem] font-bold text-white shadow-[0_8px_24px_rgba(139,124,255,0.35)] transition-transform hover:-translate-y-0.5 disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-[0.78rem] font-semibold text-white/75 transition-colors hover:bg-white/[0.1] disabled:opacity-40";
const BTN_SM = "rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[0.76rem] font-semibold text-white/75 transition-colors hover:bg-white/[0.1] disabled:opacity-30";
const FIELD = "rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#8b7cff]";
const TH = "px-3 py-2.5 font-semibold";
const THEAD = "border-b border-white/10 text-[0.64rem] uppercase tracking-wide text-white/40";
const ROW = "border-b border-white/[0.06] transition-colors hover:bg-white/[0.035]";
const notConnected = <span className="text-[0.85rem] text-white/40">Source non connectée</span>;

const ACQ_LABEL: Record<string, string> = { source: "Source", source_medium: "Source / Medium", campaign: "Campagne", referrer: "Referrer" };

// ── Temps réel (SSE privé) — reconnexion/backoff + fallback polling + onglet inactif ────
type LiveStatus = "live" | "reconnecting" | "polling" | "offline";
function useFounderLive(onSnapshot: (s: CommandCenterSnapshot) => void): LiveStatus {
  const [status, setStatus] = React.useState<LiveStatus>("offline");
  const cb = React.useRef(onSnapshot);
  cb.current = onSnapshot;

  React.useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let stopped = false;

    const clearAll = () => {
      if (es) { es.close(); es = null; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };
    const startPolling = () => {
      if (pollTimer || stopped) return;
      setStatus("polling");
      const poll = async () => {
        const r = await fetch("/api/internal/founder-access/dashboard", { cache: "no-store" }).catch(() => null);
        if (r?.ok) { try { cb.current(await r.json()); } catch { /* ignore */ } }
      };
      void poll();
      pollTimer = setInterval(poll, 20_000);
    };
    const connect = () => {
      if (stopped) return;
      clearAll();
      try { es = new EventSource("/api/internal/founder-access/live"); }
      catch { startPolling(); return; }
      const onData = (e: MessageEvent) => { attempts = 0; setStatus("live"); try { cb.current(JSON.parse(e.data)); } catch { /* ignore */ } };
      es.addEventListener("ready", () => { attempts = 0; setStatus("live"); });
      es.addEventListener("snapshot", onData as EventListener);
      es.onerror = () => {
        if (stopped) return;
        if (es) { es.close(); es = null; }
        attempts += 1;
        if (attempts >= 4) { startPolling(); return; } // bascule polling après échecs répétés
        setStatus("reconnecting");
        reconnectTimer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempts));
      };
    };
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") { clearAll(); setStatus("offline"); }
      else { attempts = 0; connect(); }
    };

    connect();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    return () => { stopped = true; clearAll(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  return status;
}

function LiveBadge({ status }: { status: LiveStatus }) {
  const map: Record<LiveStatus, { label: string; color: string; pulse: boolean }> = {
    live: { label: "Live", color: ACCENTS.success.base, pulse: true },
    reconnecting: { label: "Reconnexion", color: ACCENTS.warning.base, pulse: true },
    polling: { label: "Polling", color: ACCENTS.blue.base, pulse: false },
    offline: { label: "Hors ligne", color: "#8a90a2", pulse: false },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-white/70" aria-label={`Temps réel : ${s.label}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.pulse ? "animate-pulse motion-reduce:animate-none" : ""}`} style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
      {s.label}
    </span>
  );
}

export function CommandCenter({ adminEmail, commercialPhase, snapshot, initialProspects, clients }: {
  adminEmail: string; commercialPhase: string; snapshot: CommandCenterSnapshot; initialProspects: ListResult; clients: { rows: FounderClientRow[]; total: number };
}) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("overview");
  const [snap, setSnap] = React.useState(snapshot);
  const [presence, setPresence] = React.useState(snapshot.presence);
  const { overview: o, revenue: rev, funnel, emails, alerts, sources } = snap;

  async function lock() {
    await fetch("/api/internal/owner-gate/lock", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }
  async function refreshPresence() {
    const res = await fetch("/api/internal/founder-access/presence", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setPresence(await res.json());
  }
  // §14 — rafraîchit KPI/overview/revenue/emails/alertes après une action (mutation/tick/requeue).
  async function refreshKpis() {
    const res = await fetch("/api/internal/founder-access/dashboard", { cache: "no-store" }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setSnap(d); setPresence(d.presence); }
  }

  // Temps réel : applique les snapshots poussés par le flux SSE privé (ou le polling de secours).
  const live = useFounderLive(React.useCallback((d: CommandCenterSnapshot) => { setSnap(d); setPresence(d.presence); }, []));

  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
  const warningAlerts = alerts.filter((a) => a.severity === "warning").length;
  const systemTone: AccentName = criticalAlerts > 0 ? "danger" : warningAlerts > 0 ? "warning" : "success";
  const systemLabel = criticalAlerts > 0 ? `${criticalAlerts} alerte${criticalAlerts > 1 ? "s" : ""} critique${criticalAlerts > 1 ? "s" : ""}`
    : warningAlerts > 0 ? `${warningAlerts} avertissement${warningAlerts > 1 ? "s" : ""}` : "Tous systèmes nominaux";

  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ background: "radial-gradient(1200px 600px at 12% -8%, rgba(255,99,195,0.10), transparent 60%), radial-gradient(1100px 620px at 88% -4%, rgba(95,139,255,0.12), transparent 58%), radial-gradient(900px 700px at 60% 110%, rgba(139,124,255,0.10), transparent 60%), linear-gradient(180deg, #0a0b14 0%, #0b0c17 55%, #090a12 100%)" }}>
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full blur-[120px]" style={{ background: "rgba(255,99,195,0.16)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full blur-[130px]" style={{ background: "rgba(95,139,255,0.16)" }} />

      <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-6">
        {/* ── En-tête tour de contrôle ─────────────────────────────────── */}
        <GlassCard className="p-5">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full blur-3xl" style={{ background: ACCENTS.violet.glow, opacity: 0.2 }} aria-hidden="true" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12" style={{ background: "linear-gradient(135deg, rgba(255,99,195,0.22), rgba(95,139,255,0.22))" }}>
                <Radar className="h-6 w-6 text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-white/45">CloneStore · Founder Command Center</p>
                <h1 className="mt-0.5 text-[1.55rem] font-bold leading-none tracking-tight text-white">{TAB_LABELS[tab]}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <FounderStatusPill accent={systemTone}>{systemLabel}</FounderStatusPill>
                  <LiveBadge status={live} />
                  <span className="text-[0.68rem] text-white/40">Phase commerciale : <strong className="font-semibold text-white/70">{commercialPhase}</strong></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-[0.68rem] leading-relaxed text-white/45">
                <p className="font-semibold text-white/70">{adminEmail}</p>
                <p>Actualisé : {new Date(snapshot.generated_at).toLocaleString("fr-FR")}</p>
              </div>
              <button onClick={lock} className={BTN_GHOST} aria-label="Verrouiller le cockpit">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Verrouiller
              </button>
            </div>
          </div>
        </GlassCard>

        {snap.degraded.length > 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.08)] px-4 py-2.5 text-[0.8rem] text-[#ffd97a]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Sections en mode dégradé (source momentanément indisponible) : {snap.degraded.join(", ")}. Les autres sections restent opérationnelles.</span>
          </div>
        ) : null}

        {/* ── Onglets ──────────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const Icon = TAB_ICONS[t];
            const active = tab === t;
            const isCrit = t === "alerts" && criticalAlerts > 0;
            return (
              <button key={t} onClick={() => setTab(t)} aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.78rem] font-semibold transition-all ${active ? "bg-gradient-to-b from-[#8b7cff] to-[#6b5cf0] text-white shadow-[0_8px_22px_rgba(139,124,255,0.34)]" : "border border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80"}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {TAB_LABELS[t]}
                {isCrit ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#fb7185]" style={{ boxShadow: "0 0 8px rgba(251,113,133,0.7)" }} aria-label="alertes critiques" /> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {tab === "overview" && <OverviewTab o={o} rev={rev} funnel={funnel} emails={emails} alerts={alerts} sources={sources} presence={presence} onAlerts={() => setTab("alerts")} />}
          {tab === "revenue" && <Revenue rev={rev} o={o} />}
          {tab === "prospects" && <Prospects initial={initialProspects} summary={o} onActionDone={refreshKpis} />}
          {tab === "clients" && <Clients initial={clients} />}
          {tab === "funnel" && <Funnel funnel={funnel} cohort={snap.cohort_funnel} />}
          {tab === "acquisition" && <Acquisition />}
          {tab === "presence" && <Presence presence={presence} onRefresh={refreshPresence} />}
          {tab === "emails" && <Emails emails={emails} onActionDone={refreshKpis} />}
          {tab === "alerts" && <Alerts alerts={alerts} />}
          {tab === "sources" && <Sources sources={sources} aiCost={snap.ai_cost} />}
        </div>
      </div>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────
function OverviewTab({ o, rev, funnel, emails, alerts, sources, presence, onAlerts }: {
  o: Overview; rev: CommandCenterSnapshot["revenue"]; funnel: CommandCenterSnapshot["funnel"];
  emails: CommandCenterSnapshot["emails"]; alerts: FounderAlert[]; sources: CommandCenterSnapshot["sources"];
  presence: CommandCenterSnapshot["presence"]; onAlerts: () => void;
}) {
  const prospectToClient = ratioPct(o.active_clients, o.reservations_total);
  const activationRate = ratioPct(o.activation_started, o.reservations_total);
  const emailsProcessed = emails.sent + emails.failed + emails.dead;
  const emailHealth = ratioPct(emails.sent, emailsProcessed);
  const fStages = funnel.stages;
  const funnelConv = fStages.length >= 2 ? ratioPct(fStages[fStages.length - 1].count, fStages[0].count) : 0;
  const connectedSources = sources.filter((s) => s.state === "connected").length;
  const topAlerts = alerts.slice(0, 3);

  const rings: Array<{ value: number; accent: AccentName; to: AccentName; caption: React.ReactNode; hasData: boolean }> = [
    { value: o.confirmation_rate, accent: "pink", to: "violet", caption: "Confirmation email", hasData: o.reservations_total > 0 },
    { value: prospectToClient, accent: "violet", to: "blue", caption: "Prospects → Clients", hasData: o.reservations_total > 0 },
    { value: activationRate, accent: "blue", to: "cyan", caption: "Activations engagées", hasData: o.reservations_total > 0 },
    { value: emailHealth, accent: "cyan", to: "success", caption: "Délivrabilité email", hasData: emailsProcessed > 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Anneaux de pilotage */}
      <FounderSectionShell title="Indicateurs de pilotage" description="Proportions réelles calculées depuis le snapshot PostgreSQL." accent="pink">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {rings.map((r, i) => (
            <div key={i} className="flex justify-center">
              <FounderProgressRing value={r.value} accent={r.accent} gradientTo={r.to} caption={r.caption} label={`${r.caption} : ${r.hasData ? `${r.value}%` : "aucune donnée"}`}
                center={r.hasData ? undefined : <span className="text-[0.9rem] font-bold text-white/40">—</span>} />
            </div>
          ))}
        </div>
      </FounderSectionShell>

      {/* KPI principaux */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <FounderMetricCard icon={Inbox} accent="pink" label="Réservations" value={o.reservations_total} sub="PostgreSQL · mesuré" />
        <FounderMetricCard icon={MailCheck} accent="violet" label="Emails confirmés" value={o.emails_confirmed} sub={`Taux ${o.confirmation_rate}%`} visual={<FounderProgressBar value={o.confirmation_rate} accent="violet" gradientTo="pink" />} />
        <FounderMetricCard icon={Flame} accent="pink" label="Intentions fortes" value={o.strong_intent} sub={`${ratioPct(o.strong_intent, o.reservations_total)}% des réservations`} />
        <FounderMetricCard icon={PhoneCall} accent="blue" label="Demandes de contact" value={o.contact_requested} sub="PostgreSQL" />
        <FounderMetricCard icon={BellRing} accent="warning" label="Relances dues" value={o.followups_due} sub="À traiter" muted={o.followups_due === 0} />
        <FounderMetricCard icon={Rocket} accent="cyan" label="Activations" value={o.activation_started} sub={`${activationRate}% des réservations`} />
        <FounderMetricCard icon={Users} accent="success" label="Clients actifs" value={o.active_clients} sub={`${prospectToClient}% conversion`} />
        <FounderMetricCard icon={TrendingUp} accent="success" label="MRR actif" value={rev.stripe_connected ? eur(rev.mrr_active_cents) : notConnected} sub="Stripe webhook" muted={!rev.stripe_connected} />
        <FounderMetricCard icon={LineChart} accent="blue" label="ARR actif" value={rev.stripe_connected ? eur(rev.arr_active_cents) : notConnected} sub="MRR × 12" muted={!rev.stripe_connected} />
        <FounderMetricCard icon={AlertTriangle} accent={rev.past_due > 0 ? "danger" : "blue"} label="Impayés" value={rev.past_due} sub="Stripe webhook" muted={rev.past_due === 0} />
        <FounderMetricCard icon={MailX} accent={o.emails_dead > 0 ? "danger" : "violet"} label="Emails en échec" value={o.emails_dead} sub="File email" muted={o.emails_dead === 0} />
        <FounderMetricCard icon={Radio} accent="cyan" label="Visiteurs en ligne" value={`~${presence.online_total}`} sub={`Estimé · fenêtre ${presence.window_seconds}s`} />
      </div>

      {/* Résumé funnel + alertes */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FounderSectionShell title="Funnel" description={`${funnel.since_days} j · conversion globale`} accent="violet" className="lg:col-span-2"
          action={<FounderStatusPill accent="violet" dot={false}>{funnelConv}% bout en bout</FounderStatusPill>}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <FounderProgressRing value={funnelConv} size={104} accent="pink" gradientTo="blue" caption="Sommet → paiement" />
            <div className="flex-1 space-y-2">
              {fStages.map((s, i) => {
                const accent: AccentName = i === 0 ? "pink" : i === fStages.length - 1 ? "blue" : "violet";
                const pctTop = s.from_top != null ? s.from_top : ratioPct(s.count, fStages[0]?.count ?? 0);
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-[0.74rem] text-white/65" title={s.label}>{s.label}</span>
                    <div className="flex-1"><FounderProgressBar value={pctTop} accent={accent} gradientTo={accent} height={9} /></div>
                    <span className="w-9 shrink-0 text-right text-[0.78rem] font-bold tabular-nums text-white">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </FounderSectionShell>

        <FounderSectionShell title="Alertes & sources" description={`${connectedSources}/${sources.length} sources connectées`} accent={topAlerts.length ? "warning" : "success"}
          action={alerts.length > 0 ? <button onClick={onAlerts} className={BTN_SM}>Tout voir</button> : undefined}>
          {topAlerts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.06)] px-3 py-3 text-[0.8rem] text-[#7ff0c6]">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Aucune alerte active. Tous les systèmes nominaux.
            </div>
          ) : (
            <ul className="space-y-2">
              {topAlerts.map((a, i) => {
                const tone: AccentName = a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "blue";
                return (
                  <li key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2"><FounderStatusPill accent={tone}>{a.severity}</FounderStatusPill></div>
                    <p className="mt-1.5 text-[0.8rem] font-semibold text-white/85">{a.message}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </FounderSectionShell>
      </div>
    </div>
  );
}

// ── Revenue ─────────────────────────────────────────────────────────────────
function Revenue({ rev, o }: { rev: CommandCenterSnapshot["revenue"]; o: Overview }) {
  if (!rev.stripe_connected) {
    return (
      <FounderEmptyState icon={TrendingUp} accent="blue" title="Source revenus non connectée"
        description="Configurez STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET pour afficher les revenus réels. Aucun revenu n'est estimé ni inventé." />
    );
  }
  const dist: MiniBarItem[] = [
    { label: "Actifs", value: rev.active_subscriptions, accent: "success" },
    { label: "Impayés", value: rev.past_due, accent: "warning" },
    { label: "Résiliés", value: rev.canceled, accent: "danger" },
  ];
  const retention = ratioPct(rev.active_subscriptions, rev.activated_total);
  return (
    <div className="space-y-4">
      <p className="text-[0.76rem] font-semibold text-white/45">Source : Stripe webhook (connecté)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <FounderMetricCard icon={TrendingUp} accent="success" label="MRR actif" value={eur(rev.mrr_active_cents)} sub="active + trialing" />
        <FounderMetricCard icon={LineChart} accent="blue" label="ARR actif" value={eur(rev.arr_active_cents)} sub="MRR × 12" />
        <FounderMetricCard icon={Users} accent="violet" label="Abonnements actifs" value={rev.active_subscriptions} sub={`${retention}% rétention`} visual={<FounderProgressBar value={retention} accent="violet" gradientTo="success" />} />
        <FounderMetricCard icon={Rocket} accent="cyan" label="Activations totales" value={rev.activated_total} sub="Stripe" />
        <FounderMetricCard icon={AlertTriangle} accent={rev.past_due > 0 ? "warning" : "blue"} label="Impayés" value={rev.past_due} sub="Stripe" muted={rev.past_due === 0} />
        <FounderMetricCard icon={MailX} accent={rev.canceled > 0 ? "danger" : "blue"} label="Résiliations" value={rev.canceled} sub="Stripe" muted={rev.canceled === 0} />
      </div>
      <FounderSectionShell title="Répartition des abonnements" description="État commercial réel (Stripe webhook)." accent="success">
        <FounderMiniBars items={dist} ariaLabel="répartition des abonnements" />
        <p className="mt-3 text-[0.66rem] text-white/40">Réservations confirmées : {o.emails_confirmed} · Intentions fortes : {o.strong_intent}.</p>
      </FounderSectionShell>
    </div>
  );
}

// ── Prospects ───────────────────────────────────────────────────────────────
function Prospects({ initial, summary, onActionDone }: { initial: ListResult; summary: Overview; onActionDone?: () => void }) {
  const [list, setList] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({ search: "", status: "", company_size: "", confirmed: "", contact_status: "" });
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<ReservationDetail | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const qs = React.useCallback((extra: Record<string, string | number> = {}) => {
    const p = new URLSearchParams();
    p.set("exclude_active_client", "true"); // §20 — l'onglet Prospects exclut les clients actifs
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)));
    return p.toString();
  }, [filters]);

  const load = React.useCallback(async (to = 1) => {
    setLoading(true);
    try { const r = await fetch(`/api/internal/founder-access/reservations?${qs({ page: to, pageSize: 25 })}`, { cache: "no-store" }); if (r.ok) { setList(await r.json()); setPage(to); } }
    finally { setLoading(false); }
  }, [qs]);

  async function openDetail(id: string) { const r = await fetch(`/api/internal/founder-access/reservations/${id}`, { cache: "no-store" }); if (r.ok) setSelected(await r.json()); }
  async function patch(id: string, body: Record<string, unknown>) {
    setActionError(null);
    const r = await fetch(`/api/internal/founder-access/reservations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { await openDetail(id); await load(page); onActionDone?.(); }
    else { const e = await r.json().catch(() => ({})); setActionError(e.error === "illegal_transition" ? `Transition interdite (${e.from} → ${e.to}).` : "Action refusée."); }
  }
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const conv = ratioPct(summary.active_clients, summary.reservations_total);

  return (
    <div className="space-y-4">
      {/* Résumé pipeline (agrégats réels du snapshot) */}
      <FounderSectionShell title="Pipeline prospects" description="Vue agrégée temps réel — la conversion mesure prospects confirmés devenus clients actifs." accent="violet"
        action={<FounderStatusPill accent="violet" dot={false}>{summary.reservations_total} réservations</FounderStatusPill>}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <FounderProgressRing value={conv} size={104} accent="violet" gradientTo="blue" caption="Conversion prospects → clients" />
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat icon={MailCheck} accent="violet" label="Confirmés" value={summary.emails_confirmed} />
            <MiniStat icon={Flame} accent="pink" label="Intentions fortes" value={summary.strong_intent} />
            <MiniStat icon={PhoneCall} accent="blue" label="Contacts" value={summary.contact_requested} />
            <MiniStat icon={BellRing} accent="warning" label="Relances dues" value={summary.followups_due} />
          </div>
        </div>
      </FounderSectionShell>

      <GlassCard className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[0.68rem] font-semibold text-white/55">Recherche</label>
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") load(1); }} placeholder="email ou entreprise" className={`w-full ${FIELD}`} />
        </div>
        <Sel label="Statut" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={["", ...RESERVATION_STATUSES]} />
        <Sel label="Taille" value={filters.company_size} onChange={(v) => setFilters({ ...filters, company_size: v })} options={["", ...COMPANY_SIZES]} />
        <Sel label="Confirmé" value={filters.confirmed} onChange={(v) => setFilters({ ...filters, confirmed: v })} options={["", "true", "false"]} />
        <Sel label="Contact" value={filters.contact_status} onChange={(v) => setFilters({ ...filters, contact_status: v })} options={["", ...CONTACT_STATUSES]} />
        <button onClick={() => load(1)} className={BTN_PRIMARY}>Filtrer</button>
        <a href={`/api/internal/founder-access/export?${qs()}`} className={BTN_GHOST}>Export CSV</a>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[0.8rem]">
          <thead className={THEAD}><tr>{["Date", "Email", "Entreprise", "Taille", "Confirmé", "Intention", "Contact", "Relance", "Statut"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {list.rows.length === 0 ? <tr><td colSpan={9} className="px-3 py-12">
              <FounderEmptyState icon={Users} accent="violet" title="Aucun prospect pour ce filtre" description="Ajustez les filtres, ou attendez de nouvelles réservations Founder Access. Aucune donnée n'est inventée." />
            </td></tr>
              : list.rows.map((r) => (
                <tr key={r.id} onClick={() => openDetail(r.id)} className={`cursor-pointer ${ROW}`}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/45">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="px-3 py-2.5 font-medium text-white/90">{r.email}</td>
                  <td className="px-3 py-2.5 text-white/70">{r.company_name}</td>
                  <td className="px-3 py-2.5 text-white/60">{r.company_size}</td>
                  <td className="px-3 py-2.5">{r.email_verified_at ? <span className="text-[#34d399]">✓</span> : <span className="text-white/30">—</span>}</td>
                  <td className="px-3 py-2.5">{r.strong_intent ? <FounderStatusPill accent="pink" dot={false}>Forte</FounderStatusPill> : <span className="text-white/30">—</span>}</td>
                  <td className="px-3 py-2.5 text-white/60">{r.contact_status === "not_requested" ? "—" : r.contact_status}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/45">{r.next_followup_at ? new Date(r.next_followup_at).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5"><FounderStatusPill accent="violet" dot={false}>{r.status}</FounderStatusPill></td>
                </tr>
              ))}
          </tbody>
        </table>
      </GlassCard>
      <div className="flex items-center justify-between text-[0.8rem] text-white/55">
        <span>{list.total} réservation{list.total > 1 ? "s" : ""} {loading ? "· chargement…" : ""}</span>
        <Pager page={page} totalPages={totalPages} onPage={load} />
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(5,6,12,0.6)] backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-[520px] overflow-y-auto border-l border-white/10 bg-[#0c0d18] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {actionError ? <div className="mb-3 rounded-xl border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.08)] px-3 py-2 text-[0.8rem] text-[#ffa6b2]">{actionError}</div> : null}
            <DetailPanel detail={selected} onClose={() => setSelected(null)} onPatch={patch} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ icon: Icon, accent, label, value }: { icon: typeof Radar; accent: AccentName; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: ACCENTS[accent].soft, color: ACCENTS[accent].base }}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
      <p className="mt-2 text-[1.05rem] font-bold leading-none text-white">{value}</p>
      <p className="mt-1 text-[0.66rem] text-white/45">{label}</p>
    </div>
  );
}

function DetailPanel({ detail, onClose, onPatch }: { detail: ReservationDetail; onClose: () => void; onPatch: (id: string, body: Record<string, unknown>) => void }) {
  const [note, setNote] = React.useState(detail.internal_notes ?? "");
  const [status, setStatus] = React.useState<ReservationStatus>(detail.status);
  const [contact, setContact] = React.useState<ContactStatus>(detail.contact_status);
  const [followup, setFollowup] = React.useState("");
  return (
    <div className="text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-white/40">Réservation</p>
          <h2 className="mt-1 text-lg font-bold text-white">{detail.email}</h2>
          <p className="text-[0.82rem] text-white/50">{detail.company_name} · {detail.company_size} · {detail.email_domain_type}</p>
        </div>
        <button onClick={onClose} className={BTN_SM}>Fermer</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[0.8rem]">
        <Info label="Nom" value={detail.full_name} />
        <Info label="Fonction" value={detail.role} />
        <Info label="Besoin RH" value={detail.primary_hr_need} />
        <Info label="Secteur" value={detail.sector} />
        <Info label="Contact" value={detail.contact_status} />
        <Info label="Contacté le" value={detail.contacted_at ? new Date(detail.contacted_at).toLocaleString("fr-FR") : null} />
        <Info label="Relance" value={detail.next_followup_at ? new Date(detail.next_followup_at).toLocaleString("fr-FR") : null} />
        <Info label="Email confirmé" value={detail.email_verified_at ? "oui" : "non"} />
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[0.66rem] font-bold uppercase tracking-wide text-white/40">Actions</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onPatch(detail.id, { status: "qualified" })} className={BTN_SM}>Marquer qualifié</button>
          <button onClick={() => onPatch(detail.id, { strong_intent: true, status: "strong_intent" })} className={BTN_SM}>Intention forte</button>
          <button onClick={() => onPatch(detail.id, { contacted: true })} className={BTN_SM}>Marquer contacté</button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[0.66rem] font-semibold text-white/55">Relation</label>
            <select value={contact} onChange={(e) => setContact(e.target.value as ContactStatus)} className={FIELD}>
              {CONTACT_STATUSES.map((s) => <option key={s} value={s} className="bg-[#0c0d18]">{s}</option>)}
            </select>
          </div>
          <button onClick={() => onPatch(detail.id, { contact_status: contact })} className={BTN_SM}>Appliquer</button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[0.66rem] font-semibold text-white/55">Prochaine relance</label>
            <input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className={FIELD} />
          </div>
          <button onClick={() => onPatch(detail.id, { next_followup_at: followup ? new Date(followup).toISOString() : null })} className={BTN_SM}>Planifier</button>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-[0.66rem] font-semibold text-white/55">Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus)} className={FIELD}>
              {RESERVATION_STATUSES.map((s) => <option key={s} value={s} className="bg-[#0c0d18]">{s}</option>)}
            </select>
          </div>
          <button onClick={() => onPatch(detail.id, { status })} className={BTN_PRIMARY}>Appliquer</button>
        </div>
        <div>
          <label className="mb-1 block text-[0.66rem] font-semibold text-white/55">Note interne</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`w-full ${FIELD}`} />
          <button onClick={() => onPatch(detail.id, { internal_notes: note, last_contact_note: note })} className={`mt-2 ${BTN_SM}`}>Enregistrer la note</button>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[0.66rem] font-bold uppercase tracking-wide text-white/40">Chronologie</p>
        <ol className="mt-2 space-y-1.5">
          {detail.events.map((e, i) => (
            <li key={i} className="flex items-center gap-2 text-[0.78rem]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENTS.violet.base }} aria-hidden="true" />
              <span className="font-mono text-[0.66rem] text-white/40">{new Date(e.occurred_at).toLocaleString("fr-FR")}</span>
              <span className="text-white/75">{e.event_name}</span>
            </li>
          ))}
        </ol>
        {detail.email_jobs.length > 0 ? (
          <div className="mt-3">
            <p className="text-[0.66rem] font-bold uppercase tracking-wide text-white/40">Emails</p>
            <ul className="mt-1 space-y-1 text-[0.76rem] text-white/55">
              {detail.email_jobs.map((j, i) => <li key={i}>{j.kind} — {j.status}{j.attempts ? ` (${j.attempts})` : ""}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Clients ─────────────────────────────────────────────────────────────────
function Clients({ initial }: { initial: { rows: FounderClientRow[]; total: number } }) {
  const PAGE = 25;
  const [rows, setRows] = React.useState(initial.rows);
  const [total, setTotal] = React.useState(initial.total);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  async function load(to: number) {
    setLoading(true);
    try { const r = await fetch(`/api/internal/founder-access/clients?page=${to}&pageSize=${PAGE}`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); setRows(d.rows); setTotal(d.total); setPage(to); } }
    finally { setLoading(false); }
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  // Répartition des états d'abonnement sur la page chargée (réel, étiqueté comme tel).
  const statusCounts = rows.reduce<Record<string, number>>((acc, c) => { const k = c.subscription_status ?? "—"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const toneFor = (k: string): AccentName => k === "active" ? "success" : k === "trialing" ? "cyan" : k === "past_due" ? "warning" : k === "canceled" ? "danger" : "violet";
  const dist: MiniBarItem[] = Object.entries(statusCounts).map(([label, value]) => ({ label, value, accent: toneFor(label) }));
  const mrrLoaded = rows.reduce((s, c) => s + (c.subscription_amount_cents ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FounderMetricCard icon={ShieldCheck} accent="success" label="Clients actifs" value={total} sub="Source : Stripe webhook" />
        <FounderMetricCard icon={Users} accent="violet" label="Sur cette page" value={rows.length} sub={`Page ${page} / ${totalPages}`} />
        <FounderMetricCard icon={TrendingUp} accent="blue" label="Montant (page)" value={mrrLoaded > 0 ? eur(mrrLoaded) : "—"} sub="Somme abonnements chargés" muted={mrrLoaded === 0} />
        <FounderMetricCard icon={Rocket} accent="cyan" label="États distincts" value={Object.keys(statusCounts).length} sub="Sur la page courante" muted={rows.length === 0} />
      </div>

      {dist.length > 0 ? (
        <FounderSectionShell title="Répartition des abonnements" description="États réels des clients chargés sur cette page (Stripe webhook)." accent="success">
          <FounderMiniBars items={dist} ariaLabel="répartition des états d'abonnement" />
        </FounderSectionShell>
      ) : null}

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[0.8rem]">
          <thead className={THEAD}><tr>{["Entreprise", "Email", "Activé le", "Abonnement", "Montant", "Stripe sub"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-12">
              <FounderEmptyState icon={ShieldCheck} accent="success" title="Aucun client actif mesuré" description="Les clients apparaîtront ici après une activation Stripe réelle (webhook). Rien n'est simulé." />
            </td></tr>
              : rows.map((c) => (
                <tr key={c.id} className={ROW}>
                  <td className="px-3 py-2.5 font-medium text-white/90">{c.company_name}</td>
                  <td className="px-3 py-2.5 text-white/70">{c.email}</td>
                  <td className="px-3 py-2.5 text-white/45">{c.activated_at ? new Date(c.activated_at).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5">{c.subscription_status ? <FounderStatusPill accent={toneFor(c.subscription_status)} dot={false}>{c.subscription_status}</FounderStatusPill> : <span className="text-white/30">—</span>}</td>
                  <td className="px-3 py-2.5 text-white/80">{c.subscription_amount_cents != null ? eur(c.subscription_amount_cents) : "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-[0.7rem] text-white/40">{c.stripe_subscription_masked ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </GlassCard>
      <div className="flex items-center justify-between text-[0.8rem] text-white/55">
        <span>{total} client{total > 1 ? "s" : ""} actif{total > 1 ? "s" : ""} · Stripe webhook {loading ? "· chargement…" : ""}</span>
        <Pager page={page} totalPages={totalPages} onPage={load} />
      </div>
    </div>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────────────
function Funnel({ funnel, cohort }: { funnel: CommandCenterSnapshot["funnel"]; cohort: CommandCenterSnapshot["cohort_funnel"] }) {
  const [mode, setMode] = React.useState<"event" | "cohort">("event");
  const view = mode === "cohort" ? cohort : funnel;
  const max = Math.max(1, ...view.stages.map((s) => s.count));
  const globalConv = view.stages.length >= 2 ? ratioPct(view.stages[view.stages.length - 1].count, view.stages[0].count) : 0;
  const series = view.stages.map((s) => s.count);
  const accentForIndex = (i: number, n: number): AccentName => i === 0 ? "pink" : i >= n - 1 ? "blue" : "violet";

  return (
    <FounderSectionShell accent="violet"
      title="Funnel de conversion"
      description={<>Période : {view.since_days} jours · paiement = vérité Stripe webhook{mode === "cohort" ? ` · cohorte ${cohort.eligible} sessions éligibles` : " · sessions distinctes par étape"}</>}
      action={
        <div className="flex gap-1">
          <button onClick={() => setMode("event")} className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold transition-colors ${mode === "event" ? "bg-[#6b5cf0] text-white" : "border border-white/12 text-white/55 hover:bg-white/[0.08]"}`}>Événementiel</button>
          <button onClick={() => setMode("cohort")} className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold transition-colors ${mode === "cohort" ? "bg-[#6b5cf0] text-white" : "border border-white/12 text-white/55 hover:bg-white/[0.08]"}`}>Cohorté</button>
        </div>
      }>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex shrink-0 flex-col items-center gap-2 lg:w-48">
          <FounderProgressRing value={globalConv} size={132} stroke={11} accent="pink" gradientTo="blue" caption="Conversion globale (sommet → paiement)" />
          {series.length >= 2 ? <FounderSparkline data={series} width={150} height={36} accent="violet" ariaLabel="décroissance du funnel" /> : null}
        </div>
        <div className="flex-1 space-y-2.5">
          {view.stages.map((s, i) => {
            const accent = accentForIndex(i, view.stages.length);
            return (
              <div key={s.key} className="flex items-center gap-3 text-[0.8rem]">
                <span className="w-44 shrink-0 truncate text-white/70" title={s.label}>{s.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-white/[0.05]">
                  <div className="flex h-full items-center justify-end rounded-lg pr-2" style={{ width: `${Math.max(6, Math.round((s.count / max) * 100))}%`, background: `linear-gradient(90deg, ${ACCENTS[accent].base}cc, ${ACCENTS[accent].base}77)`, boxShadow: `0 0 14px ${ACCENTS[accent].glow}` }}>
                    <span className="text-[0.68rem] font-bold text-white">{s.count}</span>
                  </div>
                </div>
                <span className="w-14 shrink-0 text-right text-[0.72rem] text-white/45">{s.from_prev != null ? `${s.from_prev}%` : "—"}</span>
                <span className="w-14 shrink-0 text-right text-[0.72rem] text-white/45">{s.from_top != null ? `${s.from_top}%` : "—"}</span>
              </div>
            );
          })}
          <p className="pt-1 text-[0.66rem] text-white/35">Colonnes : volume · conversion vs étape précédente · conversion depuis le sommet.</p>
        </div>
      </div>
    </FounderSectionShell>
  );
}

// ── Acquisition ─────────────────────────────────────────────────────────────
type AcqRow = { key: string; sessions: number; reservations: number; activations: number; payments: number; reservation_conversion_rate: number; payment_conversion_rate: number };
const ACQ_DIMS: Array<[string, string]> = [["source", "Source"], ["source_medium", "Source / Medium"], ["campaign", "Campagne"], ["referrer", "Referrer"]];

function Acquisition() {
  const [dimension, setDimension] = React.useState("source");
  const [rows, setRows] = React.useState<AcqRow[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setRows(null); setError(false);
    fetch(`/api/internal/founder-access/analytics?dimension=${dimension}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { if (active) setRows(d.acquisition ?? []); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [dimension]);

  const top = (rows ?? []).slice(0, 6);
  const topBars: MiniBarItem[] = top.map((a, i) => ({ label: a.key.length > 10 ? a.key.slice(0, 10) + "…" : a.key, value: a.sessions, accent: (["pink", "violet", "blue", "cyan", "success", "warning"] as AccentName[])[i % 6] }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.74rem] font-semibold text-white/55">Vue :</span>
        {ACQ_DIMS.map(([v, l]) => (
          <button key={v} onClick={() => setDimension(v)} className={`rounded-full px-3 py-1 text-[0.74rem] font-semibold transition-colors ${dimension === v ? "bg-[#6b5cf0] text-white" : "border border-white/12 text-white/55 hover:bg-white/[0.08]"}`}>{l}</button>
        ))}
      </div>

      {rows && rows.length > 0 ? (
        <FounderSectionShell title={`Sessions par ${ACQ_LABEL[dimension] ?? dimension}`} description="Contribution réelle des canaux (sessions distinctes mesurées)." accent="cyan">
          <FounderMiniBars items={topBars} ariaLabel="sessions par canal" />
        </FounderSectionShell>
      ) : null}

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-[0.8rem]">
          <thead className={THEAD}><tr>{["Dimension", "Sessions", "Réservations", "Activations", "Paiements", "Conv. résa", "Conv. paiement"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {error ? <tr><td colSpan={7} className="px-3 py-12"><FounderEmptyState icon={Compass} accent="danger" title="Données d'acquisition indisponibles" description="La source analytics est momentanément injoignable. Réessayez plus tard." /></td></tr>
              : rows === null ? <tr><td colSpan={7} className="px-3 py-10 text-center text-white/45">Chargement…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-12"><FounderEmptyState icon={Share2} accent="cyan" title="Aucune session mesurée" description="Les canaux d'acquisition apparaîtront dès les premières visites first-party tracées. Rien n'est estimé." /></td></tr>
              : rows.map((a) => (
                <tr key={a.key} className={ROW}>
                  <td className="px-3 py-2.5 font-medium text-white/90">{a.key}</td>
                  <td className="px-3 py-2.5 text-white/75">{a.sessions}</td>
                  <td className="px-3 py-2.5 text-white/70">{a.reservations}</td>
                  <td className="px-3 py-2.5 text-white/70">{a.activations}</td>
                  <td className="px-3 py-2.5 text-white/70">{a.payments}</td>
                  <td className="px-3 py-2.5"><span className="text-[#bcb2ff]">{a.reservation_conversion_rate}%</span></td>
                  <td className="px-3 py-2.5"><span className="text-[#7ff0c6]">{a.payment_conversion_rate}%</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </GlassCard>
      <p className="text-[0.66rem] text-white/35">Paiements = vérité Stripe webhook (jamais côté client).</p>
    </div>
  );
}

// ── Presence ────────────────────────────────────────────────────────────────
function Presence({ presence, onRefresh }: { presence: CommandCenterSnapshot["presence"]; onRefresh: () => void }) {
  const pages: MiniBarItem[] = [
    { label: "Home", value: presence.on_homepage, accent: "pink" },
    { label: "/demo", value: presence.on_demo, accent: "violet" },
    { label: "Pierre", value: presence.on_demo_pierre, accent: "violet" },
    { label: "Réserver", value: presence.on_reserver, accent: "blue" },
    { label: "Activer", value: presence.on_activate, accent: "cyan" },
    { label: "Checkout", value: presence.on_checkout, accent: "success" },
  ];
  return (
    <div className="space-y-4">
      <FounderSectionShell title="Présence Founder Access" accent="cyan"
        description={`Estimation first-party · fenêtre ${presence.window_seconds}s · maj ${new Date(presence.generated_at).toLocaleTimeString("fr-FR")}`}
        action={<button onClick={onRefresh} className={BTN_GHOST}><Wifi className="h-3.5 w-3.5" aria-hidden="true" /> Rafraîchir</button>}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-4">
            <Radio className="h-5 w-5 text-[#43d4f4]" aria-hidden="true" />
            <p className="mt-1 text-[2rem] font-bold leading-none text-white">~{presence.online_total}</p>
            <p className="text-[0.68rem] text-white/45">en ligne (estimé)</p>
          </div>
          <div className="flex-1">
            <p className="mb-2 text-[0.72rem] font-semibold text-white/55">Répartition par page (estimation)</p>
            <FounderMiniBars items={pages} height={110} ariaLabel="présence par page" />
          </div>
        </div>
      </FounderSectionShell>
    </div>
  );
}

// ── Emails ──────────────────────────────────────────────────────────────────
type EmailJob = { id: number; reservation_email: string; kind: string; status: string; attempts: number; send_at: string; next_attempt_at: string | null; last_error: string | null };

function Emails({ emails, onActionDone }: { emails: CommandCenterSnapshot["emails"]; onActionDone?: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const PAGE = 25;
  const [jobs, setJobs] = React.useState<EmailJob[] | null>(null);
  const [jtotal, setJtotal] = React.useState(0);
  const [jpage, setJpage] = React.useState(1);

  const loadJobs = React.useCallback(async (to = 1) => {
    const r = await fetch(`/api/internal/founder-access/email-jobs?page=${to}&pageSize=${PAGE}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setJobs(d.rows); setJtotal(d.total); setJpage(to); }
    else setJobs([]);
  }, []);
  React.useEffect(() => { void loadJobs(1); }, [loadJobs]);

  async function runTick() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/internal/founder-access/email-run", { method: "POST" }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsg(`Tick exécuté (mode ${d.mode}) — envoyés ${d.sent}, ignorés ${d.skipped}, retentés ${d.retried}, dead ${d.dead}.`); }
    else setMsg("Tick refusé ou indisponible.");
    setBusy(false); await loadJobs(jpage); onActionDone?.();
  }
  async function requeueDead(jobId?: number) {
    if (jobId === undefined && !confirming) { setConfirming(true); return; }
    setConfirming(false); setBusy(true); setMsg(null);
    const r = await fetch("/api/internal/founder-access/email-requeue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(jobId !== undefined ? { jobId } : {}) }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsg(`${d.requeued} job(s) dead remis en file.`); }
    else setMsg("Relance refusée ou indisponible.");
    setBusy(false); await loadJobs(jpage); onActionDone?.();
  }
  const dist: MiniBarItem[] = [
    { label: "Attente", value: emails.pending, accent: "blue" },
    { label: "En cours", value: emails.sending, accent: "cyan" },
    { label: "Envoyés", value: emails.sent, accent: "success" },
    { label: "Ignorés", value: emails.skipped, accent: "violet" },
    { label: "Échoués", value: emails.failed, accent: "warning" },
    { label: "Dead", value: emails.dead, accent: "danger" },
  ];
  const processed = emails.sent + emails.failed + emails.dead;
  const deliverability = ratioPct(emails.sent, processed);
  const jPages = Math.max(1, Math.ceil(jtotal / PAGE));

  return (
    <div className="space-y-4">
      <FounderSectionShell title="File d'envoi email" accent="violet"
        description={`Provider : ${emails.provider_configured ? "Resend configuré" : "non configuré (aucun envoi réel)"}`}
        action={
          <div className="flex gap-2">
            {emails.dead > 0 ? <button onClick={() => requeueDead()} disabled={busy} className="rounded-full border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.08)] px-4 py-2 text-[0.78rem] font-bold text-[#ffa6b2] transition-colors hover:bg-[rgba(251,113,133,0.14)] disabled:opacity-60">{confirming ? "Confirmer la relance ?" : `Relancer les dead (${emails.dead})`}</button> : null}
            {confirming ? <button onClick={() => setConfirming(false)} className={BTN_GHOST}>Annuler</button> : null}
            <button onClick={runTick} disabled={busy} className={BTN_PRIMARY}><Send className="h-3.5 w-3.5" aria-hidden="true" />{busy ? "Exécution…" : "Lancer un tick"}</button>
          </div>
        }>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <FounderProgressRing value={deliverability} size={108} accent="success" gradientTo="cyan"
            caption="Délivrabilité (envoyés / traités)" center={processed === 0 ? <span className="text-[0.9rem] font-bold text-white/40">—</span> : undefined} />
          <div className="flex-1">
            <FounderMiniBars items={dist} ariaLabel="états de la file email" />
          </div>
        </div>
        {msg ? <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.78rem] text-white/75">{msg}</p> : null}
      </FounderSectionShell>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[0.78rem]">
          <thead className={THEAD}><tr>{["Email", "Type", "Statut", "Tent.", "Prochaine", "Dernière erreur", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {jobs === null ? <tr><td colSpan={7} className="px-3 py-10 text-center text-white/45">Chargement…</td></tr>
              : jobs.length === 0 ? <tr><td colSpan={7} className="px-3 py-12"><FounderEmptyState icon={MailCheck} accent="success" title="File email vide" description="Aucun job email en attente. Les envois apparaîtront ici dès qu'une réservation déclenche une vérification." /></td></tr>
              : jobs.map((j) => (
                <tr key={j.id} className={ROW}>
                  <td className="px-3 py-2 text-white/80">{j.reservation_email}</td>
                  <td className="px-3 py-2 text-white/60">{j.kind}</td>
                  <td className="px-3 py-2">{j.status === "dead" ? <FounderStatusPill accent="danger" dot={false}>dead</FounderStatusPill> : <span className="text-white/70">{j.status}</span>}</td>
                  <td className="px-3 py-2 text-white/60">{j.attempts}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-white/45">{j.next_attempt_at ? new Date(j.next_attempt_at).toLocaleString("fr-FR") : "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-[#ffa6b2]">{j.last_error ?? "—"}</td>
                  <td className="px-3 py-2">{j.status === "dead" ? <button onClick={() => requeueDead(j.id)} disabled={busy} className={BTN_SM}>Relancer</button> : null}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </GlassCard>
      <div className="flex items-center justify-end gap-3 text-[0.76rem] text-white/55">
        <span>{jtotal} job{jtotal > 1 ? "s" : ""}</span>
        <Pager page={jpage} totalPages={jPages} onPage={loadJobs} />
      </div>
    </div>
  );
}

// ── Alerts ──────────────────────────────────────────────────────────────────
function Alerts({ alerts }: { alerts: FounderAlert[] }) {
  if (alerts.length === 0) {
    return <FounderEmptyState icon={ShieldCheck} accent="success" title="Aucune alerte active" description="Tous les systèmes Founder Access sont nominaux. Les alertes critiques et avertissements s'afficheraient ici en priorité." />;
  }
  const tone = (s: string): AccentName => s === "critical" ? "danger" : s === "warning" ? "warning" : "blue";
  return (
    <div className="space-y-2.5">
      {alerts.map((a, i) => {
        const t = tone(a.severity);
        return (
          <GlassCard key={i} className="p-4" style={{ borderColor: `${ACCENTS[t].base}44` }}>
            <div className="pointer-events-none absolute left-0 top-0 h-full w-1" style={{ background: ACCENTS[t].base, boxShadow: `0 0 16px ${ACCENTS[t].glow}` }} aria-hidden="true" />
            <div className="flex items-center gap-2 pl-2">
              <FounderStatusPill accent={t}>{a.severity}</FounderStatusPill>
              <p className="font-semibold text-white/90">{a.message}</p>
            </div>
            <p className="mt-1.5 pl-2 text-[0.82rem] text-white/55">{a.recommendation}</p>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ── Sources ─────────────────────────────────────────────────────────────────
const SOURCE_STATE_LABEL: Record<string, string> = { connected: "Connectée", degraded: "Dégradée", misconfigured: "Mal configurée", unavailable: "Indisponible", not_configured: "Non connectée" };
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Sources({ sources, aiCost }: { sources: CommandCenterSnapshot["sources"]; aiCost: CommandCenterSnapshot["ai_cost"] }) {
  const tone = (st: string): AccentName => st === "connected" ? "success" : st === "degraded" || st === "misconfigured" ? "warning" : st === "unavailable" ? "danger" : "violet";
  return (
    <div className="space-y-4">
    {/* Coûts IA — métriques sobres, affichées UNIQUEMENT si une vraie consommation existe. */}
    {aiCost && aiCost.calls_30d > 0 ? (
      <FounderSectionShell title="Coûts IA" description={`Ledger ${aiCost.provider_mode} · ledger gouverné (devise ${aiCost.currency})`} accent="cyan">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FounderMetricCard icon={Cpu} accent="cyan" label="Coût aujourd'hui" value={usd(aiCost.cost_today_cents)} />
          <FounderMetricCard icon={LineChart} accent="violet" label="Coût 7 jours" value={usd(aiCost.cost_7d_cents)} />
          <FounderMetricCard icon={TrendingUp} accent="blue" label="Coût 30 jours" value={usd(aiCost.cost_30d_cents)} />
          <FounderMetricCard icon={Zap} accent="pink" label="Appels (30j)" value={aiCost.calls_30d} sub={[aiCost.top_provider, aiCost.top_model].filter(Boolean).join(" · ") || "—"} />
        </div>
      </FounderSectionShell>
    ) : null}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sources.map((s) => {
        const t = tone(s.state);
        return (
          <GlassCard key={s.key} interactive className="p-4">
            <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full blur-2xl" style={{ background: ACCENTS[t].glow, opacity: 0.18 }} aria-hidden="true" />
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: ACCENTS[t].soft, color: ACCENTS[t].base }}><Database className="h-4 w-4" aria-hidden="true" /></span>
                <p className="font-semibold text-white/90">{s.label}</p>
              </div>
              <FounderStatusPill accent={t}>{SOURCE_STATE_LABEL[s.state] ?? s.state}</FounderStatusPill>
            </div>
            <p className="relative mt-2 text-[0.78rem] text-white/55">{s.detail}</p>
          </GlassCard>
        );
      })}
    </div>
    </div>
  );
}

// ── Petits utilitaires UI ───────────────────────────────────────────────────
function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (to: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={BTN_SM}>Précédent</button>
      <span className="text-white/55">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={BTN_SM}>Suivant</button>
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label className="mb-1 block text-[0.68rem] font-semibold text-white/55">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {options.map((o) => <option key={o} value={o} className="bg-[#0c0d18]">{o === "" ? "Tous" : o}</option>)}
      </select>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-[0.64rem] font-semibold text-white/40">{label}</p><p className="text-white/85">{value || "—"}</p></div>;
}
