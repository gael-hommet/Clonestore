// BLOC 3 — Layout serveur pour /demo/pierre.
//
// Le composant page principal reste un Client Component intact (test
// `pierre-demo-golive05` lit son source). On ajoute ici un en-tête variantal
// SERVEUR qui lit la conversion session (cookie signé) et affiche la bonne
// version du hero AU-DESSUS du démo client existant. Les visiteurs organiques
// ne voient ni hero variantal, ni mention d'attribution.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  readConversionSessionId,
} from "@/lib/clonestore/conversion/session";
import { getConversionSession } from "@/lib/clonestore/conversion/storage";
import { VariantHero } from "./_variant/VariantHero";

export const metadata: Metadata = {
  title: "Démo Pierre — CloneStore",
  description: "Démonstration du poste RH opérationnel Pierre — données entièrement fictives.",
  robots: { index: true, follow: true },
};

export default async function DemoPierreLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const sessionId = readConversionSessionId(cookieHeader);
  const session = sessionId ? getConversionSession(sessionId) : null;

  // Visiteur organique → pas de bandeau variantal. La page client garde son
  // hero original. Cela évite tout "flash de mauvaise variante".
  const variant = session?.variant ?? "VARIANT_ORGANIC";

  return (
    <>
      {variant !== "VARIANT_ORGANIC" && (
        <VariantHero variant={variant} />
      )}
      {children}
    </>
  );
}
