// C1.9 — DIAGNOSTIC DE COUVERTURE DE LA CONNAISSANCE (§4–§5).
//
// Le grounding est le premier moteur d'échec en campagne : le modèle affirme des faits
// produit VRAIS que le contexte ne lui fournit pas. Avant d'ajouter quoi que ce soit, il
// faut savoir laquelle des deux causes est la bonne :
//   (a) la connaissance N'EXISTE PAS dans le corpus candidat ;
//   (b) elle existe mais la récupération ne la SÉLECTIONNE pas.
// Ce fichier mesure les deux, sans rien corriger.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { collectCandidateChunks } from "../../c1-1/parrain-source-adapters";
import { retrieveSemantic } from "../semantic-retrieval";
import type { ParrainViewerContext } from "../../c1-1/parrain-types";

const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";
const PUBLIC: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };

/** Les formulations imposées au §5, plus celles que la campagne a fait échouer. */
const PROBES: Array<{ q: string; needs: string[]; expect: string }> = [
  { q: "Pierre fait quoi ?", needs: ["rôle de Pierre", "capacités de Pierre"], expect: "rôle + capacités" },
  { q: "Il prépare les contrats ?", needs: ["préparation de contrat"], expect: "préparation documentaire" },
  { q: "Il les signe ?", needs: ["signature électronique", "signature automatique"], expect: "signature NON active" },
  { q: "Il envoie les mails ?", needs: ["envoi d'e-mail automatique"], expect: "envoi NON actif" },
  { q: "Vous êtes disponibles en Suisse ?", needs: ["pays couverts", "Suisse"], expect: "CH couvert + CHF" },
  { q: "On est en Belgique", needs: ["pays couverts", "Belgique"], expect: "BE couvert + EUR" },
  { q: "Et en Espagne ?", needs: ["pays couverts", "Espagne"], expect: "ES non couvert" },
  { q: "Combien en CHF ?", needs: ["tarif Suisse", "prix en CHF"], expect: "499 CHF" },
  { q: "Vous apprenez nos habitudes ?", needs: ["apprentissage", "données d'entraînement"], expect: "usage des données" },
  { q: "Mes données sont isolées ?", needs: ["isolation des données", "cloisonnement tenant"], expect: "isolation" },
  { q: "Supprime le dossier", needs: ["suppression", "validation humaine"], expect: "action interdite sans validation" },
  { q: "Compare avec un autre client", needs: ["comparaison inter-clients", "isolation"], expect: "impossible" },
  { q: "J'ai été débité deux fois", needs: ["incident de facturation", "support"], expect: "support, aucune offre" },
  { q: "Il sait faire un solde de tout compte ?", needs: ["solde de tout compte", "capacités RH"], expect: "capacité RH" },
  { q: "Pourquoi pas juste ChatGPT ?", needs: ["différence avec un assistant générique"], expect: "positionnement" },
  { q: "Qu'est-ce qui garantit qu'il ne raconte pas n'importe quoi ?", needs: ["garde-fous", "validation humaine"], expect: "garde-fous" },
];

describe("C1.9 grounding diagnostic — what the retrieval actually returns", () => {
  it("measures coverage per probe and writes the diagnostic", () => {
    const rows = PROBES.map((p) => {
      const candidates = collectCandidateChunks({ question: p.q });
      const r = retrieveSemantic(candidates, PUBLIC, {
        knowledgeNeeds: p.needs,
        contextTerms: [],
        rawMessage: p.q,
      });
      return {
        question: p.q,
        expected: p.expect,
        candidates: candidates.length,
        sufficiency: r.sufficiency,
        selected: r.selected.length,
        chars: r.totalChars,
        unmatchedNeeds: r.unmatchedNeeds,
        selectedIds: r.selected.map((s) => s.chunk.id),
        // Extrait court pour juger À L'ŒIL si le fait attendu est réellement présent.
        preview: r.selected.slice(0, 3).map((s) => `${s.chunk.id}: ${s.chunk.text.slice(0, 150)}`),
      };
    });

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/C1_9_GROUNDING_DIAGNOSTIC.json`, JSON.stringify({
      artifact: "C1_9_GROUNDING_DIAGNOSTIC", generatedAt: "2026-07-22",
      purpose: "Distinguer « la connaissance manque » de « la récupération ne la trouve pas ».",
      summary: {
        probes: rows.length,
        none: rows.filter((r) => r.sufficiency === "none").length,
        weak: rows.filter((r) => r.sufficiency === "weak").length,
        strong: rows.filter((r) => r.sufficiency === "strong").length,
        withUnmatchedNeeds: rows.filter((r) => r.unmatchedNeeds.length > 0).length,
      },
      rows,
    }, null, 2));

    for (const r of rows) {
      console.log(`${r.sufficiency.padEnd(6)} sel=${String(r.selected).padStart(2)} unmatched=${r.unmatchedNeeds.length} | ${r.question}`);
    }
    expect(rows.length).toBe(PROBES.length);
  });
});
