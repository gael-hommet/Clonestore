import { redirect } from "next/navigation";

// Clara est retirée de la surface publique (non validée comme produit ouvert).
// Redirection propre vers la boutique pour toute URL éventuellement indexée.
export default function ClaraRedirect() {
  redirect("/agents");
}
