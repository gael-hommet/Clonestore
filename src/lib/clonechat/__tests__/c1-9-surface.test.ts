// C1.9 — MESURE DE SURFACE (artefact d'audit). Aucun appel réseau, aucun coût.
// Question mesurée : sur un corpus INÉDIT et large, quelle FRACTION des tours
//   (a) atteint réellement le modèle,
//   (b) voit le texte du modèle SURVIVRE jusqu'à l'utilisateur ?
// Un tour où le modèle est appelé puis écrasé par un gabarit est un tour DICTIONNAIRE.
import { describe, it } from "vitest";
import { writeFileSync } from "fs";
import { answerPublicQuestion } from "@/lib/clonechat/intelligence/c1-1/parrain-public-adapter";

type PublicInput = Parameters<typeof answerPublicQuestion>[0];
const MARKER = "__MODEL_WAS_REACHED__";

// 60 formulations inédites, regroupées par famille. Aucune n'apparaît dans le code produit.
const CORPUS: Array<{ family: string; q: string }> = [
  // — achat / réservation (famille suspectée de court-circuiter le modèle) —
  { family: "achat", q: "Bon, je crois que je suis convaincu, on fait comment pour démarrer ?" },
  { family: "achat", q: "Je valide, envoyez-moi ce qu'il faut signer." },
  { family: "achat", q: "Où est-ce que je souscris exactement ?" },
  { family: "achat", q: "Je voudrais finaliser aujourd'hui si possible." },
  { family: "achat", q: "Comment je fais pour prendre Pierre chez nous ?" },
  { family: "achat", q: "Vous acceptez les virements ou seulement la carte ?" },
  // — connexion / compte —
  { family: "connexion", q: "Impossible d'entrer dans mon espace ce matin." },
  { family: "connexion", q: "J'ai paumé mon mot de passe, je fais quoi ?" },
  { family: "connexion", q: "Ma collègue n'arrive pas à créer son accès." },
  { family: "connexion", q: "Ça me dit que mon lien a expiré." },
  // — ROI / économie (le cœur du reproche) —
  { family: "roi", q: "J'hésite entre recruter quelqu'un ou vous prendre, comment je compare proprement ?" },
  { family: "roi", q: "Chez nous la paperasse bouffe presque deux journées chaque semaine." },
  { family: "roi", q: "Ça réduit réellement le besoin d'un poste administratif ou c'est surtout du confort ?" },
  { family: "roi", q: "Pour une équipe de vingt personnes, je récupère quoi concrètement ?" },
  { family: "roi", q: "Je ne connais pas mes heures exactes, aide-moi à les estimer." },
  { family: "roi", q: "franchement c'est rentable ou pas pour une boite de 15 ?" },
  { family: "roi", q: "Mon assistante RH est à mi-temps, est-ce que ça se substitue à elle ?" },
  { family: "roi", q: "Au bout de combien de mois je m'y retrouve financièrement ?" },
  // — capacités métier —
  { family: "capacite", q: "es ce que pier peu fair les contra de travail ?" },
  { family: "capacite", q: "Il sait gérer les arrêts maladie et prévenir la mutuelle ?" },
  { family: "capacite", q: "On a beaucoup d'alternants, il suit leurs conventions ?" },
  { family: "capacite", q: "Est-ce qu'il rédige les avenants quand quelqu'un change de poste ?" },
  { family: "capacite", q: "Il peut relancer les gens qui n'ont pas posé leurs congés ?" },
  { family: "capacite", q: "Vous faites la paie complète ou juste la préparation ?" },
  { family: "capacite", q: "Il gère les entretiens annuels ?" },
  // — multi-intentions —
  { family: "multi", q: "Vous coûtez combien, ça marche en Belgique, et est-ce que ça gère les congés payés ?" },
  { family: "multi", q: "C'est quoi la différence avec un logiciel RH classique, et vous êtes dispo quand ?" },
  { family: "multi", q: "Deux questions : mes données restent où, et je peux résilier facilement ?" },
  { family: "multi", q: "Je veux comprendre le prix, la mise en place, et ce que ça change pour mon équipe." },
  // — contexte / suite de conversation —
  { family: "contexte", q: "Et avec ce que je viens de te dire, tu l'estimes à combien ?" },
  { family: "contexte", q: "Non, je parlais du temps gagné, pas de votre abonnement." },
  { family: "contexte", q: "On revient à mon exemple avec les deux personnes RH." },
  { family: "contexte", q: "Reprends ton calcul mais avec 40 salariés au lieu de 20." },
  { family: "contexte", q: "Tu m'as dit quoi déjà sur la Suisse ?" },
  // — comparaison / objection —
  { family: "objection", q: "Qu'est-ce qui me garantit que ça ne va pas raconter n'importe quoi ?" },
  { family: "objection", q: "Mon expert-comptable fait déjà une partie, je double pas ?" },
  { family: "objection", q: "C'est cher pour une structure comme la nôtre, non ?" },
  { family: "objection", q: "Et si ça se plante sur un contrat, qui est responsable ?" },
  { family: "objection", q: "Pourquoi je ne prendrais pas juste ChatGPT à 20 balles ?" },
  // — pays / juridique —
  { family: "pays", q: "On a une filiale à Genève, ça suit la loi de là-bas ?" },
  { family: "pays", q: "Et si demain on ouvre en Espagne ?" },
  { family: "pays", q: "Les règles luxembourgeoises sont à jour chez vous ?" },
  // — données / sécurité —
  { family: "donnees", q: "Mes bulletins de paie partent chez OpenAI ou pas ?" },
  { family: "donnees", q: "Vous vous servez de nos dossiers pour entraîner votre truc ?" },
  { family: "donnees", q: "Qui chez vous peut lire ce que j'écris ici ?" },
  // — support / incident —
  { family: "support", q: "J'ai été débité deux fois ce mois-ci." },
  { family: "support", q: "Le document que j'ai généré est vide." },
  { family: "support", q: "Rien ne se passe quand je clique sur valider." },
  // — hors périmètre —
  { family: "horssujet", q: "Quelle est la capitale de l'Australie ?" },
  { family: "horssujet", q: "Tu peux m'écrire un poème sur la mer ?" },
  { family: "horssujet", q: "Il fait quel temps à Lyon demain ?" },
  { family: "horssujet", q: "Explique-moi la photosynthèse." },
  // — conversationnel —
  { family: "social", q: "Salut, tu es qui exactement ?" },
  { family: "social", q: "Merci beaucoup, c'était clair." },
  { family: "social", q: "Tu es une vraie personne ou une machine ?" },
  // — gouvernance / limites —
  { family: "gouvernance", q: "Il peut virer quelqu'un tout seul si je lui demande ?" },
  { family: "gouvernance", q: "Je veux qu'il signe les contrats à ma place." },
  { family: "gouvernance", q: "Est-ce qu'il décide des augmentations ?" },
  // — nuance / ambiguïté —
  { family: "ambigu", q: "Ça vaut le coup ?" },
  { family: "ambigu", q: "Et sinon, comment ça se passe ?" },
  { family: "ambigu", q: "C'est possible ?" },
];

describe("C1.9 surface — how much of the corpus is answered by the dictionary", () => {
  it("measures model reach and model-text survival across 60 unseen inputs", async () => {
    const at = new Date("2026-07-22T10:00:00.000Z").toISOString();
    const rows: Array<Record<string, unknown>> = [];

    for (const c of CORPUS) {
      let called = 0;
      const responder = {
        async respond(r: { model: string; system: string; userText: string; maxOutputTokens: number }) {
          called++;
          return {
            ok: true as const,
            structured: { answer: MARKER, honesty: "answered" as const, tool_call: null, citations: [] as string[] },
            usage: { model: r.model, inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
          };
        },
      };
      try {
        const r = await answerPublicQuestion({
          question: c.q, history: [], responder, model: "probe-model",
          maxOutputTokens: 500, attachments: [], imageDataUrls: [], at,
        } as unknown as PublicInput);
        const text = String(r.answer ?? "");
        rows.push({
          family: c.family, question: c.q,
          modelCalled: called > 0,
          modelTextSurvived: text.includes(MARKER),
          source: (r as { source?: string }).source ?? null,
          honesty: r.honesty,
          answerLength: text.length,
          answer: text.slice(0, 400),
        });
      } catch (e) {
        rows.push({ family: c.family, question: c.q, error: String(e), modelCalled: called > 0, modelTextSurvived: false });
      }
    }

    const byFamily = new Map<string, { n: number; called: number; survived: number }>();
    for (const r of rows) {
      const f = String(r.family);
      const s = byFamily.get(f) ?? { n: 0, called: 0, survived: 0 };
      s.n++; if (r.modelCalled) s.called++; if (r.modelTextSurvived) s.survived++;
      byFamily.set(f, s);
    }
    const called = rows.filter((r) => r.modelCalled).length;
    const survived = rows.filter((r) => r.modelTextSurvived).length;

    // Réponses déterministes identiques partagées par plusieurs questions = gabarit.
    const dictTexts = new Map<string, string[]>();
    for (const r of rows) {
      if (r.modelTextSurvived) continue;
      const a = String(r.answer ?? "");
      if (!a) continue;
      dictTexts.set(a, [...(dictTexts.get(a) ?? []), String(r.question).slice(0, 40)]);
    }

    writeFileSync("c:/Users/homme/clonestore/.c1-9-proofs/_probe_surface.json", JSON.stringify({
      generatedAt: at, corpusSize: CORPUS.length,
      modelCalled: called, modelTextSurvived: survived,
      dictionaryAnsweredCount: CORPUS.length - survived,
      dictionaryShare: (CORPUS.length - survived) / CORPUS.length,
      byFamily: [...byFamily.entries()].map(([family, s]) => ({ family, ...s })),
      sharedDictionaryTexts: [...dictTexts.entries()].filter(([, q]) => q.length > 1).map(([t, q]) => ({ questions: q, head: t.slice(0, 120) })),
      rows,
    }, null, 2));

    console.log(`SURFACE: model called ${called}/${CORPUS.length} | model text survived ${survived}/${CORPUS.length} | DICTIONARY-ANSWERED ${CORPUS.length - survived}/${CORPUS.length}`);
    for (const [family, s] of byFamily) {
      console.log(`  ${family.padEnd(12)} n=${String(s.n).padStart(2)} called=${String(s.called).padStart(2)} survived=${String(s.survived).padStart(2)}`);
    }
  }, 300_000);
});
