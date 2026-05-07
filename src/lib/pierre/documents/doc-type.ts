import { containsAny } from "@/lib/pierre/utils";

export type PierreDocumentType =
  | "convocation"
  | "refus"
  | "onboarding"
  | "offre_emploi"
  | "fiche_poste"
  | "procedure"
  | "compte_rendu"
  | "note_rh"
  | "courrier"
  | "generic";

export function detectPierreDocumentType(input: string): PierreDocumentType {
  if (containsAny(input, ["convocation"])) return "convocation";
  if (containsAny(input, ["refus"])) return "refus";
  if (containsAny(input, ["onboarding", "intégration", "integration"])) return "onboarding";
  if (containsAny(input, ["offre d'emploi", "offre d’emploi"])) return "offre_emploi";
  if (containsAny(input, ["fiche de poste"])) return "fiche_poste";
  if (containsAny(input, ["procédure", "procedure"])) return "procedure";
  if (containsAny(input, ["compte rendu", "compte-rendu"])) return "compte_rendu";
  if (containsAny(input, ["note rh", "synthèse", "synthese"])) return "note_rh";
  if (containsAny(input, ["courrier"])) return "courrier";

  return "generic";
}