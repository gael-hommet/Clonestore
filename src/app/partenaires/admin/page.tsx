// Programme partenaires — console d'administration (PAGE SERVER, gardée).
// Réutilise EXACTEMENT le pattern de founding-partners/admin : resolveFounderAdmin()
// côté serveur → notFound() si non autorisé, sinon rend la console cliente.
// L'accès est déjà protégé côté serveur (allowlist email + session Supabase).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveFounderAdmin } from "@/lib/founder-access/admin-guard";
import AdminConsole from "./AdminConsole";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Programme partenaires — Administration",
  robots: { index: false, follow: false },
};

export default async function PartnersAdminPage() {
  const auth = await resolveFounderAdmin();
  if (!auth.ok) notFound();

  return <AdminConsole adminEmail={auth.email} />;
}
