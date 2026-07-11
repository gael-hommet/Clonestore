"use client";

// src/app/partenaires/espace/PartnerSpace.tsx
// Espace Cabinet Fondateur (client). Consomme /api/partners/me (session cookie, RLS-isolée) et rend
// une page riche à onglets : vue d'ensemble, lien & code, présenter une entreprise, prospects,
// commissions, versements & Stripe.
//
// DOCTRINE D'AFFICHAGE :
//   • Aucune commission n'est annoncée « acquise » avant l'heure : on affiche le statut RÉEL
//     (en réserve / disponible / gelée (litige) / versée), dérivé de status + availableAt.
//   • Aucune PII prospect au-delà du nom d'entreprise ; aucun identifiant interne partenaire.
//   • L'UI ne montre QUE ce que l'API renvoie (l'isolation entre cabinets est garantie serveur).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, UserCheck, Building2, Gauge, Wallet, Clock3, Snowflake, CheckCircle2,
  Link2, Copy, KeyRound, Send, ListChecks, Receipt, CreditCard, ArrowRight,
  AlertTriangle, ShieldCheck, ExternalLink, RefreshCw,
} from "lucide-react";
import { formatMinorAmount } from "@/lib/partner-program/money";

// ------------------------------ Types (contrat /api/partners/me) ------------------------------

type PartnerInfo = {
  displayName: string;
  status: string;
  publicSlug: string;
  commissionRateBps: number;
  payoutThresholdMinor: number;
  currency: string;
  stripeOnboardingStatus: string;
  payoutsEnabled: boolean;
  contractAccepted: boolean;
};

type Balances = {
  currency: string;
  pendingReserveMinor: number;
  availableMinor: number;
  frozenMinor: number;
  paidMinor: number;
  lifetimeGrossMinor: number;
};

type Overview = {
  balances: Balances;
  prospectsSubmitted: number;
  prospectsValidated: number;
  activeClients: number;
  totalClients: number;
  mrrMinor: number;
};

type CommissionLine = {
  id: string;
  createdAt: string;
  entryType: string;
  status: string;
  commissionMinor: number;
  eligibleNetMinor: number;
  currency: string;
  stripeInvoiceId: string;
  availableAt: string;
};

type IntroductionLine = {
  id: string;
  companyName: string;
  status: string;
  submittedAt: string;
  protectedUntil: string | null;
};

type MeResponse = {
  ok: true;
  partner: PartnerInfo;
  link: string;
  codeHint: { last4: string; generation: number } | null;
  overview: Overview;
  commissions: CommissionLine[];
  introductions: IntroductionLine[];
  actionsRequired: string[];
};

type LoadState =
  | { kind: "loading" }
  | { kind: "not-partner" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: MeResponse };

// ------------------------------ Helpers d'affichage ------------------------------

function frDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

type Tone = "info" | "success" | "warn" | "danger" | "neutral";

/** Statut réel d'une écriture de commission (jamais « acquise » avant l'heure). */
function commissionStatus(c: CommissionLine): { label: string; tone: Tone } {
  if (c.entryType === "reversal") return { label: "Remboursement", tone: "neutral" };
  switch (c.status) {
    case "paid":
      return { label: "Versée", tone: "success" };
    case "frozen":
      return { label: "Gelée (litige)", tone: "danger" };
    case "void":
      return { label: "Annulée", tone: "neutral" };
    case "pending": {
      const available = new Date(c.availableAt).getTime() <= Date.now();
      return available
        ? { label: "Disponible", tone: "info" }
        : { label: "En réserve", tone: "warn" };
    }
    default:
      return { label: c.status, tone: "neutral" };
  }
}

const INTRO_STATUS: Record<string, { label: string; tone: Tone }> = {
  submitted: { label: "Soumise", tone: "info" },
  validated: { label: "Validée", tone: "success" },
  matched: { label: "Client rattaché", tone: "success" },
  rejected: { label: "Refusée", tone: "danger" },
  expired: { label: "Expirée", tone: "neutral" },
};

function introStatus(status: string): { label: string; tone: Tone } {
  return INTRO_STATUS[status] ?? { label: status, tone: "neutral" };
}

function statusClass(tone: Tone): string {
  switch (tone) {
    case "info":
      return "cs-status cs-status--info";
    case "success":
      return "cs-status cs-status--success";
    case "warn":
      return "cs-status cs-status--warn";
    case "danger":
      return "cs-status cs-status--danger";
    default:
      return "cs-status";
  }
}

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "link", label: "Lien & code" },
  { key: "invite", label: "Présenter" },
  { key: "prospects", label: "Prospects" },
  { key: "commissions", label: "Commissions" },
  { key: "payouts", label: "Versements" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ------------------------------ Composant racine ------------------------------

export function PartnerSpace() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tab, setTab] = useState<TabKey>("overview");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/partners/me", {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 404) {
        setState({ kind: "not-partner" });
        return;
      }
      if (res.status === 401) {
        // La session a expiré : on renvoie proprement vers la connexion.
        window.location.href = "/login?redirect=/partenaires/espace";
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: "Impossible de charger votre espace pour le moment." });
        return;
      }
      const json = (await res.json()) as MeResponse;
      if (!json.ok) {
        setState({ kind: "error", message: "Réponse inattendue du serveur." });
        return;
      }
      setState({ kind: "ready", data: json });
    } catch {
      setState({ kind: "error", message: "Erreur réseau. Vérifiez votre connexion et réessayez." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="cs-page" data-testid="partner-space">
      <div className="cs-page-shell space-y-6 py-6">
        {state.kind === "loading" ? <PartnerSkeleton /> : null}
        {state.kind === "not-partner" ? <NotAPartner /> : null}
        {state.kind === "error" ? <LoadError message={state.message} onRetry={load} /> : null}
        {state.kind === "ready" ? (
          <PartnerReady data={state.data} tab={tab} setTab={setTab} onRefresh={load} />
        ) : null}
      </div>
    </main>
  );
}

// ------------------------------ États non-« ready » ------------------------------

function PartnerSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de votre espace…</span>
      <div className="cs-panel p-5">
        <div className="cs-skel-line" style={{ width: "42%", height: 22 }} />
        <div className="cs-skel-line" style={{ width: "68%", height: 14, marginTop: 12 }} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="cs-card">
            <div className="cs-skel-line" style={{ width: "55%", height: 12 }} />
            <div className="cs-skel-line" style={{ width: "72%", height: 22, marginTop: 12 }} />
          </div>
        ))}
      </div>
      <style jsx>{`
        .cs-skel-line {
          border-radius: 8px;
          background: linear-gradient(90deg, rgba(120, 130, 150, 0.1), rgba(120, 130, 150, 0.22), rgba(120, 130, 150, 0.1));
          background-size: 200% 100%;
          animation: cs-skel 1.3s ease-in-out infinite;
        }
        @keyframes cs-skel {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function NotAPartner() {
  return (
    <section className="cs-panel p-6 sm:p-8" data-testid="partner-not-partner">
      <p className="cs-eyebrow mb-2">Programme Cabinets Fondateurs</p>
      <h1 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
        Vous n'êtes pas encore Cabinet Fondateur
      </h1>
      <p className="mt-3 max-w-2xl text-[0.92rem] leading-7 text-[var(--cs-ink-3)]">
        Cet espace est réservé aux cabinets comptables partenaires. Découvrez le programme, ses
        conditions et sa rémunération, puis déposez votre candidature.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/partenaires" className="cs-liquid-button cs-liquid-button--primary">
          Découvrir le programme <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/mon-clonestore" className="cs-liquid-button">
          Retour à mon espace
        </Link>
      </div>
    </section>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="cs-panel p-6" role="alert" data-testid="partner-error">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-danger)]">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">Chargement impossible</h2>
          <p className="mt-1 text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">{message}</p>
          <button type="button" onClick={onRetry} className="cs-liquid-button mt-4">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      </div>
    </section>
  );
}

// ------------------------------ Contenu principal ------------------------------

function PartnerReady({
  data,
  tab,
  setTab,
  onRefresh,
}: {
  data: MeResponse;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  onRefresh: () => void;
}) {
  const { partner } = data;
  return (
    <>
      <header className="cs-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="cs-eyebrow mb-1">Espace Cabinet Fondateur</p>
            <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
              {partner.displayName}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StripePill partner={partner} />
          <span className="cs-status" title="Taux de commission de référence">
            {(partner.commissionRateBps / 100).toLocaleString("fr-FR")} % de commission
          </span>
        </div>
      </header>

      {data.actionsRequired.length > 0 ? (
        <ActionsRequired actions={data.actionsRequired} contractHint={!partner.contractAccepted} />
      ) : null}

      <nav className="cs-panel flex flex-wrap gap-1 p-1.5" aria-label="Sections de l'espace partenaire" role="tablist">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              id={`ptab-${t.key}`}
              aria-controls={`ppanel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={
                "min-h-[40px] rounded-[999px] px-4 text-[0.84rem] font-semibold transition " +
                (active
                  ? "bg-[var(--cs-ink-1)] text-white shadow-sm"
                  : "text-[var(--cs-ink-3)] hover:bg-white/60 hover:text-[var(--cs-ink-1)]")
              }
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel" id={`ppanel-${tab}`} aria-labelledby={`ptab-${tab}`}>
        {tab === "overview" ? <OverviewSection data={data} /> : null}
        {tab === "link" ? <LinkSection data={data} /> : null}
        {tab === "invite" ? <InviteSection onSubmitted={onRefresh} /> : null}
        {tab === "prospects" ? <ProspectsSection data={data} /> : null}
        {tab === "commissions" ? <CommissionsSection data={data} /> : null}
        {tab === "payouts" ? <PayoutsSection data={data} /> : null}
      </div>
    </>
  );
}

function StripePill({ partner }: { partner: PartnerInfo }) {
  const ready = partner.stripeOnboardingStatus === "complete" && partner.payoutsEnabled;
  return (
    <span
      className={ready ? "cs-status cs-status--success" : "cs-status cs-status--warn"}
      title="Statut de l'onboarding Stripe Connect"
    >
      <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
      {ready ? "Stripe Connect actif" : "Stripe à finaliser"}
    </span>
  );
}

// ------------------------------ Alertes / actions requises ------------------------------

function ActionsRequired({ actions, contractHint }: { actions: string[]; contractHint: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startStripe() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/partners/connect/onboard", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (res.status === 503) {
        setError("Les versements ne sont pas encore ouverts. Réessayez un peu plus tard.");
        setBusy(false);
        return;
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (res.ok && json?.ok && typeof json.url === "string") {
        window.location.href = json.url;
        return;
      }
      setError("Impossible de démarrer l'onboarding Stripe pour le moment.");
      setBusy(false);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setBusy(false);
    }
  }

  const hasStripe = actions.includes("complete_stripe_onboarding");
  const hasContract = actions.includes("accept_contract") || contractHint;

  return (
    <section className="cs-panel p-5" data-testid="partner-actions" aria-label="Actions requises">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--cs-warn)]" aria-hidden />
        <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Actions requises</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {hasContract ? (
          <li className="flex flex-col gap-2 rounded-2xl border border-[var(--cs-line-soft)] bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[0.9rem] text-[var(--cs-ink-2)]">
              Acceptez le contrat partenaire pour activer votre compte.
            </span>
            <Link href="/partenaires" className="cs-liquid-button self-start sm:self-auto">
              Voir le contrat <ArrowRight className="h-4 w-4" />
            </Link>
          </li>
        ) : null}
        {hasStripe ? (
          <li className="flex flex-col gap-2 rounded-2xl border border-[var(--cs-line-soft)] bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[0.9rem] text-[var(--cs-ink-2)]">
              Terminez l'onboarding Stripe pour recevoir vos versements.
            </span>
            <button
              type="button"
              onClick={startStripe}
              disabled={busy}
              className="cs-liquid-button cs-liquid-button--primary self-start disabled:opacity-60 sm:self-auto"
            >
              {busy ? "Ouverture…" : "Terminer l'onboarding Stripe"} <ExternalLink className="h-4 w-4" />
            </button>
          </li>
        ) : null}
      </ul>
      {error ? (
        <p className="mt-3 text-[0.84rem] text-[var(--cs-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

// ------------------------------ Vue d'ensemble ------------------------------

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="cs-card">
      <div className="flex items-center gap-2 text-[var(--cs-ink-3)]">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-[0.74rem] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <div className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">{value}</div>
      {hint ? <p className="mt-1 text-[0.76rem] leading-5 text-[var(--cs-ink-4)]">{hint}</p> : null}
    </div>
  );
}

function OverviewSection({ data }: { data: MeResponse }) {
  const ov = data.overview;
  const b = ov.balances;
  const cur = b.currency;
  return (
    <div className="space-y-4">
      <section aria-label="Activité apportée">
        <p className="cs-eyebrow mb-3">Activité apportée</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Metric icon={Building2} label="Clients actifs" value={ov.activeClients.toLocaleString("fr-FR")} hint={`${ov.totalClients.toLocaleString("fr-FR")} clients au total`} />
          <Metric icon={Send} label="Prospects soumis" value={ov.prospectsSubmitted.toLocaleString("fr-FR")} />
          <Metric icon={UserCheck} label="Prospects validés" value={ov.prospectsValidated.toLocaleString("fr-FR")} />
          <Metric icon={Users} label="Clients apportés" value={ov.totalClients.toLocaleString("fr-FR")} />
          <Metric icon={Gauge} label="MRR HT apporté" value={formatMinorAmount(ov.mrrMinor, cur)} hint="Récurrent mensuel HT des clients actifs" />
        </div>
      </section>

      <section aria-label="Commissions">
        <p className="cs-eyebrow mb-3">Commissions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Metric icon={Clock3} label="En réserve" value={formatMinorAmount(b.pendingReserveMinor, cur)} hint="Délai de réserve en cours" />
          <Metric icon={Wallet} label="Disponible" value={formatMinorAmount(b.availableMinor, cur)} hint="Prêt au prochain versement" />
          <Metric icon={Snowflake} label="Gelée (litige)" value={formatMinorAmount(b.frozenMinor, cur)} />
          <Metric icon={CheckCircle2} label="Déjà versé" value={formatMinorAmount(b.paidMinor, cur)} />
          <Metric icon={Receipt} label="Cumul commissions" value={formatMinorAmount(b.lifetimeGrossMinor, cur)} hint="Total enregistré, hors remboursements" />
        </div>
      </section>

      <section className="cs-panel p-5" aria-label="Prochain versement">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[0.98rem] font-semibold text-[var(--cs-ink-1)]">Prochain versement</h2>
            <p className="mt-1 text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">
              Les commissions disponibles sont versées mensuellement une fois le seuil de{" "}
              <strong className="text-[var(--cs-ink-2)]">{formatMinorAmount(data.partner.payoutThresholdMinor, data.partner.currency)}</strong>{" "}
              atteint, vers votre compte Stripe Connect. Une commission n'est versée qu'après la fin de
              sa période de réserve.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ------------------------------ Lien & code ------------------------------

function LinkSection({ data }: { data: MeResponse }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* copie manuelle possible */
    }
  }

  return (
    <div className="space-y-4">
      <section className="cs-panel p-5" aria-label="Mon lien de recommandation">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[var(--cs-ink-3)]" aria-hidden />
          <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Mon lien de recommandation</h2>
        </div>
        <p className="mt-1 text-[0.85rem] leading-6 text-[var(--cs-ink-3)]">
          Partagez ce lien : toute entreprise qui arrive par votre intermédiaire vous est rattachée.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 overflow-x-auto rounded-2xl border border-[var(--cs-line-soft)] bg-white/55 px-4 py-3 text-[0.82rem] text-[var(--cs-ink-2)]">
            {data.link}
          </code>
          <button type="button" onClick={copy} className="cs-liquid-button shrink-0">
            <Copy className="h-4 w-4" /> {copied ? "Copié" : "Copier le lien"}
          </button>
        </div>
      </section>

      <section className="cs-panel p-5" aria-label="Mon code de recommandation">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--cs-ink-3)]" aria-hidden />
          <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Mon code</h2>
        </div>
        {data.codeHint ? (
          <>
            <p className="mt-3 font-mono text-[1.1rem] tracking-[0.18em] text-[var(--cs-ink-1)]">
              •••• {data.codeHint.last4}
            </p>
            <p className="mt-2 text-[0.8rem] leading-5 text-[var(--cs-ink-4)]">
              Pour votre sécurité, seuls les 4 derniers caractères sont affichés. Communiquez de
              préférence votre lien de recommandation.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[0.86rem] text-[var(--cs-ink-3)]">
            Aucun code actif pour l'instant. Utilisez votre lien de recommandation ci-dessus.
          </p>
        )}
      </section>
    </div>
  );
}

// ------------------------------ Présenter une entreprise ------------------------------

function InviteSection({ onSubmitted }: { onSubmitted: () => void }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const companyName = String(fd.get("companyName") ?? "").trim();
    if (!companyName) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    setStatus("sending");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/partners/introductions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          companyName,
          contactName: (String(fd.get("contactName") ?? "").trim() || null),
          contactEmail: (String(fd.get("contactEmail") ?? "").trim() || null),
          note: (String(fd.get("note") ?? "").trim() || null),
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; duplicate?: boolean }
        | { ok: false; error?: string }
        | null;

      if (res.ok && json?.ok) {
        setStatus("done");
        setMessage(
          json.duplicate
            ? "Cette entreprise figurait déjà parmi vos introductions."
            : "Entreprise présentée. Nous revenons vers vous après vérification.",
        );
        form.reset();
        onSubmitted();
        return;
      }
      const code = json && !json.ok ? json.error : undefined;
      setError(
        code === "company_already_protected"
          ? "Cette entreprise est déjà protégée par un autre cabinet."
          : code === "company_required"
            ? "Le nom de l'entreprise est obligatoire."
            : "Présentation impossible. Vérifiez les informations et réessayez.",
      );
      setStatus("idle");
    } catch {
      setError("Erreur réseau. Réessayez.");
      setStatus("idle");
    }
  }

  return (
    <section className="cs-panel p-5 sm:p-6" aria-label="Présenter une entreprise">
      <p className="cs-eyebrow mb-1">Développez votre portefeuille</p>
      <h2 className="text-[1.1rem] font-semibold text-[var(--cs-ink-1)]">Présenter une entreprise</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">
        Présentez-nous jusqu'à cinq entreprises pour démarrer. Tant qu'une introduction n'est pas
        validée, aucune commission n'est revendiquée.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-5 grid max-w-2xl gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="companyName" className="text-[0.82rem] font-semibold text-[var(--cs-ink-2)]">
              Nom de l'entreprise <span className="text-[var(--cs-danger)]">*</span>
            </label>
            <input
              id="companyName"
              name="companyName"
              required
              autoComplete="organization"
              className="min-h-[44px] rounded-2xl border border-[var(--cs-line-soft)] bg-white/55 px-4 text-[0.9rem] text-[var(--cs-ink-1)] outline-none focus:border-[var(--cs-blue)] focus:ring-2 focus:ring-[var(--cs-blue)]/25"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="contactName" className="text-[0.82rem] font-semibold text-[var(--cs-ink-2)]">
              Contact <span className="font-normal text-[var(--cs-ink-4)]">— facultatif</span>
            </label>
            <input
              id="contactName"
              name="contactName"
              autoComplete="name"
              className="min-h-[44px] rounded-2xl border border-[var(--cs-line-soft)] bg-white/55 px-4 text-[0.9rem] text-[var(--cs-ink-1)] outline-none focus:border-[var(--cs-blue)] focus:ring-2 focus:ring-[var(--cs-blue)]/25"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="contactEmail" className="text-[0.82rem] font-semibold text-[var(--cs-ink-2)]">
            Email du contact <span className="font-normal text-[var(--cs-ink-4)]">— facultatif</span>
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="min-h-[44px] rounded-2xl border border-[var(--cs-line-soft)] bg-white/55 px-4 text-[0.9rem] text-[var(--cs-ink-1)] outline-none focus:border-[var(--cs-blue)] focus:ring-2 focus:ring-[var(--cs-blue)]/25"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="note" className="text-[0.82rem] font-semibold text-[var(--cs-ink-2)]">
            Note <span className="font-normal text-[var(--cs-ink-4)]">— facultatif</span>
          </label>
          <textarea
            id="note"
            name="note"
            maxLength={1000}
            rows={3}
            className="rounded-2xl border border-[var(--cs-line-soft)] bg-white/55 px-4 py-3 text-[0.9rem] text-[var(--cs-ink-1)] outline-none focus:border-[var(--cs-blue)] focus:ring-2 focus:ring-[var(--cs-blue)]/25"
          />
        </div>

        {error ? (
          <p className="text-[0.84rem] text-[var(--cs-danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-[0.86rem] text-[var(--cs-success)]" role="status">
            {message}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="cs-liquid-button cs-liquid-button--primary disabled:opacity-60"
          >
            {status === "sending" ? "Envoi…" : "Présenter l'entreprise"} <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}

// ------------------------------ Prospects / introductions ------------------------------

function ProspectsSection({ data }: { data: MeResponse }) {
  const rows = data.introductions;
  return (
    <section className="cs-panel p-5" aria-label="Vos prospects">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[var(--cs-ink-3)]" aria-hidden />
        <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Vos prospects</h2>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-[0.88rem] text-[var(--cs-ink-3)]">
          Aucune introduction pour l'instant. Présentez une première entreprise depuis l'onglet «
          Présenter ».
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[0.86rem]">
            <caption className="sr-only">Liste de vos entreprises présentées et leur statut</caption>
            <thead>
              <tr className="text-[0.72rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">
                <th scope="col" className="py-2 pr-4 font-semibold">Entreprise</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Statut</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Présentée le</th>
                <th scope="col" className="py-2 font-semibold">Protégée jusqu'au</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const s = introStatus(i.status);
                return (
                  <tr key={i.id} className="border-t border-[var(--cs-line-soft)]">
                    <td className="py-3 pr-4 font-medium text-[var(--cs-ink-1)]">{i.companyName}</td>
                    <td className="py-3 pr-4">
                      <span className={statusClass(s.tone)}>{s.label}</span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--cs-ink-3)]">{frDate(i.submittedAt)}</td>
                    <td className="py-3 text-[var(--cs-ink-3)]">{frDate(i.protectedUntil)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ------------------------------ Commissions ------------------------------

function CommissionsSection({ data }: { data: MeResponse }) {
  const rows = data.commissions;
  return (
    <section className="cs-panel p-5" aria-label="Vos commissions">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-[var(--cs-ink-3)]" aria-hidden />
        <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Vos commissions</h2>
      </div>
      <p className="mt-1 text-[0.8rem] leading-5 text-[var(--cs-ink-4)]">
        Le statut réel prime : une commission n'est « versée » qu'après son versement effectif.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-[0.88rem] text-[var(--cs-ink-3)]">
          Aucune commission enregistrée pour l'instant.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-[0.86rem]">
            <caption className="sr-only">Écritures de commission avec date, type, statut et montant</caption>
            <thead>
              <tr className="text-[0.72rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">
                <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Type</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Statut</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Facture</th>
                <th scope="col" className="py-2 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = commissionStatus(c);
                const isReversal = c.entryType === "reversal";
                return (
                  <tr key={c.id} className="border-t border-[var(--cs-line-soft)]">
                    <td className="py-3 pr-4 text-[var(--cs-ink-3)]">{frDate(c.createdAt)}</td>
                    <td className="py-3 pr-4 text-[var(--cs-ink-2)]">
                      {isReversal ? "Remboursement" : "Commission"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={statusClass(st.tone)}>{st.label}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="text-[0.78rem] text-[var(--cs-ink-4)]">{c.stripeInvoiceId || "—"}</code>
                    </td>
                    <td
                      className={
                        "py-3 text-right font-semibold tabular-nums " +
                        (isReversal ? "text-[var(--cs-danger)]" : "text-[var(--cs-ink-1)]")
                      }
                    >
                      {formatMinorAmount(c.commissionMinor, c.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ------------------------------ Versements & Stripe ------------------------------

function PayoutsSection({ data }: { data: MeResponse }) {
  const { partner, overview } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = partner.stripeOnboardingStatus === "complete" && partner.payoutsEnabled;

  async function startStripe() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/partners/connect/onboard", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (res.status === 503) {
        setError("Les versements ne sont pas encore ouverts. Réessayez un peu plus tard.");
        setBusy(false);
        return;
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (res.ok && json?.ok && typeof json.url === "string") {
        window.location.href = json.url;
        return;
      }
      setError("Impossible de démarrer l'onboarding Stripe pour le moment.");
      setBusy(false);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="cs-panel p-5" aria-label="Versements">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--cs-ink-3)]" aria-hidden />
          <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Versements</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric icon={Wallet} label="Disponible" value={formatMinorAmount(overview.balances.availableMinor, overview.balances.currency)} />
          <Metric icon={Clock3} label="En réserve" value={formatMinorAmount(overview.balances.pendingReserveMinor, overview.balances.currency)} />
          <Metric icon={CheckCircle2} label="Déjà versé" value={formatMinorAmount(overview.balances.paidMinor, overview.balances.currency)} />
        </div>
        <p className="mt-4 text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">
          Vos commissions disponibles sont versées <strong className="text-[var(--cs-ink-2)]">mensuellement</strong>{" "}
          dès que le solde atteint le seuil de{" "}
          <strong className="text-[var(--cs-ink-2)]">
            {formatMinorAmount(partner.payoutThresholdMinor, partner.currency)}
          </strong>
          , vers votre compte Stripe Connect.
        </p>
      </section>

      <section className="cs-panel p-5" aria-label="Stripe Connect">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--cs-ink-3)]" aria-hidden />
          <h2 className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">Stripe Connect</h2>
          <span className={ready ? "cs-status cs-status--success" : "cs-status cs-status--warn"}>
            {ready ? "Actif" : "À finaliser"}
          </span>
        </div>
        <p className="mt-3 text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">
          {ready
            ? "Votre compte Stripe Connect est configuré : vous êtes prêt à recevoir vos versements."
            : "Terminez l'onboarding Stripe hébergé pour activer vos versements. Vous serez redirigé vers Stripe."}
        </p>
        {!ready ? (
          <button
            type="button"
            onClick={startStripe}
            disabled={busy}
            className="cs-liquid-button cs-liquid-button--primary mt-4 disabled:opacity-60"
          >
            {busy ? "Ouverture…" : "Terminer l'onboarding Stripe"} <ExternalLink className="h-4 w-4" />
          </button>
        ) : null}
        {error ? (
          <p className="mt-3 text-[0.84rem] text-[var(--cs-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
