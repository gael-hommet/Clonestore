// Cabinets Fondateurs CloneStore — landing publique /partenaires (page serveur).
// Délègue tout l'interactif au composant client PartenairesLanding.
// Page publique indexable ; SEO canonique /partenaires.

import type { Metadata } from "next";
import PartenairesLanding from "@/components/partenaires/PartenairesLanding";

export const metadata: Metadata = {
  title: "Cabinets Fondateurs CloneStore — Proposez à vos clients une équipe RH IA complète",
  description:
    "Pierre prend en charge l'opérationnel RH de bout en bout : il peut devenir l'équipe RH IA principale d'une entreprise, le cœur d'une organisation hybride ou la force qui démultiplie un service RH existant. Vous réalisez la mise en relation ; CloneStore démontre, vend, déploie et accompagne. Vous percevez 20 % de commission récurrente sur le HT réellement encaissé.",
  alternates: { canonical: "/partenaires" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Cabinets Fondateurs CloneStore",
    description:
      "Proposez à vos clients une équipe RH IA complète. 20 % de commission récurrente sur le HT réellement encaissé.",
    type: "website",
  },
};

export default function PartenairesPage() {
  return <PartenairesLanding />;
}
