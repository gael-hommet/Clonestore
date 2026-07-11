import type { ReactNode } from "react";
import { MessageSquareMore } from "lucide-react";
import AccessLockScreen from "@/components/site/AccessLockScreen";
import { isCloneChatEnabled } from "@/lib/features/product-availability";

// Le drapeau `CLONECHAT_ENABLED` est un flag d'environnement de RUNTIME : ce layout doit être
// rendu à la demande (jamais figé au build), sinon l'état du drapeau serait gelé au moment du
// build et la « réactivation par une seule variable d'env » documentée serait sans effet.
export const dynamic = "force-dynamic";

// C1.2 — CloneChat est RÉVÉLÉ.
//
// La surface réelle (src/app/assistant/page.tsx → CloneChatWorkspace) est montée
// PAR DÉFAUT. Ce layout ne conserve qu'un ARRÊT D'URGENCE : si et seulement si
// CloneChat est explicitement coupé (`CLONECHAT_ENABLED=false`), il affiche un état
// « temporairement indisponible » HONNÊTE — jamais l'ancien placeholder de lancement.
// L'API (/api/assistant/chat) applique la MÊME règle canonique (isCloneChatEnabled)
// et reste fail-closed sous arrêt d'urgence. L'authentification, la résolution
// d'entreprise et l'isolation tenant restent gérées par la page + l'API, inchangées.

export default function AssistantLayout({ children }: { children: ReactNode }) {
  if (!isCloneChatEnabled()) {
    // Arrêt d'urgence explicite uniquement (kill switch armé). État honnête,
    // temporaire, jamais le placeholder de lancement obsolète.
    return (
      <AccessLockScreen
        eyebrow="CloneChat"
        title="CloneChat est temporairement indisponible."
        description="CloneChat est momentanément suspendu pour maintenance. Pierre — votre employé IA RH opérationnel — reste disponible, et le support écrit répond à tout moment. Vos conversations et vos données sont préservées."
        bullets={[
          "Pierre reste opérationnel sur le travail RH.",
          "Vos conversations et vos données sont préservées.",
          "Le support écrit reste disponible.",
        ]}
        actions={[
          { label: "Ouvrir le cockpit Pierre", href: "/cockpit/pierre", primary: true },
          { label: "Support", href: "/questions" },
        ]}
        icon={<MessageSquareMore className="h-6 w-6" />}
        dataTourId="clonechat-entry"
      />
    );
  }

  return <>{children}</>;
}
