import { redirect } from "next/navigation";

// Alex est retiré de la surface publique (non validé comme produit ouvert).
// Redirection propre vers la boutique pour toute URL éventuellement indexée.
export default function AlexRedirect() {
  redirect("/agents");
}
