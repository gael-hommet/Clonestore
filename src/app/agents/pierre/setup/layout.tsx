import type { ReactNode } from "react";
import OperationalRouteShell from "@/components/app/OperationalRouteShell";

export const dynamic = "force-dynamic";

// Configuration Pierre : app shell unifié (même sidebar/drawer). Pas de verrou
// opérationnel dur — la configuration (Empreinte, réglages) peut précéder
// l'activation ; le garde d'auth client protège l'accès non connecté.
export default function PierreSetupLayout({ children }: { children: ReactNode }) {
  return <OperationalRouteShell>{children}</OperationalRouteShell>;
}
