// Phase E.6 — Founder Command Center : route RÉELLEMENT dynamique au slug secret.
// Ordre des contrôles (fail-closed) :
//   1. slug present + exact          → sinon notFound() (404, ne révèle rien)
//   2. porte propriétaire (cookie)   → sinon OwnerGate, AUCUNE donnée
//   3. session Supabase              → sinon redirect /login
//   4. allowlist administrateur      → sinon notFound()
//   5. chargement des données        → uniquement ici

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { listReservations, recordAdminAudit } from "@/lib/founder-access/store";
import { getFounderCommandCenterSnapshot, listFounderClients } from "@/lib/founder-access/command-center";
import { getFounderPhase } from "@/lib/founder-access/commercial";
import { resolveCockpitAccess } from "./cockpit-guard";
import { CommandCenter } from "./CommandCenter";
import { OwnerGate } from "./OwnerGate";

export const dynamic = "force-dynamic";

// La garde est résolue dans generateMetadata, AVANT que le corps ne soit streamé : c'est
// la seule façon fiable d'émettre un VRAI statut HTTP (404 mauvais slug / hors allowlist,
// 307 login) — en rendu dynamique streamé, un notFound()/redirect() dans le corps arrive
// après l'envoi des en-têtes (200) et ne change plus le statut.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cookieHeader = (await headers()).get("cookie");
  const access = await resolveCockpitAccess(slug, cookieHeader);
  if (access.kind === "notfound") notFound();
  if (access.kind === "redirect") redirect(access.to);
  return { title: "Command Center", robots: { index: false, follow: false } };
}

export default async function FounderCockpitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieHeader = (await headers()).get("cookie");

  // Contrôles fail-closed (slug → porte → session → allowlist), extraits + testés.
  // generateMetadata a déjà émis le statut pour notfound/redirect ; ici on rend.
  const access = await resolveCockpitAccess(slug, cookieHeader);
  if (access.kind === "notfound") notFound();            // défense en profondeur
  if (access.kind === "locked") return <OwnerGate />;    // porte verrouillée → formulaire seul, aucune DB
  if (access.kind === "redirect") redirect(access.to);   // session absente → /login?next=…

  // Données réelles uniquement après tous les contrôles.
  const db = await getRuntimeDb();
  const [snapshot, prospects, clients] = await Promise.all([
    getFounderCommandCenterSnapshot(db),
    listReservations(db, { exclude_active_client: true }, 1, 25), // §20 — prospects ≠ clients actifs
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
