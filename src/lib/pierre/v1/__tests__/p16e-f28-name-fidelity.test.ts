// src/lib/pierre/v1/__tests__/p16e-f28-name-fidelity.test.ts
// P16E §5 (F28) — un nom de personne valide n'est jamais corrompu en « ? ».
//
// DÉFAUT CORRIGÉ — le rendu PDF (police Helvetica / WinAnsi, Latin-1 uniquement) remplaçait tout
// caractère hors Latin-1 par « ? » : « Łukasz » -> « ?ukasz », « Dvořák » -> « Dvo?ák ».
// Correctif : on TRANSLITÈRE les caractères hors Latin-1 vers leur forme latine lisible tout en
// PRÉSERVANT les caractères déjà Latin-1 (é, ç, ø…). Le DOCX (OOXML Unicode) reste fidèle à
// TOUT nom, y compris les scripts non latins (CJK), qui ne peuvent pas être tracés par la police
// WinAnsi du PDF.

import { describe, it, expect } from "vitest";
import { getRenderer } from "@/lib/pierre/v1/renderers";

function pdfText(name: string): string {
  const out = getRenderer("pdf").render({ title: "Contrat", blocks: [{ lines: [`Salarié : ${name}`] }] });
  // Le texte PDF est encodé en Latin-1 dans les flux ; on lit les octets en latin1.
  return out.bytes.toString("latin1");
}
function docxText(name: string): string {
  const out = getRenderer("docx").render({ title: "Contrat", blocks: [{ lines: [`Salarié : ${name}`] }] });
  // Le DOCX est un ZIP ; le document.xml est stocké (STORE) donc lisible en utf8 dans les octets.
  return out.bytes.toString("utf8");
}

describe("P16E §5 F28 — fidélité PDF (transliteration lisible, jamais « ? » sur un nom latin)", () => {
  it.each([
    ["Zoé", "Zoé"],           // Latin-1 : préservé
    ["François", "François"], // ç préservé
    ["Søren", "Søren"],       // ø (Latin-1) préservé
    ["Łukasz", "Lukasz"],     // translittéré
    ["İpek", "Ipek"],
    ["Nguyễn", "Nguyen"],
  ])("« %s » rend « %s » (jamais de glyphe cassé)", (input, expected) => {
    const text = pdfText(input);
    expect(text).toContain(expected);
    // Le nom n'introduit aucun « ? » parasite (le corps du template n'en contient pas).
    expect(text).not.toContain("?ukasz");
    expect(text).not.toContain("Dvo?");
  });

  it("Dvořák -> Dvorák dans le PDF (ř translittéré, á conservé)", () => {
    expect(pdfText("Dvořák")).toContain("Dvorák");
  });

  it("un nom CJK (李) ne peut pas être tracé par la police WinAnsi — mais le PDF ne prétend rien de plus", () => {
    // Limitation documentée : la voie fidèle est le DOCX. Le PDF le remplace faute de glyphe.
    const text = pdfText("李");
    expect(text).toMatch(/Salari.* : \?/);
  });
});

describe("P16E §5 F28 — le DOCX est la voie FIDÈLE pour tout nom (Unicode exact)", () => {
  it.each(["Zoé", "François", "Łukasz", "İpek", "Dvořák", "Nguyễn", "李", "Søren"])(
    "« %s » est préservé EXACTEMENT dans le DOCX",
    (name) => {
      expect(docxText(name)).toContain(name);
    },
  );
});
