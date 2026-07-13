// src/lib/client-cockpit/__tests__/p16e-f30-f32-truthful-status.test.ts
// P16E §5 — statut véridique dans le cockpit Pierre.
//
// F30 — un BROUILLON SENSIBLE (licenciement / sanction / contrat) « réussi » n'est que PRÉPARÉ :
//        la décision humaine reste requise. Il était affiché « Validé ». Il doit être « À valider ».
// F32 — les badges de statut affichaient l'ÉTAT INTERNE BRUT EN ANGLAIS pour tout statut absent de
//        leur table locale (un second cerveau de statut). Ils délèguent désormais au présentateur
//        canonique (client-cockpit/status.ts), qui rend un libellé français ou « Inconnu ».

import { describe, it, expect } from "vitest";
import { deriveV1Artifacts } from "@/lib/client-cockpit/v1";
import { taskStatusView } from "@/lib/client-cockpit/status";
import type { CockpitTone } from "@/lib/client-cockpit/types";

// Réplique EXACTE de la résolution du badge (PierreStatusBadges.StatusBadge) pour verrouiller
// la doctrine : statut connu -> style local ; sinon -> présentateur canonique (jamais d'anglais).
const LOCAL = new Set(["done","completed","running","queued","pending","blocked","failed","cancelled","error","draft","approved","skipped","ready","almost_ready"]);
const TONE: Record<CockpitTone, string> = { success:"s", progress:"b", info:"b", warning:"w", danger:"d", neutral:"m" };
function badgeLabel(status: string): string {
  if (LOCAL.has(status.toLowerCase())) return "(local)";
  const v = taskStatusView(status);
  void TONE[v.tone];
  return v.label;
}

describe("P16E §5 F30 — un brouillon sensible n'est jamais « Validé »", () => {
  it.each(["prepare_sensitive_draft", "sensitive_draft", "contract_draft", "avenant_document"])(
    "un livrable sensible terminé (%s) ⇒ « À valider », jamais « Validé »",
    (type) => {
      const [a] = deriveV1Artifacts([{ id: "t1", type, status: "succeeded", approval_required: false, objective: "Dossier" }]);
      expect(a.status).toBe("awaiting_validation");
      expect(a.statusView.label).toBe("À valider");
      expect(a.statusView.label).not.toBe("Validé");
      expect(a.statusView.tone).not.toBe("success"); // pas de tonalité « réussi » sur une décision en attente
    },
  );

  it("un document NON sensible réellement terminé reste « Validé » (pas de sur-correction)", () => {
    const [a] = deriveV1Artifacts([{ id: "t2", type: "attestation_document", status: "succeeded", approval_required: false, objective: "Attestation" }]);
    expect(a.status).toBe("validated");
    expect(a.statusView.label).toBe("Validé");
  });
});

describe("P16E §5 F32 — aucun état interne anglais brut affiché", () => {
  it.each([
    ["awaiting_validation", "À valider"],
    ["succeeded", "Terminée"],
    ["retry_scheduled", "En file"],
    ["leased", "En cours d'exécution"],
    ["escalated", "Bloquée"],
    ["in_progress", "En cours d'exécution"],
  ])("statut interne « %s » ⇒ libellé français « %s » (jamais l'anglais brut)", (raw, fr) => {
    const label = badgeLabel(raw);
    expect(label).toBe(fr);
    expect(label).not.toBe(raw); // jamais l'état interne brut
  });

  it("un statut totalement inconnu ⇒ « Inconnu », jamais la chaîne brute", () => {
    expect(badgeLabel("wibble_internal_xyz")).toBe("Inconnu");
  });

  it("les statuts connus gardent leur style local (aucune régression)", () => {
    expect(badgeLabel("done")).toBe("(local)");
    expect(badgeLabel("running")).toBe("(local)");
  });
});
