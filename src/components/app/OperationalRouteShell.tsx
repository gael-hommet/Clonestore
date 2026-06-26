import type { ReactNode } from "react";
import AppShell from "@/components/app/AppShell";
import AccessLockScreen from "@/components/site/AccessLockScreen";
import {
  buildOperationalLock,
  resolveOperationalAccess,
} from "@/lib/access/operational-access";

// Layout serveur réutilisable pour les routes opérationnelles HORS /profile
// (cockpit Pierre, Employé 360, configuration). Garantit la MÊME sidebar / le
// MÊME drawer que /profile (app shell unifié), et applique éventuellement le
// verrou opérationnel selon la machine à états.
//
//   gate="cockpit" | "messagerie" → verrou si l'employé n'est pas actif
//   gate omis                      → shell seul (route accessible aux connectés)

export default async function OperationalRouteShell({
  children,
  gate,
  icon,
}: {
  children: ReactNode;
  gate?: "cockpit" | "messagerie";
  icon?: ReactNode;
}) {
  if (!gate) {
    return <AppShell>{children}</AppShell>;
  }

  const access = await resolveOperationalAccess();

  // Non connecté : on laisse le garde d'auth client de la page rediriger.
  if (access.state === "anonymous") {
    return <AppShell>{children}</AppShell>;
  }

  const lock = buildOperationalLock(access.state, gate);
  return (
    <AppShell>{lock ? <AccessLockScreen {...lock} icon={icon} /> : children}</AppShell>
  );
}
