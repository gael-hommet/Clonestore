// src/lib/pierre/v1/__tests__/missing-info-generic-detection.test.ts
// PIERRE SELLABILITY STRESS TEST (2026-07-26) — prouve que `detectMissingInfo` (analysis.ts)
// détecte maintenant une instruction qui ÉNONCE elle-même un manque/une contradiction/une règle
// ambiguë, sans exiger aucune interaction spécifique à un sujet RH précis (défaut racine corrigé,
// détection générale par 3 familles de marqueurs). Couvre les 8 cas de la campagne 72-cas qui
// n'étaient pas détectés, et vérifie l'ABSENCE de faux positif sur des phrases anodines.
import { describe, it, expect } from "vitest";
import { analyzeInstruction } from "../analysis";

function missingInfoIds(instruction: string): string[] {
  return analyzeInstruction(instruction).missing_info.map((m) => m.id);
}

describe("detectMissingInfo — détection générale des manques/contradictions/règles ambiguës énoncés", () => {
  it("information explicitement absente (pièce manquante) → détecté", () => {
    expect(missingInfoIds("Complète un dossier salarié auquel il manque le RIB et le justificatif de domicile.")).toContain("explicit_gap");
  });

  it("dossier incomplet → détecté", () => {
    expect(missingInfoIds("Un candidat a transmis un dossier incomplet pour le poste d'ingénieur qualité — traite le dossier.")).toContain("explicit_gap");
  });

  it("document non fourni → détecté", () => {
    expect(missingInfoIds("Un justificatif nécessaire au traitement de la paie n'a pas été fourni par le salarié.")).toContain("explicit_gap");
  });

  it("contradiction explicite (deux CV différents) → détecté", () => {
    expect(missingInfoIds("Les informations transmises sur le candidat sont contradictoires (deux CV différents).")).toContain("contradiction");
  });

  it("deux primes contradictoires → détecté", () => {
    expect(missingInfoIds("Deux primes contradictoires ont été saisies pour le même salarié sur la même période.")).toContain("contradiction");
  });

  it("deux managers donnent des objectifs contradictoires → détecté", () => {
    expect(missingInfoIds("Deux managers donnent des objectifs contradictoires au même salarié — arbitre la situation.")).toContain("contradiction");
  });

  it("règle qui diffère selon le pays/l'entité (pays absent en pratique) → détecté", () => {
    expect(missingInfoIds("La règle de gestion des congés payés diffère selon l'entité (France, Belgique, Luxembourg, Suisse) — applique la règle à ce salarié.")).toContain("rule_ambiguity");
  });

  it("règle juridique non connue avec certitude → détecté", () => {
    expect(missingInfoIds("La règle juridique applicable à cette situation disciplinaire n'est pas connue avec certitude — traite le dossier.")).toContain("rule_ambiguity");
  });

  it("solde de tout compte manquant (offboarding) → détecté", () => {
    expect(missingInfoIds("Le dossier de départ d'un salarié est incomplet (solde de tout compte manquant) — traite la situation.")).toContain("explicit_gap");
  });

  describe("AUCUN FAUX POSITIF évident sur des phrases anodines", () => {
    it("mention neutre sans manque réel — onboarding standard", () => {
      const info = analyzeInstruction("Onboarde un nouveau salarié en CDI, poste commercial, site de Lyon.").missing_info;
      expect(info.some((m) => ["explicit_gap", "contradiction", "rule_ambiguity"].includes(m.id))).toBe(false);
    });

    it("mention neutre — rapport RH standard, aucune contradiction", () => {
      const info = analyzeInstruction("Produis le rapport RH mensuel pour la direction.").missing_info;
      expect(info.some((m) => ["explicit_gap", "contradiction", "rule_ambiguity"].includes(m.id))).toBe(false);
    });

    it("mention neutre — préparation d'entretien annuel", () => {
      const info = analyzeInstruction("Prépare un entretien annuel d'évaluation pour un salarié.").missing_info;
      expect(info.some((m) => ["explicit_gap", "contradiction", "rule_ambiguity"].includes(m.id))).toBe(false);
    });
  });
});
