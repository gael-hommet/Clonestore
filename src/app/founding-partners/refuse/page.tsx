// CloneStory — refus d'introduction par le prospect : page INTERMÉDIAIRE (GET non
// destructif). Le refus réel (annulation + purge PII) n'a lieu que sur clic humain (POST).

import type { Metadata } from "next";
import { peekIntroductionAction } from "@/lib/clonestory/founding-partners/server/store";
import EmailActionInterstitial from "../_ui/EmailActionInterstitial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ne pas confirmer une introduction — Le Cercle des Partenaires Fondateurs",
  robots: { index: false, follow: false },
};

export default async function RefuseInterstitialPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = token ?? "";
  const peek = await peekIntroductionAction(t, "introrefuse");
  return (
    <EmailActionInterstitial
      state={peek.state}
      token={t}
      postAction="/api/founding-partners/refuse"
      eyebrow="Le Cercle des Partenaires Fondateurs"
      readyTitle="Vous ne confirmez pas cette introduction"
      readyBody="Si vous ne reconnaissez pas cette mise en relation, vous pouvez la refuser. Aucune contribution ne sera enregistrée et vos données de contact seront effacées."
      actionLabel="Je ne confirme pas, effacer mes données"
      usedTitle="Cette introduction est déjà traitée."
      usedBody="Votre réponse a déjà été prise en compte. Merci."
      expiredBody="Ce lien a expiré. Vous pouvez ignorer ce message sans conséquence."
      invalidBody="Ce lien n'est pas valide. Vous pouvez ignorer ce message sans conséquence."
    />
  );
}
