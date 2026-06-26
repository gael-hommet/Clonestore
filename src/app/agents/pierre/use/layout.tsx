import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import OperationalRouteShell from "@/components/app/OperationalRouteShell";

export const dynamic = "force-dynamic";

// Cockpit Pierre : app shell unifié (sidebar + drawer, même que /profile) +
// verrou serveur (machine à états). « sans employé » → écran verrouillé ;
// « paiement / activation en cours » → écran dédié (jamais un faux cockpit) ;
// « employé actif » → cockpit complet.
export default function PierreCockpitLayout({ children }: { children: ReactNode }) {
  return (
    <OperationalRouteShell gate="cockpit" icon={<LayoutDashboard className="h-6 w-6" />}>
      {children}
    </OperationalRouteShell>
  );
}
