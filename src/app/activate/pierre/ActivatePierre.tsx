"use client";

// Phase E.4 — Activation client de Pierre. Réutilise l'infrastructure de checkout
// existante (session Supabase → Bearer → /api/checkout). Le client NE fixe jamais
// le prix : le serveur impose produit, tarif et éligibilité. La liaison réservation
// est revalidée serveur (email + phase + confirmée).

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { getSessionClient } from "@/lib/auth/session-client";
import { buildCheckoutAuthHeaders, sanitizeCheckoutError } from "@/lib/checkout/checkout-helpers";
import { FOUNDER_PRICE_MONTHLY, FOUNDER_CLOSE_LABEL } from "@/lib/founder-access/commercial";
import { emitFounderEvent } from "@/lib/founder-access/funnel-events";
// Canonical Analytics Runtime Wiring — signaux d'INTENTION client (activation_started,
// checkout_started). La VÉRITÉ (checkout_session_created, activation_completed, payment_succeeded)
// vient exclusivement du serveur. Aucun montant/Price ID/URL Stripe côté client.
import { track, currentPageViewId } from "@/lib/analytics/client/track";

const violetStyle: React.CSSProperties = {
  background: "linear-gradient(180deg,#7b73f0 0%,#6b63e8 52%,#4f48b8 100%)",
  border: "1px solid rgba(107,99,232,0.5)",
  boxShadow: "0 18px 42px rgba(79,72,184,0.32)",
};

export function ActivatePierre({ reservationId, companyName }: { reservationId: string | null; companyName: string | null }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    emitFounderEvent("founder_activation_viewed", { reservationId: reservationId ?? undefined });
    (async () => {
      try {
        const { data } = await getSessionClient().auth.getSession();
        setToken(data.session?.access_token ?? null);
      } catch { setToken(null); } finally { setChecked(true); }
    })();
  }, [reservationId]);

  async function activate() {
    if (!token || loading) return;
    setLoading(true); setError(null);
    emitFounderEvent("founder_activation_started", { reservationId: reservationId ?? undefined });
    // Canonique : intention client de démarrer l'activation.
    track("activation_started", {
      pageViewId: currentPageViewId() ?? undefined,
      dedupeKey: "activation_started:/activate/pierre",
    });
    try {
      const headers = buildCheckoutAuthHeaders(token);
      if (!headers) { setError("Connexion requise pour continuer."); setLoading(false); return; }
      // Canonique : intention client de déclencher réellement le checkout (avant l'appel serveur).
      // La création RÉELLE de la session (checkout_session_created) est émise par /api/checkout.
      track("checkout_started", {
        pageViewId: currentPageViewId() ?? undefined,
        dedupeKey: "checkout_started:/activate/pierre",
      });
      const res = await fetch("/api/checkout", {
        method: "POST", headers,
        body: JSON.stringify({ agent_slug: "pierre", founder_reservation_id: reservationId ?? undefined }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (data?.already_active === true) { window.location.href = "/agents/pierre/use"; return; }
      if (!res.ok) {
        const code = typeof data?.code === "string" ? data.code : null;
        if (code === "AUTH_REQUIRED" || code === "AUTH_INVALID") { setToken(null); setLoading(false); return; }
        throw new Error(sanitizeCheckoutError(code, typeof data?.error === "string" ? data.error : null));
      }
      const url = (data?.url as string) ?? null;
      if (!url) throw new Error("Aucune URL de paiement n'a été renvoyée.");
      emitFounderEvent("founder_checkout_started", { reservationId: reservationId ?? undefined });
      window.location.href = url;
    } catch (e) {
      emitFounderEvent("founder_checkout_failed", { reservationId: reservationId ?? undefined });
      setError(e instanceof Error ? e.message : "Activation impossible pour le moment.");
      setLoading(false);
    }
  }

  const loginHref = `/login?redirect=${encodeURIComponent(`/activate/pierre${reservationId ? `?rid=${reservationId}` : ""}`)}`;

  return (
    <div className="rounded-[1.8rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,250,241,0.6))] p-8 shadow-[0_24px_70px_rgba(18,24,36,0.08)] backdrop-blur-xl">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#6b63e8]">Accès fondateur ouvert</p>
      <h1 className="cs-heading mt-2 text-[2rem] leading-tight">Activer Pierre{companyName ? ` pour ${companyName}` : ""}.</h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
        {FOUNDER_PRICE_MONTHLY}. Le tarif fondateur est conservé tant que l'abonnement reste actif, à condition d'activer avant le {FOUNDER_CLOSE_LABEL}.
      </p>

      {error ? <p className="mt-4 text-[0.86rem] text-[var(--cs-danger)]">{error}</p> : null}

      <div className="mt-6">
        {!checked ? (
          <button type="button" disabled className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 font-bold text-white opacity-60" style={violetStyle}>
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
          </button>
        ) : !token ? (
          <div className="space-y-3">
            <p className="text-[0.88rem] text-[var(--cs-ink-3)]">Connectez-vous avec l'adresse de votre réservation pour activer Pierre.</p>
            <Link href={loginHref} className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 font-bold text-white" style={violetStyle}>
              <LogIn className="h-4 w-4" /> Se connecter pour activer
            </Link>
          </div>
        ) : (
          <button type="button" onClick={activate} disabled={loading}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-70" style={violetStyle}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Activer Pierre à 449&nbsp;€ HT/mois {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        )}
      </div>

      <p className="mt-6 flex items-center gap-2 border-t border-[var(--cs-line-soft)] pt-4 text-[0.78rem] text-[var(--cs-ink-4)]">
        <ShieldCheck className="h-4 w-4 text-[#6b63e8]" aria-hidden="true" />
        Paiement sécurisé Stripe. Votre accès devient actif après confirmation du paiement.
      </p>
    </div>
  );
}
