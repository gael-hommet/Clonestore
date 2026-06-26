import type { ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import AccessLockScreen from "@/components/site/AccessLockScreen";
import {
  buildOperationalLock,
  resolveOperationalAccess,
} from "@/lib/access/operational-access";

export const dynamic = "force-dynamic";

// Garde SERVEUR de la messagerie (espace opérationnel). Selon l'état d'accès
// centralisé, on rend soit la page (employé actif), soit un écran premium adapté
// (sans employé / paiement en cours / activation en cours / suspendu / terminé).
// Un visiteur non connecté est laissé au garde d'auth client de la page.

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const access = await resolveOperationalAccess();

  if (access.state === "anonymous") {
    return <>{children}</>;
  }

  const lock = buildOperationalLock(access.state, "messagerie");
  if (lock) {
    return <AccessLockScreen {...lock} icon={<MessagesSquare className="h-6 w-6" />} />;
  }

  return <>{children}</>;
}
