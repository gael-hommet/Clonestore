import type { Metadata } from "next";
import { InstallerClient } from "./InstallerClient";

export const metadata: Metadata = {
  title: "Installer CloneStore",
  description:
    "Installez CloneStore sur votre téléphone ou votre ordinateur pour retrouver Pierre et votre cockpit en un geste.",
};

/**
 * Surface publique « Installer CloneStore ». Aucune donnée sensible, aucune auth requise :
 * c'est un guide d'installation. Les liens vers le cockpit restent protégés côté serveur.
 */
export default function InstallerPage() {
  return <InstallerClient />;
}
