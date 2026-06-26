import { redirect } from "next/navigation";

// Emma figure dans la boutique comme employé IA à venir (carte courte, sans
// fiche produit complète). L'ancienne fiche est retirée : redirection propre.
export default function EmmaRedirect() {
  redirect("/agents");
}
