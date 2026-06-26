// Entrée OFFICIELLE du Founder Command Center : /founder (puis https://clonestore.fr/founder).
// AUCUN slug exposé ni demandé. Réutilise la MÊME garde (porte → session → allowlist) et
// rend le MÊME composant CommandCenter — ce n'est PAS un redirect aveugle vers l'URL au slug.
//
//   porte verrouillée                      → formulaire mot de passe (OwnerGate)
//   ouverte + aucune session Supabase       → redirect /login?next=/founder
//   ouverte + email hors allowlist          → notFound()
//   ouverte + email allowlisté              → Founder Command Center complet

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { listReservations, recordAdminAudit } from "@/lib/founder-access/store";
import { getFounderCommandCenterSnapshot, listFounderClients } from "@/lib/founder-access/command-center";
import { getFounderPhase } from "@/lib/founder-access/commercial";
import { resolveFounderCockpitAccess } from "../internal/[slug]/command-center/cockpit-guard";
import { CommandCenter } from "../internal/[slug]/command-center/CommandCenter";
import { OwnerGate } from "../internal/[slug]/command-center/OwnerGate";

export const dynamic = "force-dynamic"; // données cockpit toujours fraîches, jamais mises en cache
export const metadata: Metadata = { title: "Founder Command Center", robots: { index: false, follow: false } };

export default async function FounderPage() {
  const cookieHeader = (await headers()).get("cookie");
  const access = await resolveFounderCockpitAccess({ cookieHeader, loginReturnPath: "/founder" });

  if (access.kind === "notfound") notFound();            // porte non configurée / hors allowlist
  if (access.kind === "locked") return <OwnerGate />;    // formulaire seul, aucune donnée chargée
  if (access.kind === "redirect") redirect(access.to);   // session absente → /login?next=/founder

  // Données réelles uniquement après tous les contrôles.
  const db = await getRuntimeDb();
  const [snapshot, prospects, clients] = await Promise.all([
    getFounderCommandCenterSnapshot(db),
    listReservations(db, { exclude_active_client: true }, 1, 25),
    listFounderClients(db, 1, 25),
  ]);
  await recordAdminAudit(db, { actor_email: access.email, action: "cockpit.open" });

  return (
    <CommandCenter
      adminEmail={access.email}
      commercialPhase={getFounderPhase()}
      snapshot={snapshot}
      initialProspects={prospects}
      clients={clients}
    />
  );
}
