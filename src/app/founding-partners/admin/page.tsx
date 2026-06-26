// CloneStory — administration minimale (gardée). Session Supabase + allowlist
// propriétaire (réutilise la garde Phase E). FAIL-CLOSED : 404 si non autorisé.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveFounderAdmin } from "@/lib/founder-access/admin-guard";
import { StoryDisplay, StoryEyebrow } from "@/components/clonestory/primitives";
import AdminConsole from "./AdminConsole";
import { adminListAudit, adminListConflicts, adminSearchPartners } from "@/lib/clonestory/founding-partners/server/admin-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration — CloneStory", robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const auth = await resolveFounderAdmin();
  if (!auth.ok) notFound();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [partners, conflicts, audit] = await Promise.all([
    adminSearchPartners(q, 50),
    adminListConflicts(),
    adminListAudit(60),
  ]);

  return (
    <main className="csy-canvas">
      <section className="csy-section" style={{ paddingTop: "clamp(48px,7vh,96px)" }}>
        <div className="csy-shell">
          <StoryEyebrow>CloneStory · Administration du Cercle</StoryEyebrow>
          <div style={{ marginTop: 18 }}>
            <StoryDisplay>Contrôle du registre</StoryDisplay>
          </div>
          <p className="csy-copy" style={{ marginTop: 16 }}>Connecté : {auth.email}</p>
          <div style={{ marginTop: 36 }}>
            <AdminConsole
              partners={partners.map((p) => ({
                id: p.id, display_name: p.display_name, email: p.email, status: p.status,
                personal_code: p.personal_code, link_revoked_at: p.link_revoked_at, joined_at: p.joined_at,
              }))}
              conflicts={conflicts.map((c) => ({ id: c.id, prospect_company: c.prospect_company, partner_id: c.partner_id, status: c.status }))}
              audit={audit}
              query={q}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
