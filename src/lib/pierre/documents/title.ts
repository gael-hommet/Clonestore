import type { PierreDocumentType } from "@/lib/pierre/documents/doc-type";

export function buildPierreDocumentTitle(input: {
  docType: PierreDocumentType;
  companyName?: string | null;
}) {
  const date = new Date().toISOString().slice(0, 10);

  const base =
    input.docType === "convocation"
      ? "Convocation RH"
      : input.docType === "refus"
      ? "Courrier de refus"
      : input.docType === "onboarding"
      ? "Document d’onboarding"
      : input.docType === "offre_emploi"
      ? "Offre d’emploi"
      : input.docType === "fiche_poste"
      ? "Fiche de poste"
      : input.docType === "procedure"
      ? "Procédure RH"
      : input.docType === "compte_rendu"
      ? "Compte rendu RH"
      : input.docType === "note_rh"
      ? "Note RH"
      : input.docType === "courrier"
      ? "Courrier RH"
      : "Document RH";

  return input.companyName
    ? `${base} — ${input.companyName} — ${date}`
    : `${base} — ${date}`;
}