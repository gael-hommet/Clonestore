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
      readyTitle="Confirme ton inscription à CloneStory"
      readyBody={`En continuant, ${peek.emailMasked ?? "ton adresse"} sera vérifiée et tu seras automatiquement connecté à ton espace CloneStore, directement sur ton registre.`}
      actionLabel="Confirmer et accéder à mon espace"
      usedTitle="Ton adresse est déjà confirmée."
      usedBody="Ton registre est déjà ouvert. Retrouve-le depuis ton espace CloneStore."
      expiredBody="Ce lien de confirmation a expiré. Vous pouvez demander un nouveau lien depuis la page d'inscription."
      invalidBody="Ce lien de confirmation n'est pas valide. Vous pouvez demander un nouveau lien depuis la page d'inscription."
    />
  );
}
