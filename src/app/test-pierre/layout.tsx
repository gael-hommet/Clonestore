import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// Page de test/diagnostic développeur (expose l'API brute). Elle ne doit JAMAIS
// être atteignable par un prospect en production : 404 en prod, accessible
// uniquement en développement. Noindex dans tous les cas.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function TestPierreLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
