"use client";

// Phase E §4.3 — Écran d'accès propriétaire. Aucune donnée commerciale visible,
// aucun KPI préchargé. Sur l'URL au slug, le slug est lu depuis l'URL et renvoyé à la
// route d'unlock ; sur /founder, AUCUN slug n'est exposé ni envoyé (le mot de passe est
// le secret réel — la route d'unlock traite le slug comme optionnel).

import * as React from "react";
import { Loader2, Lock } from "lucide-react";

function slugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/internal\/([^/]+)\/command-center(?:\/[a-z-]+)?\/?$/);
  return m ? m[1] : null;
}

export function OwnerGate() {
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [denied, setDenied] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setDenied(false);
    try {
      const slug = slugFromPath();
      const res = await fetch("/api/internal/owner-gate/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // /founder : aucun slug envoyé. URL au slug : slug renvoyé pour contrôle exact.
        body: JSON.stringify(slug ? { password, slug } : { password }),
      });
      // Recharge l'URL courante (reste sur /founder ou sur l'URL au slug) — jamais de
      // reconstruction d'une ancienne URL avec un slug erroné.
      if (res.ok) { window.location.reload(); return; }
      setDenied(true);
    } catch {
      setDenied(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e1014] px-4 text-white">
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-white/80">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-white/45">CloneStore Founder Command Center</p>
        <h1 className="mt-1.5 text-lg font-semibold">Accès propriétaire</h1>

        <label className="mt-6 block text-[0.78rem] font-semibold text-white/60" htmlFor="og-pw">Mot de passe</label>
        <input
          id="og-pw" type="password" autoComplete="current-password" autoFocus
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 text-[0.92rem] text-white outline-none focus:border-[#8b84ff] focus:ring-2 focus:ring-[rgba(139,132,255,0.3)]"
        />

        {denied ? <p className="mt-3 text-[0.82rem] font-medium text-[#ff8a8a]">Accès refusé</p> : null}

        <button
          type="submit" disabled={submitting}
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-[0.92rem] font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-70"
          style={{ background: "linear-gradient(180deg,#7b73f0,#6b63e8 52%,#4f48b8)", border: "1px solid rgba(107,99,232,0.5)" }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ouvrir le cockpit
        </button>
      </form>
    </main>
  );
}
