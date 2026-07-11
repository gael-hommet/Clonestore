// Cabinets Fondateurs CloneStore — landing publique /partenaires (page serveur).
// Délègue tout l'interactif au composant client PartenairesLanding.
// Page publique indexable ; SEO canonique /partenaires.

import type { Metadata } from "next";
import PartenairesLanding from "@/components/partenaires/PartenairesLanding";

export const metadata: Metadata = {
  title: "Cabinets Fondateurs CloneStore — Ajoutez un employé IA RH à votre offre",
  description:
    "Présentez à CloneStore les entreprises qui ont besoin d'un employé IA RH. Nous assurons la démonstration, la vente, le déploiement et le support. Vous recevez 20 % de commission récurrente, calculée sur le HT réellement encaissé.",
  alternates: { canonical: "/partenaires" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Cabinets Fondateurs CloneStore",
    description:
      "Ajoutez un employé IA RH à l'offre de votre cabinet. 20 % de commission récurrente.",
    type: "website",
  },
};

export default function PartenairesPage() {
  return <PartenairesLanding />;
}
