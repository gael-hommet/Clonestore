// src/components/mon-clonestore/BillingManager.tsx
// UI de gestion d'abonnement (route /mon-clonestore/facturation). Consomme les 4 routes de
// facturation (subscription / cancel / resume / portal) via un Bearer Supabase. La vérité vient
// TOUJOURS du serveur : on relit le statut après chaque action. Aucune donnée Stripe sensible
// (id customer/subscription) n'est affichée. Ne modifie aucune route API.

"use client";

import * as React from "react";
import Link from "next/link";
import {
  Receipt, CreditCard, ArrowLeft, ShieldCheck, CheckCircle2, Clock, XCircle,
  AlertTriangle, Loader2, ExternalLink,
} from "lucide-react";
import { getCurrentAccessToken } from "@/lib/auth/session-client";
import { useAuthGate } from "@/lib/auth/useAuthGate";

const AGENT_SLUG = "pierre";

type UiState =
  | "active"
  | "trialing"
  | "cancel_scheduled"
  | "past_due"
  | "canceled"
  | "none";

interface SubscriptionView {
  uiState: UiState;
  activationStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  canCancel: boolean;
  canResume: boolean;
}

interface SubscriptionResponse {
  ok: boolean;
  subscription?: SubscriptionView;
  code?: string;
  error?: string;
}

interface MutationResponse {
  ok: boolean;
  status?: string;
  cancel_at_period_end?: boolean;
  code?: string;
  error?: string;
}

interface PortalResponse {
  ok: boolean;
  url?: string;
  code?: string;
  error?: string;
}

type LoadState = "loading" | "ready" | "error";
type BusyAction = "cancel" | "resume" | "portal" | null;

interface StatePresentation {
  label: string;
  tone: "success" | "info" | "warn" | "danger" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  description: (sub: SubscriptionView) => string | null;
}

function formatDate(unixSeconds: number | null): string | null {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return null;
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const PRESENTATION: Record<UiState, StatePresentation> = {
  active: {
    label: "Abonnement actif",
    tone: "success",
    icon: CheckCircle2,
    description: () => "Pierre travaille pour vous. Votre abonnement est en cours.",
  },
  trialing: {
    label: "Période d'essai",
    tone: "info",
    icon: Clock,
    description: (sub) => {
      const end = formatDate(sub.trialEnd);
      return end ? `Votre essai se termine le ${end}.` : "Votre essai est en cours.";
    },
  },
  cancel_scheduled: {
    label: "Annulation programmée",
    tone: "warn",
    icon: AlertTriangle,
    description: (sub) => {
      const end = formatDate(sub.currentPeriodEnd);
      return end
        ? `Votre accès reste actif jusqu'au ${end}.`
        : "Votre accès reste actif jusqu'à la fin de la période en cours.";
    },
  },
  past_due: {
    label: "Paiement en attente",
    tone: "danger",
    icon: AlertTriangle,
    description: () =>
      "Un paiement est en attente. Mettez à jour votre moyen de paiement pour conserver Pierre.",
  },
  canceled: {
    label: "Abonnement terminé",
    tone: "neutral",
    icon: XCircle,
    description: () => "Votre abonnement est terminé.",
  },
  none: {
    label: "Aucun abonnement actif",
    tone: "neutral",
    icon: Receipt,
    description: () => "Vous n'avez pas encore d'abonnement à Pierre.",
  },
};

const TONE_CLASS: Record<StatePresentation["tone"], string> = {
  success: "cs-status cs-status--success",
  info: "cs-status cs-status--info",
  warn: "cs-status cs-status--warn",
  danger: "cs-status cs-status--danger",
  neutral: "cs-status",
};

async function authHeaders(): Promise<HeadersInit> {
  const token = await getCurrentAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true" data-testid="facturation-skeleton">
      <div className="cs-panel p-5">
        <div className="h-4 w-40 animate-pulse rounded-full bg-black/10" />
        <div className="mt-3 h-6 w-56 animate-pulse rounded-full bg-black/10" />
        <div className="mt-4 h-4 w-72 animate-pulse rounded-full bg-black/5" />
      </div>
      <div className="cs-panel p-5">
        <div className="h-11 w-56 animate-pulse rounded-full bg-black/10" />
      </div>
    </div>
  );
}

export function BillingManager() {
  const { authState } = useAuthGate();

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [sub, setSub] = React.useState<SubscriptionView | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [busy, setBusy] = React.useState<BusyAction>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [portalNotice, setPortalNotice] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/billing/subscription?agent_slug=${encodeURIComponent(AGENT_SLUG)}`,
        { headers: await authHeaders(), credentials: "same-origin", cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as SubscriptionResponse | null;
      if (!res.ok || !data?.ok || !data.subscription) {
        setLoadState("error");
        setLoadError("Impossible de récupérer votre statut d'abonnement pour le moment.");
        return;
      }
      setSub(data.subscription);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setLoadError("Impossible de récupérer votre statut d'abonnement pour le moment.");
    }
  }, []);

  React.useEffect(() => {
    if (authState === "authenticated") void load();
  }, [authState, load]);

  const runMutation = React.useCallback(
    async (action: "cancel" | "resume") => {
      setBusy(action);
      setActionError(null);
      setPortalNotice(null);
      try {
        const res = await fetch(`/api/orders/${action}`, {
          method: "POST",
          headers: await authHeaders(),
          credentials: "same-origin",
          body: JSON.stringify({ agent_slug: AGENT_SLUG }),
        });
        const data = (await res.json().catch(() => null)) as MutationResponse | null;
        if (!res.ok || !data?.ok) {
          setActionError(
            action === "cancel"
              ? "L'annulation n'a pas pu être enregistrée. Réessayez dans un instant."
              : "Nous n'avons pas pu réactiver votre abonnement. Réessayez dans un instant.",
          );
          return;
        }
        setConfirmCancel(false);
        await load();
      } catch {
        setActionError("Une erreur réseau est survenue. Réessayez dans un instant.");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const openPortal = React.useCallback(async () => {
    setBusy("portal");
    setActionError(null);
    setPortalNotice(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: await authHeaders(),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as PortalResponse | null;
      if (res.ok && data?.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.code === "PORTAL_NOT_CONFIGURED" || data?.code === "STRIPE_NOT_CONFIGURED") {
        setPortalNotice("L'espace de facturation n'est pas encore configuré.");
      } else if (data?.code === "NO_CUSTOMER" || data?.code === "CUSTOMER_UNAVAILABLE") {
        setPortalNotice("Aucun compte de facturation n'est disponible pour le moment.");
      } else {
        setPortalNotice("Impossible d'ouvrir l'espace de facturation pour le moment.");
      }
    } catch {
      setPortalNotice("Impossible d'ouvrir l'espace de facturation pour le moment.");
    } finally {
      setBusy(null);
    }
  }, []);

  // Auth gate : skeleton pendant la vérification (redirige si non connecté).
  if (authState !== "authenticated") {
    return (
      <div className="cs-page-shell space-y-6 py-6">
        <LoadingSkeleton />
      </div>
    );
  }

  const presentation = sub ? PRESENTATION[sub.uiState] : null;
  const StatusIcon = presentation?.icon ?? Receipt;
  const renewalDate = sub ? formatDate(sub.currentPeriodEnd) : null;
  const cancelDate = sub ? formatDate(sub.currentPeriodEnd) : null;

  return (
    <main className="cs-page" data-testid="facturation-shell">
      <div className="cs-page-shell space-y-6 py-6">
        {/* Header */}
        <header className="cs-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]">
              <Receipt className="h-5 w-5" />
            </span>
            <div>
              <p className="cs-eyebrow mb-1">Facturation</p>
              <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
                Mon abonnement
              </h1>
            </div>
          </div>
          <Link
            href="/mon-clonestore"
            className="cs-liquid-button"
            aria-label="Retour à Mon CloneStore"
          >
            <ArrowLeft className="h-4 w-4" /> Mon CloneStore
          </Link>
        </header>

        {loadState === "loading" ? <LoadingSkeleton /> : null}

        {loadState === "error" ? (
          <section className="cs-panel p-5" role="alert" data-testid="facturation-load-error">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cs-danger)]" />
              <div>
                <p className="text-[0.94rem] font-semibold text-[var(--cs-ink-1)]">
                  Statut indisponible
                </p>
                <p className="mt-1 text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="cs-liquid-button mt-4"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {loadState === "ready" && sub && presentation ? (
          <>
            {/* Carte statut */}
            <section className="cs-panel p-5" data-testid="facturation-status" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]">
                    <StatusIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">
                      {presentation.label}
                    </h2>
                    <p className="text-[0.82rem] text-[var(--cs-ink-3)]">Employé IA RH · Pierre</p>
                  </div>
                </div>
                <span className={TONE_CLASS[presentation.tone]} data-ui-state={sub.uiState}>
                  {presentation.label}
                </span>
              </div>

              {presentation.description(sub) ? (
                <p className="mt-4 text-[0.9rem] leading-6 text-[var(--cs-ink-2)]">
                  {presentation.description(sub)}
                </p>
              ) : null}

              {/* Prochain renouvellement */}
              {sub.uiState !== "cancel_scheduled" && renewalDate ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--cs-line-soft)] bg-white/40 px-4 py-3">
                  <Clock className="h-4 w-4 text-[var(--cs-ink-3)]" />
                  <span className="text-[0.86rem] text-[var(--cs-ink-2)]">
                    Prochain renouvellement le {renewalDate}
                  </span>
                </div>
              ) : null}

              {sub.uiState === "none" ? (
                <div className="mt-4">
                  <Link href="/agents/pierre" className="cs-liquid-button cs-liquid-button--primary">
                    Découvrir Pierre <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </section>

            {/* Actions */}
            {sub.uiState !== "none" ? (
              <section className="cs-panel p-5" data-testid="facturation-actions">
                <p className="cs-eyebrow mb-1">Gérer</p>
                <h2 className="text-[1.02rem] font-semibold text-[var(--cs-ink-1)]">
                  Votre abonnement
                </h2>
                <p className="mt-1 text-[0.85rem] leading-6 text-[var(--cs-ink-3)]">
                  Moyen de paiement, factures et détails sont gérés dans l'espace de facturation
                  sécurisé.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void openPortal()}
                    disabled={busy !== null}
                    className="cs-liquid-button cs-liquid-button--primary"
                    aria-label="Gérer mon abonnement dans l'espace de facturation"
                  >
                    {busy === "portal" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Gérer mon abonnement
                  </button>

                  {sub.canResume ? (
                    <button
                      type="button"
                      onClick={() => void runMutation("resume")}
                      disabled={busy !== null}
                      className="cs-liquid-button"
                      aria-label="Conserver mon abonnement"
                    >
                      {busy === "resume" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Conserver mon abonnement
                    </button>
                  ) : null}

                  {sub.canCancel && !confirmCancel ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmCancel(true);
                        setActionError(null);
                        setPortalNotice(null);
                      }}
                      disabled={busy !== null}
                      className="cs-liquid-button"
                      aria-label="Annuler à la fin de la période"
                    >
                      <XCircle className="h-4 w-4" />
                      Annuler à la fin de la période
                    </button>
                  ) : null}
                </div>

                {/* Confirmation d'annulation */}
                {sub.canCancel && confirmCancel ? (
                  <div
                    className="mt-4 rounded-2xl border border-[var(--cs-line)] bg-white/50 p-4"
                    role="group"
                    aria-label="Confirmer l'annulation"
                    data-testid="facturation-confirm-cancel"
                  >
                    <p className="text-[0.88rem] leading-6 text-[var(--cs-ink-1)]">
                      {cancelDate
                        ? `Vous garderez Pierre jusqu'au ${cancelDate}. Confirmer l'annulation ?`
                        : "Vous garderez Pierre jusqu'à la fin de la période en cours. Confirmer l'annulation ?"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void runMutation("cancel")}
                        disabled={busy !== null}
                        className="cs-liquid-button"
                        aria-label="Confirmer l'annulation à la fin de la période"
                      >
                        {busy === "cancel" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Confirmer l'annulation
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        disabled={busy !== null}
                        className="cs-liquid-button"
                      >
                        Garder mon abonnement
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Messages */}
                {portalNotice ? (
                  <p
                    className="mt-4 text-[0.84rem] text-[var(--cs-ink-3)]"
                    role="status"
                    data-testid="facturation-portal-notice"
                  >
                    {portalNotice}
                  </p>
                ) : null}
                {actionError ? (
                  <p
                    className="mt-4 text-[0.84rem] text-[var(--cs-danger)]"
                    role="alert"
                    data-testid="facturation-action-error"
                  >
                    {actionError}
                  </p>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
