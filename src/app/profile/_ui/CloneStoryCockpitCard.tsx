"use client";

// CloneStory — module natif « Mon espace partenaire » dans le cockpit CloneStore.
// Deux expériences : non-membre (carte de découverte honnête, inscriptions fermées) /
// partenaire vérifié (cockpit opérationnel réel : statut, statistiques RÉELLES, lien
// personnel, introduction, registre, distinctions, activité). Aucun faux chiffre,
// aucun secret, aucun token. Design institutionnel premium, mobile-first, accessible.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  Check,
  Share2,
  UserPlus,
  BookOpen,
  ArrowRight,
  Award,
  Lock,
  Clock3,
  ShieldCheck,
  Link2,
  Users2,
} from "lucide-react";

type CockpitStatus = "non_member" | "unverified" | "verified" | "suspended" | "withdrawn" | "ineligible" | "error";

interface Distinction {
  code: string;
  name: string;
  description: string;
  category: string;
  grant: "auto" | "manuel";
  earned: boolean;
  locked: boolean;
}
interface CockpitMember {
  status: CockpitStatus;
  statusLabel: string;
  displayName: string;
  joinedAt: string | null;
  founding: { badge: string; titleFr: string; since: string } | null;
  stats: {
    introductionsDeclared: number;
    prospectsConfirmed: number;
    accountsCreated: number;
    companiesCreated: number;
    clientsAttributed: number;
    clientsPaid: number;
    activationsCompleted: number;
    contributionsValidating: number;
    contributionsVerified: number;
    contributionsRefunded: number;
    contributionsDisputed: number;
    distinctionsEarned: number;
  };
  personalCode: string | null;
  publicLink: string | null;
  distinctions: Distinction[];
  recentActivity: { type: string; label: string; occurredAt: string }[];
}
interface CockpitState {
  authenticated: boolean;
  member: boolean;
  status: CockpitStatus;
  partner?: CockpitMember;
}

const ACCENT = "var(--cs-champagne-2, #d7c09a)";
const PRIMARY_BTN =
  "bg-[var(--cs-graphite)] text-white transition hover:-translate-y-0.5 hover:bg-[var(--cs-graphite-2)] shadow-[0_10px_26px_rgba(21,25,34,0.18)]";

function Eyebrow() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
      <Sparkles className="h-3.5 w-3.5" aria-hidden /> CloneStory
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="cs-panel relative overflow-hidden p-5 sm:p-6"
      style={{ borderColor: "rgba(215,192,154,0.35)" }}
      aria-label="CloneStory — Cercle des partenaires fondateurs"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
      {children}
    </section>
  );
}

function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="cs-card cs-card-tight min-w-0">
      <p className="truncate text-[0.72rem] font-medium uppercase tracking-wide text-[var(--cs-ink-4)]">{label}</p>
      <p className="mt-1 text-[1.5rem] font-semibold leading-none text-[var(--cs-ink-1)]">{value}</p>
      {hint ? <p className="mt-1 text-[0.7rem] text-[var(--cs-ink-4)]">{hint}</p> : null}
    </div>
  );
}

export default function CloneStoryCockpitCard() {
  const [state, setState] = useState<CockpitState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Capture d'attribution (best-effort, idempotent, serveur-authentifié) :
        // relie ce compte au partenaire d'origine s'il y a lieu. Sans effet pour un
        // partenaire (auto-attribution refusée). Ne bloque jamais l'affichage.
        await fetch("/api/founding-partners/attribution/capture", { method: "POST", cache: "no-store" }).catch(() => {});
        const res = await fetch("/api/founding-partners/cockpit", { cache: "no-store" });
        const json = (await res.json()) as CockpitState;
        if (alive) setState(json);
      } catch {
        if (alive) setState({ authenticated: false, member: false, status: "error" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const link = state?.partner?.publicLink ?? null;

  const copyLink = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setShareNote(null);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setShareNote("Copie indisponible — sélectionnez le lien manuellement.");
    }
  }, [link]);

  const shareLink = useCallback(async () => {
    if (!link) return;
    const data = {
      title: "CloneStore — Le Cercle des Partenaires Fondateurs",
      text: "Je vous présente CloneStore, l'OS d'employés IA. Découvrez-le par mon lien personnel.",
      url: link,
    };
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share(data);
        setShareNote(null);
      } catch (e) {
        // Annulation utilisateur (AbortError) = silencieuse, aucune erreur console.
        if ((e as { name?: string })?.name !== "AbortError") void copyLink();
      }
    } else {
      void copyLink();
      setShareNote("Partage natif indisponible — lien copié, collez-le où vous le souhaitez.");
    }
  }, [link, copyLink]);

  if (loading) {
    return (
      <Shell>
        <Eyebrow />
        <div className="mt-3 h-5 w-2/3 animate-pulse rounded bg-[var(--cs-ivory-2)]" />
        <div className="mt-3 h-16 animate-pulse rounded bg-[var(--cs-ivory-2)]" />
      </Shell>
    );
  }

  const member = state?.member && state.partner ? state.partner : null;
  const status = state?.status ?? "non_member";

  // ── NON-MEMBRE (ou état d'erreur) : carte de découverte honnête ───────────────
  if (!member || status === "non_member" || status === "error" || status === "ineligible") {
    return (
      <Shell>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow />
              <h2 className="mt-2 text-[1.3rem] font-semibold leading-tight text-[var(--cs-ink-1)]">
                Le Cercle des partenaires fondateurs
              </h2>
              <p className="mt-1.5 max-w-prose text-sm leading-6 text-[var(--cs-ink-3)]">
                Participez au développement de CloneStore en présentant des entreprises de confiance,
                et construisez votre histoire au sein de l'écosystème.
              </p>
            </div>
            <span className="cs-status cs-status--info shrink-0">
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> Ouverture prochaine
            </span>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              "Lien partenaire personnel",
              "Introductions directes",
              "Suivi des entreprises présentées",
              "Reconnaissance durable",
              "Distinctions du Cercle",
              "Avantages réservés aux partenaires fondateurs",
            ].map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-[var(--cs-ink-2)]">
                <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
                <span className="min-w-0">{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/founding-partners"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-sm font-semibold ${PRIMARY_BTN}`}
            >
              Découvrir le Cercle <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <span className="text-xs text-[var(--cs-ink-4)]">Les inscriptions ouvriront prochainement.</span>
          </div>
        </div>
      </Shell>
    );
  }

  // ── PARTENAIRE SUSPENDU / RETIRÉ : carte restreinte honnête ───────────────────
  if (status === "suspended" || status === "withdrawn") {
    return (
      <Shell>
        <Eyebrow />
        <h2 className="mt-2 text-[1.2rem] font-semibold text-[var(--cs-ink-1)]">CloneStory — Mon espace partenaire</h2>
        <p className="mt-2 text-sm text-[var(--cs-ink-3)]">
          Statut actuel : <strong className="text-[var(--cs-ink-1)]">{member.statusLabel}</strong>.
          Contactez le Cercle pour toute question sur votre situation.
        </p>
        <Link href="/founding-partners" className="mt-3 inline-flex items-center gap-1 text-sm font-medium" style={{ color: ACCENT }}>
          En savoir plus <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Shell>
    );
  }

  // ── PARTENAIRE NON VÉRIFIÉ : invitation honnête à confirmer ───────────────────
  if (status === "unverified") {
    return (
      <Shell>
        <Eyebrow />
        <h2 className="mt-2 text-[1.2rem] font-semibold text-[var(--cs-ink-1)]">CloneStory — Mon espace partenaire</h2>
        <p className="mt-2 text-sm text-[var(--cs-ink-3)]">
          Votre demande d'entrée est enregistrée mais votre adresse n'est pas encore confirmée.
          Confirmez le lien reçu par e-mail pour ouvrir votre registre.
        </p>
        <Link href="/founding-partners" className="mt-3 inline-flex items-center gap-1 text-sm font-medium" style={{ color: ACCENT }}>
          Le Cercle <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Shell>
    );
  }

  // ── PARTENAIRE VÉRIFIÉ : cockpit opérationnel ─────────────────────────────────
  const s = member.stats;
  return (
    <Shell>
      <div className="flex flex-col gap-5">
        {/* En-tête */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Eyebrow />
            <h2 className="mt-2 text-[1.25rem] font-semibold leading-tight text-[var(--cs-ink-1)]">
              CloneStory — Mon espace partenaire
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--cs-ink-2)]">{member.displayName}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="cs-status" style={{ color: "var(--cs-ink-2)" }}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {member.statusLabel}
              </span>
              {member.founding ? (
                <span className="cs-status" style={{ color: ACCENT, borderColor: "rgba(215,192,154,0.5)" }}>
                  <Award className="h-3.5 w-3.5" aria-hidden /> {member.founding.badge}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Statistiques réelles — funnel honnête, étape par étape */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Introductions" value={s.introductionsDeclared} />
          <StatTile label="Prospects confirmés" value={s.prospectsConfirmed} />
          <StatTile label="Comptes créés" value={s.accountsCreated} />
          <StatTile label="Entreprises créées" value={s.companiesCreated} />
          <StatTile label="Clients payés" value={s.clientsPaid} hint={s.clientsPaid === 0 ? "Bientôt" : undefined} />
          <StatTile label="Activations" value={s.activationsCompleted} />
          <StatTile label="En validation" value={s.contributionsValidating} />
          <StatTile label="Contributions vérifiées" value={s.contributionsVerified} />
          <StatTile label="Distinctions" value={s.distinctionsEarned} />
          {s.contributionsRefunded > 0 ? <StatTile label="Remboursées" value={s.contributionsRefunded} /> : null}
          {s.contributionsDisputed > 0 ? <StatTile label="En litige" value={s.contributionsDisputed} /> : null}
        </div>

        {/* Lien personnel + actions */}
        {member.publicLink ? (
          <div className="cs-card cs-card-tight">
            <p className="text-[0.72rem] font-medium uppercase tracking-wide text-[var(--cs-ink-4)]">Mon lien partenaire</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" aria-hidden />
              <code className="min-w-0 flex-1 break-all text-[0.82rem] text-[var(--cs-ink-2)]">{member.publicLink}</code>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--cs-champagne)] bg-[var(--cs-ivory)] px-4 text-sm font-semibold text-[var(--cs-ink-1)] transition hover:bg-[var(--cs-ivory-2)]"
                aria-label="Copier mon lien partenaire"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Lien copié" : "Copier mon lien"}
              </button>
              <button
                type="button"
                onClick={() => void shareLink()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--cs-line,#e6dccb)] bg-transparent px-4 text-sm font-semibold text-[var(--cs-ink-2)] transition hover:bg-[var(--cs-ivory-2)]"
                aria-label="Partager mon lien partenaire"
              >
                <Share2 className="h-4 w-4" aria-hidden /> Partager mon lien
              </button>
            </div>
            {shareNote ? <p className="mt-2 text-xs text-[var(--cs-ink-4)]">{shareNote}</p> : null}
            <p className="mt-2 text-[0.72rem] leading-5 text-[var(--cs-ink-4)]">
              Lien public d'attribution. Il ne donne jamais accès à votre registre privé.
            </p>
          </div>
        ) : null}

        {/* Actions registre / introduction */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/api/founding-partners/registry-session?intro=1"
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold ${PRIMARY_BTN}`}
          >
            <UserPlus className="h-4 w-4" aria-hidden /> Faire une introduction
          </Link>
          <Link
            href="/api/founding-partners/registry-session"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--cs-champagne)] bg-[var(--cs-ivory)] px-4 text-sm font-semibold text-[var(--cs-ink-1)] transition hover:bg-[var(--cs-ivory-2)]"
          >
            <BookOpen className="h-4 w-4" aria-hidden /> Ouvrir mon registre
          </Link>
        </div>

        {/* Deux façons de contribuer */}
        <div className="cs-card cs-card-tight">
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">Deux façons de contribuer</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
              <p className="text-[0.82rem] leading-5 text-[var(--cs-ink-3)]">
                <strong className="text-[var(--cs-ink-1)]">Partager votre lien</strong> — pour recommander
                CloneStore simplement à votre réseau.
              </p>
            </div>
            <div className="flex gap-2">
              <Users2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
              <p className="text-[0.82rem] leading-5 text-[var(--cs-ink-3)]">
                <strong className="text-[var(--cs-ink-1)]">Présenter une entreprise</strong> — pour déclarer
                précisément un contact ou une entreprise que vous connaissez.
              </p>
            </div>
          </div>
          <p className="mt-2 text-[0.72rem] leading-5 text-[var(--cs-ink-4)]">
            Une introduction confirmée n'est pas encore un client. Elle devient une contribution lorsque
            l'entreprise crée son compte, achète, puis remplit les conditions de validation CloneStory.
          </p>
        </div>

        {/* Mes distinctions */}
        <div>
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">Mes distinctions</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {member.distinctions.map((d) => (
              <div
                key={d.code}
                className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: d.earned ? "rgba(215,192,154,0.5)" : "var(--cs-line,#ece3d2)",
                  background: d.earned ? "rgba(215,192,154,0.08)" : "transparent",
                  opacity: d.earned ? 1 : 0.72,
                }}
              >
                {d.earned ? (
                  <Award className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
                ) : (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-[0.82rem] font-medium text-[var(--cs-ink-1)]">
                    {d.name}
                    {!d.earned ? <span className="ml-1.5 text-[0.66rem] uppercase tracking-wide text-[var(--cs-ink-4)]">À venir</span> : null}
                  </p>
                  <p className="text-[0.72rem] leading-5 text-[var(--cs-ink-4)]">{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        {member.recentActivity.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-[var(--cs-ink-1)]">Activité récente</p>
            <ul className="mt-2 divide-y divide-[var(--cs-line,#efe6d6)]">
              {member.recentActivity.map((a, i) => (
                <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-[0.82rem] text-[var(--cs-ink-2)]">{a.label}</span>
                  <time className="shrink-0 text-[0.72rem] text-[var(--cs-ink-4)]" dateTime={a.occurredAt}>
                    {new Date(a.occurredAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          href="/api/founding-partners/registry-session"
          className="inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: ACCENT }}
        >
          Voir tout mon registre <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Shell>
  );
}
