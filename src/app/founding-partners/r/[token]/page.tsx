// CloneStory — page d'atterrissage institutionnelle d'un lien personnel.
// Aucune donnée personnelle dans l'URL (jeton opaque). Rattache l'origine de
// branche via le paramètre `ref` porté jusqu'au formulaire d'inscription.

import type { Metadata } from "next";
import Link from "next/link";
import { StoryDisplay, StoryEyebrow, StoryLede } from "@/components/clonestory/primitives";
import { DoctrineNote } from "@/components/clonestory/primitives";
import AttributionBeacon from "@/components/clonestory/AttributionBeacon";
import { findPartnerByCode, findPartnerByLinkToken, recordLinkUsage } from "@/lib/clonestory/founding-partners/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Le Cercle des Partenaires Fondateurs — CloneStory", robots: { index: false, follow: false } };

export default async function LinkLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Lien stable par CODE (`/r/<code>`) ; repli sur d'anciens liens `fp_…` partagés.
  const partner = (await findPartnerByCode(token)) ?? (await findPartnerByLinkToken(token));

  if (!partner) {
    return (
      <main className="csy-canvas">
        <section className="csy-section csy-section--hero">
          <div className="csy-shell csy-shell--narrow">
            <StoryEyebrow>Le Cercle des Partenaires Fondateurs</StoryEyebrow>
            <div style={{ marginTop: 22 }}><StoryDisplay>Ce lien n'est plus valide.</StoryDisplay></div>
            <p className="csy-copy" style={{ marginTop: 22 }}>
              Ce lien personnel a expiré ou a été révoqué. Vous pouvez néanmoins découvrir CloneStore et le Cercle.
            </p>
            <div style={{ marginTop: 28 }}>
              <Link href="/founding-partners" className="csy-link">Découvrir le Cercle <span className="csy-link__arrow" aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Journal d'usage (sans PII). Best-effort.
  try {
    await recordLinkUsage(partner.id, "link", "landed", null);
  } catch {
    /* best-effort */
  }

  return (
    <main className="csy-canvas">
      <AttributionBeacon code={token} />
      <section className="csy-section csy-section--hero">
        <div className="csy-shell csy-shell--narrow">
          <StoryEyebrow>Le Cercle des Partenaires Fondateurs</StoryEyebrow>
          <div style={{ marginTop: 24 }}>
            <StoryDisplay>
              <span className="csy-name">{partner.display_name}</span> vous présente <em>CloneStore</em>.
            </StoryDisplay>
          </div>
          <div style={{ marginTop: 26 }}>
            <StoryLede>
              CloneStore construit le futur du travail. CloneStory en conserve la mémoire — et le nom des personnes
              ayant contribué, de manière vérifiée, à son commencement.
            </StoryLede>
          </div>
          <div style={{ marginTop: 30 }}>
            <Link href={`/founding-partners/join?ref=${encodeURIComponent(token)}`} className="csy-button">
              Rejoindre le Cercle
            </Link>
          </div>
        </div>
      </section>

      <section className="csy-section" style={{ paddingTop: 0 }}>
        <div className="csy-shell csy-shell--narrow">
          <DoctrineNote />
        </div>
      </section>
    </main>
  );
}
