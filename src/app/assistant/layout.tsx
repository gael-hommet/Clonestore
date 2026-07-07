import type { ReactNode } from "react";
import { MessageSquareMore } from "lucide-react";
import AccessLockScreen from "@/components/site/AccessLockScreen";
import { isCloneChatEnabled } from "@/lib/features/product-availability";

// Le drapeau `CLONECHAT_ENABLED` est un flag d'environnement de RUNTIME : ce layout doit être
// rendu à la demande (jamais figé au build), sinon l'état du drapeau serait gelé au moment du
// build et la « réactivation par une seule variable d'env » documentée serait sans effet.
export const dynamic = "force-dynamic";

// Blocage RÉEL de CloneChat côté serveur.
//
// La PAGE CloneChat (src/app/assistant/page.tsx) reste strictement intacte —
// design, textes, animations, composants inchangés. Tant que le produit est
// désactivé (CLONECHAT_ENABLED ≠ true), ce layout serveur ne monte JAMAIS la
// page : il rend un écran « bientôt disponible » premium à la place. La page
// ne peut donc pas être atteinte par URL directe, et son code source est
// préservé pour une réactivation ultérieure par une seule variable d'env.

export default function AssistantLayout({ children }: { children: ReactNode }) {
  if (!isCloneChatEnabled()) {
    return (
      <AccessLockScreen
        eyebrow="CloneChat"
        title="CloneChat arrive bientôt."
        description="CloneChat, l'assistant de compréhension et d'orientation CloneStore, est en cours de finalisation. En attendant, Pierre — votre employé IA RH opérationnel — est déjà disponible, et la démonstration vous montre tout en quelques minutes."
        bullets={[
          "Pierre est déjà opérationnel sur le travail RH.",
          "La démonstration illustre une mission complète.",
          "Le support écrit reste disponible à tout moment.",
        ]}
        actions={[
          { label: "Voir la démo Pierre", href: "/demo/pierre", primary: true },
          { label: "Découvrir Pierre", href: "/agents/pierre" },
          { label: "Support", href: "/questions" },
        ]}
        icon={<MessageSquareMore className="h-6 w-6" />}
        dataTourId="clonechat-entry"
      />
    );
  }

  return <>{children}</>;
}
