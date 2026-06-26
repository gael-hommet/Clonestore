import { redirect } from "next/navigation";

// Les employés à venir n'ont pas de fiche produit complète (produit inexistant
// = pas de fausse fiche). Pierre dispose de sa propre page dédiée
// (/agents/pierre), qui a la priorité sur cette route dynamique. Toute autre
// URL d'employé — y compris les anciennes fiches retirées (Clara, Alex, Noah…)
// éventuellement indexées ou partagées — redirige proprement vers la boutique.

export default async function AgentDetailRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params;
  redirect("/agents");
}
