// src/app/partenaires/espace/page.tsx
// Point d'entrée de l'espace Cabinet Fondateur. La session est déjà garantie par le layout ;
// toutes les données sensibles (soldes, commissions, prospects) sont chargées CÔTÉ CLIENT depuis
// /api/partners/me (isolation RLS garantie par l'API — l'UI n'affiche que ce que l'API renvoie).

import type { Metadata } from "next";
import { PartnerSpace } from "./PartnerSpace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Espace Cabinet Fondateur — CloneStore",
  robots: { index: false, follow: false },
};

export default function PartnerSpacePage() {
  return <PartnerSpace />;
}
