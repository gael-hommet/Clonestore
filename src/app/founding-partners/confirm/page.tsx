// CloneStory — confirmation d'introduction par le prospect : page INTERMÉDIAIRE (GET non
// destructif). La confirmation réelle n'a lieu que sur clic humain (POST .../confirm).

import type { Metadata } from "next";
import { peekIntroductionAction } from "@/lib/clonestory/founding-partners/server/store";
import EmailActionInterstitial from "../_ui/EmailActionInterstitial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmer une introduction — Le Cercle des Partenaires Fondateurs",
  robots: { index: false, follow: false },
};

export default async function ConfirmInterstitialPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = token ?? "";
  const peek = await peekIntroductionAction(t, "introconfirm");
  const who = peek.memberName ? <><span className="csy-name">{peek.memberName}</span></> : "un Membre du Cercle";
  return (
    <EmailActionInterstitial
      state={peek.state}
      token={t}
      postAction="/api/founding-partners/confirm"
      eyebrow="Le Cercle des Partenaires Fondateurs"
      readyTitle="Confirmez-vous cette introduction ?"
      readyBody={<>Confirmez-vous avoir découvert CloneStore grâce à {who} ? Aucune contribution n'est enregistrée sans votre confirmation.</>}
      actionLabel="Oui, je confirme"
      usedTitle="Cette introduction est déjà traitée."
      usedBody="Votre réponse a déjà été prise en compte. Merci."
      expiredBody="Ce lien de confirmation a expiré. Vous pouvez ignorer ce message sans conséquence."
      invalidBody="Ce lien de confirmation n'est pas valide. Vous pouvez ignorer ce message sans conséquence."
    />
  );
}
