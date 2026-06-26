// CloneStory — vérification email partenaire : page INTERMÉDIAIRE (GET non destructif).
// La vérification réelle n'a lieu que sur clic humain (POST /api/founding-partners/verify).

import type { Metadata } from "next";
import { peekVerification } from "@/lib/clonestory/founding-partners/server/store";
import EmailActionInterstitial from "../_ui/EmailActionInterstitial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmer mon adresse — Le Cercle des Partenaires Fondateurs",
  robots: { index: false, follow: false },
};

export default async function VerifyInterstitialPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = token ?? "";
  const peek = await peekVerification(t);
  return (
    <EmailActionInterstitial
      state={peek.state}
      token={t}
      postAction="/api/founding-partners/verify"
      eyebrow="Le Cercle des Partenaires Fondateurs"
      readyTitle="Confirmez votre adresse"
      readyBody={`Confirmez ${peek.emailMasked ?? "votre adresse"} pour ouvrir votre registre personnel et entrer dans le Cercle.`}
      actionLabel="Confirmer mon adresse"
      usedTitle="Votre adresse est déjà confirmée."
      usedBody="Votre registre est déjà ouvert. Retrouvez-le depuis votre espace CloneStore."
      expiredBody="Ce lien de confirmation a expiré. Vous pouvez demander un nouveau lien depuis la page d'inscription."
      invalidBody="Ce lien de confirmation n'est pas valide. Vous pouvez demander un nouveau lien depuis la page d'inscription."
    />
  );
}
