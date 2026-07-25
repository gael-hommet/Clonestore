"use client";

// Phase E.2 — Formulaire de réservation Founder Access (2 étapes, premium CloneStore).
// Étape 1 persistée serveur AVANT l'étape 2. Succès uniquement après confirmation serveur.

import * as React from "react";
import Link from "next/link";
import { Check, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { COMPANY_SIZES, type CompanySize } from "@/lib/founder-access/types";
import { FOUNDER_REASSURANCE, FOUNDER_RESERVATION_RULE, getFounderCtaCopy } from "@/lib/founder-access/commercial";
import { emitFounderEvent } from "@/lib/founder-access/funnel-events";
// Canonical Analytics Runtime Wiring — signaux d'INTENTION client uniquement (jamais une vérité
// serveur). Aucun champ de formulaire (email/nom/téléphone/entreprise) n'entre jamais dans un
// événement analytique.
import { track, currentPageViewId } from "@/lib/analytics/client/track";

type Phase = "step1" | "step2" | "success";

function anonSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const k = "cs_anon_sid";
    let id = sessionStorage.getItem(k);
    if (!id) { id = (crypto.randomUUID?.() ?? String(Date.now() + Math.random())); sessionStorage.setItem(k, id); }
    return id;
  } catch {
    return undefined;
  }
}

function tracking() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    landing_path: window.location.pathname,
    referrer: document.referrer || undefined,
    utm_source: p.get("utm_source") ?? undefined,
    utm_medium: p.get("utm_medium") ?? undefined,
    utm_campaign: p.get("utm_campaign") ?? undefined,
    utm_content: p.get("utm_content") ?? undefined,
    utm_term: p.get("utm_term") ?? undefined,
    source: p.get("source") ?? "reserver_pierre",
    anonymous_session_id: anonSessionId(),
  };
}

const card = "rounded-[1.5rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,250,241,0.55))] p-6 sm:p-8 shadow-[0_24px_70px_rgba(18,24,36,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl";
const label = "block text-[0.78rem] font-semibold text-[var(--cs-ink-2)] mb-1.5";
const input = "w-full rounded-xl border border-[var(--cs-line)] bg-white/80 px-3.5 py-2.5 text-[0.92rem] text-[var(--cs-ink-1)] outline-none focus:border-[#6b63e8] focus:ring-2 focus:ring-[rgba(107,99,232,0.25)]";
const violetBtn = "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-7 text-[0.95rem] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b63e8] focus-visible:ring-offset-2 disabled:opacity-70";
const violetStyle: React.CSSProperties = {
  background: "linear-gradient(180deg,#7b73f0 0%,#6b63e8 52%,#4f48b8 100%)",
  border: "1px solid rgba(107,99,232,0.5)",
  boxShadow: "0 18px 42px rgba(79,72,184,0.32), inset 0 2px 0 rgba(255,255,255,0.18)",
};

export function ReservationForm({ confirmState }: { confirmState?: string }) {
  const [phase, setPhase] = React.useState<Phase>("step1");
  const [reservationId, setReservationId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [step2Failed, setStep2Failed] = React.useState(false);
  const [resendState, setResendState] = React.useState<"idle" | "sending" | "sent">("idle");
  const startedRef = React.useRef(false);

  async function resendEmail() {
    if (resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch("/api/founder-access/resend-verification", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: s1.email }),
      });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  const [s1, setS1] = React.useState({ email: "", company_name: "", company_size: "" as CompanySize | "" });
  const [s2, setS2] = React.useState({ full_name: "", role: "", primary_hr_need: "", sector: "", website: "", phone: "", contact_requested: false });

  React.useEffect(() => { emitFounderEvent("founder_form_viewed", { landingPath: "/reserver/pierre" }); }, []);

  function markStarted() {
    if (!startedRef.current) {
      startedRef.current = true;
      emitFounderEvent("founder_form_step1_started");
      // Canonique : intention client de démarrer le formulaire (jamais une vérité serveur).
      track("reservation_form_started", {
        pageViewId: currentPageViewId() ?? undefined,
        dedupeKey: "reservation_form_started:/reserver/pierre",
      });
    }
  }

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setErrors({}); setServerError(null); setSubmitting(true);
    // Canonique : le NAVIGATEUR soumet le formulaire. Ne signifie PAS que la réservation existe
    // (reservation_created est une vérité serveur émise par l'API). Aucun champ de formulaire.
    track("reservation_submitted", {
      pageViewId: currentPageViewId() ?? undefined,
      dedupeKey: "reservation_submitted:/reserver/pierre",
    });
    try {
      const res = await fetch("/api/founder-access/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: s1.email, company_name: s1.company_name, company_size: s1.company_size, website_hp: "", ...tracking() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.errors) setErrors(data.errors);
        else setServerError("Une erreur est survenue. Réessayez dans un instant.");
        return;
      }
      setReservationId(data.reservationId ?? null);
      // founder_reservation_created est un événement de VÉRITÉ SERVEUR : il est inséré
      // par le serveur (createOrUpdateReservation), jamais émis par le navigateur (§3).
      emitFounderEvent("founder_form_step1_completed", { reservationId: data.reservationId });
      emitFounderEvent("founder_form_step2_viewed", { reservationId: data.reservationId });
      setPhase("step2");
    } catch {
      setServerError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStep2(skip: boolean) {
    setErrors({}); setServerError(null); setStep2Failed(false);
    if (skip || !reservationId) { finishSuccess(); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/founder-access/reservations/${reservationId}/qualification`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(s2),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Erreur de validation → on reste sur l'étape pour correction.
        if (data?.errors) { setErrors(data.errors); setSubmitting(false); return; }
        // §3.4 — la RÉSERVATION reste valide ; seules les infos facultatives ont échoué.
        // Ne jamais laisser croire qu'elles ont été enregistrées : état précis + Réessayer.
        setStep2Failed(true);
        emitFounderEvent("founder_form_step2_failed", { reservationId });
        setSubmitting(false);
        return;
      }
      emitFounderEvent("founder_form_step2_completed", { reservationId });
      // founder_contact_requested = vérité serveur (recordé par updateQualification).
      finishSuccess();
    } catch {
      // Échec réseau : la réservation (étape 1) est déjà persistée côté serveur.
      setStep2Failed(true);
      emitFounderEvent("founder_form_step2_failed", { reservationId });
      setSubmitting(false);
    }
  }

  function finishSuccess() { setStep2Failed(false); setPhase("success"); }

  const cta = getFounderCtaCopy();

  return (
    <div className="mx-auto w-full max-w-[680px]">
      {confirmState === "ok" ? (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-[rgba(21,130,96,0.3)] bg-[rgba(21,130,96,0.08)] px-4 py-3 text-[0.86rem] font-semibold text-[var(--cs-success)]">
          <Check className="h-4 w-4" aria-hidden="true" /> Votre adresse email est confirmée. Vous recevrez votre accès à l'activation.
        </div>
      ) : null}

      {phase === "success" ? (
        <div className={card}>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(21,130,96,0.12)] text-[var(--cs-success)]">
            <Check className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="cs-heading mt-4 text-2xl">Votre réservation a bien été enregistrée.</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
            Confirmez votre adresse email pour recevoir votre accès à l'activation de Pierre.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/demo/pierre" className="cs-liquid-button min-h-11 px-5">Revoir Pierre</Link>
            <button type="button" onClick={resendEmail} disabled={resendState === "sending"}
              className="text-[0.86rem] font-semibold text-[var(--cs-ink-3)] underline-offset-2 hover:underline disabled:opacity-60">
              {resendState === "sent" ? "Email renvoyé" : resendState === "sending" ? "Envoi…" : "Renvoyer l'email"}
            </button>
          </div>
        </div>
      ) : (
        <div className={card}>
          {/* Progression */}
          <div className="mb-5 flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
            <span className={phase === "step1" ? "text-[#6b63e8]" : ""}>1 · Réservation</span>
            <span className="h-px flex-1 bg-[var(--cs-line)]" />
            <span className={phase === "step2" ? "text-[#6b63e8]" : ""}>2 · Qualification (facultatif)</span>
          </div>

          {phase === "step1" ? (
            <form onSubmit={submitStep1} noValidate className="space-y-4">
              <div>
                <label className={label} htmlFor="fa-email">Email professionnel</label>
                <input id="fa-email" type="email" autoComplete="email" className={input}
                  value={s1.email} onChange={(e) => { markStarted(); setS1({ ...s1, email: e.target.value }); }} />
                {errors.email ? <p className="mt-1 text-[0.78rem] text-[var(--cs-danger)]">{errors.email}</p> : null}
              </div>
              <div>
                <label className={label} htmlFor="fa-company">Entreprise</label>
                <input id="fa-company" className={input}
                  value={s1.company_name} onChange={(e) => { markStarted(); setS1({ ...s1, company_name: e.target.value }); }} />
                {errors.company_name ? <p className="mt-1 text-[0.78rem] text-[var(--cs-danger)]">{errors.company_name}</p> : null}
              </div>
              <div>
                <label className={label}>Taille de l'entreprise</label>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_SIZES.map((sz) => (
                    <button key={sz} type="button" onClick={() => { markStarted(); setS1({ ...s1, company_size: sz }); }}
                      className={`rounded-full border px-3.5 py-2 text-[0.82rem] font-semibold transition-all ${s1.company_size === sz ? "border-[rgba(107,99,232,0.4)] bg-[rgba(107,99,232,0.1)] text-[#4f48b8]" : "border-[var(--cs-line)] bg-white/70 text-[var(--cs-ink-3)]"}`}>
                      {sz === "1000+" ? "1 000+" : sz.replace("-", "–")}
                    </button>
                  ))}
                </div>
                {errors.company_size ? <p className="mt-1 text-[0.78rem] text-[var(--cs-danger)]">{errors.company_size}</p> : null}
              </div>
              {/* honeypot caché */}
              <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
              {serverError ? <p className="text-[0.82rem] text-[var(--cs-danger)]">{serverError}</p> : null}
              <button type="submit" disabled={submitting} className={violetBtn} style={violetStyle}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {cta.primaryLabel}
                {!submitting ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-[0.86rem] text-[var(--cs-ink-3)]">
                Votre réservation est enregistrée. Ces informations sont facultatives — elles nous aident à préparer votre arrivée.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={label} htmlFor="fa-name">Nom et prénom</label><input id="fa-name" className={input} value={s2.full_name} onChange={(e) => setS2({ ...s2, full_name: e.target.value })} /></div>
                <div><label className={label} htmlFor="fa-role">Fonction</label><input id="fa-role" className={input} value={s2.role} onChange={(e) => setS2({ ...s2, role: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className={label} htmlFor="fa-need">Besoin RH principal</label><input id="fa-need" className={input} value={s2.primary_hr_need} onChange={(e) => setS2({ ...s2, primary_hr_need: e.target.value })} /></div>
                <div><label className={label} htmlFor="fa-sector">Secteur d'activité</label><input id="fa-sector" className={input} value={s2.sector} onChange={(e) => setS2({ ...s2, sector: e.target.value })} /></div>
                <div><label className={label} htmlFor="fa-web">Site internet</label><input id="fa-web" className={input} value={s2.website} onChange={(e) => setS2({ ...s2, website: e.target.value })} />{errors.website ? <p className="mt-1 text-[0.78rem] text-[var(--cs-danger)]">{errors.website}</p> : null}</div>
                <div><label className={label} htmlFor="fa-phone">Téléphone</label><input id="fa-phone" className={input} value={s2.phone} onChange={(e) => setS2({ ...s2, phone: e.target.value })} />{errors.phone ? <p className="mt-1 text-[0.78rem] text-[var(--cs-danger)]">{errors.phone}</p> : null}</div>
              </div>
              <label className="flex items-center gap-2.5 text-[0.86rem] text-[var(--cs-ink-2)]">
                <input type="checkbox" checked={s2.contact_requested} onChange={(e) => setS2({ ...s2, contact_requested: e.target.checked })} className="h-4 w-4 accent-[#6b63e8]" />
                Je souhaite être contacté
              </label>
              {step2Failed ? (
                <div className="rounded-2xl border border-[rgba(193,120,23,0.35)] bg-[rgba(193,120,23,0.08)] p-4 text-[0.84rem] leading-relaxed text-[#7a4d08]">
                  <p className="font-semibold">Votre réservation est enregistrée.</p>
                  <p className="mt-1">Certaines informations facultatives n'ont pas pu être sauvegardées. Vous pouvez réessayer ou les compléter plus tard.</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="button" disabled={submitting} onClick={() => submitStep2(false)} className={violetBtn} style={violetStyle}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {step2Failed ? "Réessayer" : "Terminer"}
                </button>
                <button type="button" onClick={() => submitStep2(true)} className="text-[0.86rem] font-semibold text-[var(--cs-ink-3)] underline-offset-2 hover:underline">
                  {step2Failed ? "Continuer sans ces informations" : "Ignorer cette étape"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Réassurance */}
      <div className="mt-5 rounded-2xl border border-white/55 bg-white/45 p-4 backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6b63e8]" aria-hidden="true" />
          <div className="space-y-0.5">
            {FOUNDER_REASSURANCE.map((line) => (
              <p key={line} className="text-[0.82rem] text-[var(--cs-ink-2)]">{line}</p>
            ))}
          </div>
        </div>
        <p className="mt-3 border-t border-[var(--cs-line-soft)] pt-3 text-[0.74rem] text-[var(--cs-ink-4)]">
          {FOUNDER_RESERVATION_RULE}{" "}
          <Link href="/legal/confidentialite" className="underline hover:text-[var(--cs-ink-2)]">Politique de confidentialité</Link>.
        </p>
      </div>
    </div>
  );
}
