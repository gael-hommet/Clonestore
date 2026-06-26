import type { ReactNode } from "react";
import AppShell from "@/components/app/AppShell";

// App shell unifié de l'espace connecté : une seule sidebar gauche permanente sur
// desktop (sticky, hauteur viewport, scroll interne) et un vrai drawer sur
// mobile/tablette. Remplace l'ancienne barre de pills empilée.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
