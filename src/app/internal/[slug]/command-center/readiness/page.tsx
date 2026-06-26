// BLOC FINAL §11 — page interne de READINESS production. Mince rendu au-dessus de
// resolveReadiness (toute la garde + l'assemblage des données y sont testés). Données
// réelles, AUCUN secret ni URL affiché : uniquement présence/conformité, blockers/warnings.

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolveReadiness } from "./readiness-guard";
import { OwnerGate } from "../OwnerGate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Readiness", robots: { index: false, follow: false } };

export default async function ReadinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieHeader = (await headers()).get("cookie");
  const r = await resolveReadiness(slug, cookieHeader);

  if (r.kind === "notfound") notFound();
  if (r.kind === "locked") return <OwnerGate />;
  if (r.kind === "redirect") redirect(r.to);

  const { email, components, verdict } = r;
  const now = new Date().toLocaleString("fr-FR");

  return (
    <main className="cs-page"><div className="cs-shell" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <p className="cs-eyebrow">Founder Command Center</p>
      <h1 className="cs-heading mt-1 text-2xl">Readiness production</h1>
      <p className="mt-1 text-[0.74rem] text-[var(--cs-ink-4)]">{email} · {now}</p>

      <div className={`mt-5 rounded-2xl border p-4 ${verdict.status === "ready" ? "border-[rgba(21,130,96,0.35)] bg-[rgba(21,130,96,0.06)]" : "border-[rgba(193,120,23,0.4)] bg-[rgba(193,120,23,0.07)]"}`}>
        <p className="text-[0.78rem] font-bold uppercase tracking-wide text-[var(--cs-ink-3)]">Verdict</p>
        <p className={`text-xl font-bold ${verdict.status === "ready" ? "text-[var(--cs-success)]" : "text-[#7a4d08]"}`}>
          {verdict.status === "ready" ? "READY" : "BLOCKED"}
        </p>
        <p className="mt-1 text-[0.82rem] text-[var(--cs-ink-3)]">{verdict.blockers.length} blocker(s) · {verdict.warnings.length} warning(s)</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {components.map((c) => (
          <div key={c.key} className="rounded-2xl border border-white/60 bg-white/55 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[var(--cs-ink-1)]">{c.key}</p>
              <span className={`rounded-full px-2 py-0.5 text-[0.64rem] font-bold ${c.ok ? "bg-[rgba(21,130,96,0.12)] text-[var(--cs-success)]" : "bg-[rgba(193,120,23,0.12)] text-[#7a4d08]"}`}>{c.ok ? "OK" : "BLOCKED"}</span>
            </div>
            {c.blockers.map((b, i) => <p key={i} className="mt-1 text-[0.76rem] text-[var(--cs-danger)]">✗ {b}</p>)}
            {c.warnings.map((w, i) => <p key={i} className="mt-1 text-[0.74rem] text-[#7a4d08]">! {w}</p>)}
            {c.ok && c.warnings.length === 0 ? <p className="mt-1 text-[0.74rem] text-[var(--cs-ink-4)]">conforme</p> : null}
          </div>
        ))}
      </div>

      <p className="mt-5 text-[0.72rem] text-[var(--cs-ink-4)]">
        Les preuves externes (Stripe test-mode, Resend, base production) s&apos;exécutent via les
        scripts opérateur (npm run smoke:*, npm run db:verify-founder-production). Aucun
        secret ni URL n&apos;est affiché sur cette page.
      </p>
    </div></main>
  );
}
