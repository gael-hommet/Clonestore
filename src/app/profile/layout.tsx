import type { ReactNode } from "react";
import AppShell from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

// My CloneStore — espace client (P9.2, correction de la frontière d'auth).
//
// My CloneStore exige UNIQUEMENT une session authentifiée — PAS un employé actif,
// PAS un order actif, PAS un entitlement Pierre. Un client authentifié sans employé
// doit pouvoir accéder à son espace : accueil, onboarding/empreinte, employés, compte.
// L'authentification est appliquée par le garde CLIENT de chaque page connectée
// (`useRequireAuth` → redirection sanitizée vers /login?redirect=…). Les COCKPITS
// opérationnels (/agents/pierre/use, /profile/messages) conservent leur propre verrou
// serveur (OperationalRouteShell / layout messagerie), inchangé par P9.2.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
