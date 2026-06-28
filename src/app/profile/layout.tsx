import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import AccessLockScreen from "@/components/site/AccessLockScreen";
import {
  buildGeneralCockpitLock,
  resolveOperationalAccess,
} from "@/lib/access/operational-access";

export const dynamic = "force-dynamic";

// Cockpit général « Mon CloneStore » : app shell unifié (sidebar + drawer) + VERROU
// SERVEUR. Le cockpit ne s'ouvre QUE pour un compte possédant au moins un employé IA
// réellement payé et actif (machine à états centralisée, décidée côté serveur — jamais
// un booléen client). Réservation, paiement en attente, activation en attente,
// suspension ou résiliation restent verrouillés.
//
//   employee_active            → cockpit complet
//   connecté sans employé actif → écran verrouillé premium (CTA vers achat/activation,
//                                  jamais un renvoi en boucle vers /profile)
//   non connecté               → laissé au garde d'auth client de la page, qui redirige
//                                  vers /login?redirect=/profile (aucune donnée rendue)
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const access = await resolveOperationalAccess("general");

  if (access.state === "anonymous") {
    return <AppShell>{children}</AppShell>;
  }

  const lock = buildGeneralCockpitLock(access.state);
  return (
    <AppShell>
      {lock ? (
        <AccessLockScreen {...lock} icon={<LayoutDashboard className="h-6 w-6" />} />
      ) : (
        children
      )}
    </AppShell>
  );
}
