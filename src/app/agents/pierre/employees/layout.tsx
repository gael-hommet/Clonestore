import type { ReactNode } from "react";
import { Users } from "lucide-react";
import OperationalRouteShell from "@/components/app/OperationalRouteShell";

export const dynamic = "force-dynamic";

// Employé 360 : espace opérationnel (lecture des salariés) → app shell unifié +
// verrou serveur. Inaccessible sans employé actif.
export default function PierreEmployeesLayout({ children }: { children: ReactNode }) {
  return (
    <OperationalRouteShell gate="cockpit" icon={<Users className="h-6 w-6" />}>
      {children}
    </OperationalRouteShell>
  );
}
