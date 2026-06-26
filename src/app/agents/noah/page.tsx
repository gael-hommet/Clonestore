import { redirect } from "next/navigation";

// Noah est retiré de la surface publique (non validé comme produit ouvert).
// Redirection propre vers la boutique pour toute URL éventuellement indexée.
export default function NoahRedirect() {
  redirect("/agents");
}
