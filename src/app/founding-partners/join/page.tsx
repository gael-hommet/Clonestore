// CloneStory — /founding-partners/join : page d'inscription au Cercle.
// L'inscription ouvre IMMÉDIATEMENT (avant le lancement commercial de Pierre).

import type { Metadata } from "next";
import Link from "next/link";
import JoinForm from "./JoinForm";
import { StoryDisplay, StoryEyebrow, StoryLede } from "@/components/clonestory/primitives";
import { findPartnerByCode, findPartnerByLinkToken } from "@/lib/clonestory/founding-partners/server/store";
import { registrationOpen } from "@/lib/clonestory/founding-partners/server/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rejoindre le Cercle — CloneStory",
  robots: { index: false, follow: false },
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string; code?: string }> }) {
  const sp = await searchParams;
  const open = registrationOpen();
  const refToken = typeof sp.ref === "string" ? sp.ref : null;
  const refCode = typeof sp.code === "string" ? sp.code : null;

  let inviter: string | null = null;
  if (open && refToken) inviter = (await findPartnerByLinkToken(refToken))?.display_name ?? null;
  else if (open && refCode) inviter = (await findPartnerByCode(refCode))?.display_name ?? null;

  return (
    <main className="csy-canvas">
      <section className="csy-section csy-section--hero" style={{ paddingBottom: "clamp(40px,6vh,72px)" }}>
        <div className="csy-shell">
          <div className="csy-frontispiece">
            <span className="csy-frontispiece__mark">CloneStory</span>
            <span className="csy-frontispiece__rule" />
            <StoryEyebrow>Le Cercle des Partenaires Fondateurs</StoryEyebrow>
          </div>
          <div style={{ marginTop: 36 }}>
            <StoryDisplay>{open ? "Demander son entrée dans le Cercle" : "Ouverture imminente du Cercle"}</StoryDisplay>
          </div>
          <div style={{ marginTop: 28, maxWidth: "58ch" }}>
            <StoryLede>
              {open ? (
                <>
                  En entrant, vous devenez <em>Membre du Cercle Fondateur</em>. L'inscription est gratuite et n'accorde
                  ni actions, ni rémunération, ni titre automatique : le titre de Partenaire Fondateur de CloneStore et
                  le numéro de registre sont accordés après une première contribution vérifiée.
                </>
              ) : (
                <>
                  Les inscriptions au Cercle ne sont pas encore ouvertes. Elles le seront très prochainement. En
                  attendant, vous pouvez découvrir la nature du Cercle et la reconnaissance qu'il consacre.
                </>
              )}
            </StoryLede>
          </div>
          {open && inviter ? (
            <p className="csy-copy" style={{ marginTop: 18, color: "var(--csy-metal)" }}>
              Sur l'invitation de <span className="csy-name">{inviter}</span>.
            </p>
          ) : null}
        </div>
      </section>

      <section className="csy-section" style={{ paddingTop: 0 }}>
        <div className="csy-shell">
          {open ? (
            <JoinForm refToken={refToken} refCode={refCode} />
          ) : (
            <div style={{ display: "grid", gap: 22, maxWidth: "60ch" }}>
              <div className="csy-notice">
                Le registre du Cercle n'accepte pas encore de nouvelles entrées. Revenez très prochainement.
              </div>
              <div>
                <Link href="/founding-partners/conditions" className="csy-link">
                  Découvrir le Cercle
                  <span className="csy-link__arrow" aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
