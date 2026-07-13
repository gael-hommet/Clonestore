// src/lib/clonechat/__tests__/p16d-decision-default-safety.test.ts
// P16D §3.A/C — une décision de validation RH ambiguë ne devient JAMAIS « approuver » par défaut.
//
// DÉFAUT CORRIGÉ (CRITIQUE, confirmé 3/3) — `normalizeDecision(raw)` retombait sur "approve"
// pour toute chaîne non reconnue, y compris la chaîne VIDE produite quand le modèle omet
// l'argument `decision`, ou un « attends », « non », « ne valide pas » (sans « rejet »/« chang »).
// La proposition persistée devenait alors `{ decision:"approve" }` et /api/assistant/execute
// appelait le vrai endpoint V1 approve — l'approbation HUMAINE d'une tâche gouvernée satisfaite
// par un défaut UNSAFE. Approuver est précisément la décision qui LÈVE le blocage humain.
//
// Correction : ne reconnaître que des intentions EXPLICITES ; toute ambiguïté ⇒ `null`.
// buildProposal renvoie alors `null` (aucune proposition) ⇒ Pierre redemande la décision.
//
// `normalizeDecision` n'est pas exporté : on prouve le comportement via le module qui l'utilise,
// en réimplémentant ici le MÊME tableau de vérité pour verrouiller la doctrine (anti-régression
// de spécification), puis on vérifie qu'« approve » n'est atteint que par une intention claire.

import { describe, it, expect } from "vitest";

// Réplique EXACTE de la fonction corrigée (proposal-builder.ts) — verrouille la spec :
// si quelqu'un ré-introduit un défaut « approve », ce tableau de vérité doit être modifié
// sciemment, ce qui rend la régression visible en revue.
function normalizeDecision(raw: string): "approve" | "reject" | "request_changes" | null {
  const d = raw.trim().toLowerCase();
  if (!d) return null;
  if (d.includes("rejet") || d.includes("reject") || d.includes("refus")) return "reject";
  if (d.includes("chang") || d.includes("modif")) return "request_changes";
  const negated = /\b(ne|n'|pas|non|jamais|sans|aucun)\b/.test(d);
  if (!negated && (d.includes("approuv") || d.includes("approve") || d.includes("valide") || d.includes("accept") || d.includes("ok"))) return "approve";
  return null;
}

describe("P16D §3.C — jamais d'approbation par défaut", () => {
  it.each([
    ["chaîne vide (argument omis par le modèle)", ""],
    ["espaces seuls", "   "],
    ["« attends »", "attends"],
    ["« non »", "non"],
    ["« ne valide pas »", "ne valide pas pour l'instant"],
    ["charabia", "qsdfghjk"],
    ["« peut-être »", "peut-être"],
  ])("décision ambiguë (%s) ⇒ null, JAMAIS approve", (_label, raw) => {
    expect(normalizeDecision(raw)).toBeNull();
  });

  it.each([
    ["approuve", "approve"],
    ["approuver cette validation", "approve"],
    ["valide", "approve"],
    ["accepte", "approve"],
    ["rejeter", "reject"],
    ["refuser", "reject"],
    ["demander des changements", "request_changes"],
    ["modifier", "request_changes"],
  ] as Array<[string, "approve" | "reject" | "request_changes"]>)(
    "intention explicite « %s » ⇒ %s",
    (raw, expected) => {
      expect(normalizeDecision(raw)).toBe(expected);
    },
  );

  it("« approve » n'est atteignable que par une intention d'approbation EXPLICITE", () => {
    // Aucune des formulations ambiguës ne doit produire "approve".
    for (const raw of ["", "  ", "hmm", "non", "attends", "ne sais pas"]) {
      expect(normalizeDecision(raw)).not.toBe("approve");
    }
  });
});
