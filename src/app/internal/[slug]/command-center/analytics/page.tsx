// Analytics, Funnel and Launch Measurement Closure — dashboard funnel propriétaire.
// Même porte que readiness/ (OwnerGate + resolveFounderAdmin), aucune donnée personnelle,
// aucun taux sans dénominateur, aucun graphique trompeur. Chiffres bruts uniquement.

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolveAnalyticsDashboardAccess, FUNNEL_V1_STAGE_ORDER } from "@/lib/analytics/dashboard-guard";
import { OwnerGate } from "../OwnerGate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics — Funnel", robots: { index: false, follow: false } };

const MIN_SAMPLE_SIZE = 10;

function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default async function AnalyticsDashboardPage(
  { params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ qa?: string }> },
) {
  const { slug } = await params;
  const { qa } = await searchParams;
  const includeQa = qa === "1"; // contrôle propriétaire « Inclure le trafic QA » — OFF par défaut
  const cookieHeader = (await headers()).get("cookie");
  const r = await resolveAnalyticsDashboardAccess({
    slug,
    cookieHeader,
    loginReturnPath: `/internal/${slug}/command-center/analytics`,
    includeQa,
  });

  if (r.kind === "notfound") notFound();
  if (r.kind === "locked") return <OwnerGate />;
  if (r.kind === "redirect") redirect(r.to);

  const byName = new Map(r.stages.map((s) => [s.eventName, s]));

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ marginBottom: 4 }}>
        <a href={`/internal/${slug}/command-center`}>← Command Center</a>
      </p>
      <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>
        Funnel canonique — {r.includeQa ? "trafic externe + QA (test)" : "trafic externe uniquement"}
      </h1>
      <p style={{ color: "#666", fontSize: "0.85rem" }}>
        Connecté : {r.email} · Fenêtre : {r.windowSinceIso.slice(0, 10)} → {r.windowUntilIso.slice(0, 10)} ·
        Trafic bot/automatisé et interne TOUJOURS exclu. Le trafic QA (test) est exclu par défaut.
      </p>
      <p style={{ marginTop: 8, fontSize: "0.85rem" }}>
        <label style={{ userSelect: "none" }}>
          <input type="checkbox" checked={r.includeQa} readOnly aria-label="Inclure le trafic QA" style={{ marginRight: 6 }} />
          Inclure le trafic QA
        </label>{" "}
        —{" "}
        {r.includeQa ? (
          <a href={`/internal/${slug}/command-center/analytics`}>revenir au trafic externe uniquement</a>
        ) : (
          <a href={`/internal/${slug}/command-center/analytics?qa=1`}>inclure le trafic QA (test)</a>
        )}
      </p>

      {!r.storageAvailable && (
        <p style={{ background: "#fee", padding: "0.75rem", borderRadius: 4, marginTop: "1rem" }}>
          Stockage analytics indisponible — aucune donnée à afficher pour cette fenêtre. Ce n'est
          jamais présenté comme « zéro visiteur », mais comme une indisponibilité de mesure.
        </p>
      )}

      {r.storageAvailable && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "0.4rem" }}>Étape</th>
                <th style={{ padding: "0.4rem" }}>Visiteurs distincts</th>
                <th style={{ padding: "0.4rem" }}>Sessions distinctes</th>
                <th style={{ padding: "0.4rem" }}>Runs démo distincts</th>
                <th style={{ padding: "0.4rem" }}>Total événements</th>
              </tr>
            </thead>
            <tbody>
              {FUNNEL_V1_STAGE_ORDER.map((name) => {
                const s = byName.get(name);
                const low = (s?.distinctVisitors ?? 0) < MIN_SAMPLE_SIZE;
                return (
                  <tr key={name} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{name}</td>
                    <td style={{ padding: "0.4rem" }}>{s?.distinctVisitors ?? 0}</td>
                    <td style={{ padding: "0.4rem" }}>{s?.distinctSessions ?? 0}</td>
                    <td style={{ padding: "0.4rem" }}>{s?.distinctDemoRuns ?? 0}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {s?.totalEvents ?? 0}
                      {low && <span style={{ color: "#b45309", marginLeft: 6, fontSize: "0.75rem" }}>échantillon insuffisant</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Taux d'étape à étape (avec dénominateur toujours visible)</h2>
          <ul>
            <li>
              demo_started → demo_completed :{" "}
              {rate(byName.get("demo_completed")?.distinctVisitors ?? 0, byName.get("demo_started")?.distinctVisitors ?? 0)}{" "}
              ({byName.get("demo_completed")?.distinctVisitors ?? 0} / {byName.get("demo_started")?.distinctVisitors ?? 0})
            </li>
            <li>
              pierre_demo_started → pierre_demo_completed :{" "}
              {rate(byName.get("pierre_demo_completed")?.distinctDemoRuns ?? 0, byName.get("pierre_demo_started")?.distinctDemoRuns ?? 0)}{" "}
              ({byName.get("pierre_demo_completed")?.distinctDemoRuns ?? 0} / {byName.get("pierre_demo_started")?.distinctDemoRuns ?? 0})
            </li>
            <li>
              checkout_started → payment_succeeded :{" "}
              {rate(byName.get("payment_succeeded")?.distinctVisitors ?? 0, byName.get("checkout_started")?.distinctVisitors ?? 0)}{" "}
              ({byName.get("payment_succeeded")?.distinctVisitors ?? 0} / {byName.get("checkout_started")?.distinctVisitors ?? 0})
            </li>
          </ul>

          {r.health && (
            <>
              <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Santé de la mesure</h2>
              <p>Événements acceptés (fenêtre) : {r.health.eventsAccepted}</p>
              <ul>
                {Object.entries(r.health.eventsByTrustLevel).map(([level, count]) => (
                  <li key={level}>
                    {level} : {count}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#999" }}>
        Aucune donnée personnelle affichée : pas d'email, pas d'IP, pas de nom, pas de contenu de
        formulaire. Voir ANALYTICS_DASHBOARD_SPEC.md.
      </p>
    </main>
  );
}
