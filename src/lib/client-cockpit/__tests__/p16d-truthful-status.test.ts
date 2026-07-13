// src/lib/client-cockpit/__tests__/p16d-truthful-status.test.ts
// P16D §6 — STATUT ET LANGAGE VÉRIDIQUES. « Programmé » ne vaut jamais « envoyé ».
//
// DÉFAUT CORRIGÉ (confirmé, atteignable depuis une demande banale) —
// `deriveV1Artifacts` affichait « Envoyé » (tonalité `success`) pour TOUTE tâche de famille
// « Communication » arrivée en état terminal. Or les exécuteurs `reminder` / `deadline_reminder`
// RÉUSSISSENT en se contentant de PROGRAMMER un rappel (`executors.ts` : sortie
// `{ kind: "reminder", scheduled_for }`, `external_side_effect: false`) — aucun message ne part.
//
// Chemin réel : « Relance Paul sur son justificatif » ⇒ `analysis.ts` OPERATIONAL_RULES
// (`/\b(relance|relancer)/i`) ⇒ action `reminder` ⇒ exécuteur `succeeded` ⇒ cockpit « Envoyé ».
// L'utilisateur lisait « Envoyé » pour une relance jamais envoyée.
//
// Cause structurelle : `v1.ts` ré-implémentait libellé + tonalité dans une chaîne de ternaires
// locale — une SECONDE source de vérité à côté du présentateur canonique `status.ts`. P16D
// supprime le doublon : `v1.ts` consomme désormais `artifactStatusView()`.

import { describe, it, expect } from "vitest";
import { deriveV1Artifacts } from "@/lib/client-cockpit/v1";
import { artifactStatusView } from "@/lib/client-cockpit/status";

const task = (over: Record<string, unknown>) => ({
  id: "t-1", mission_id: "m-1", objective: "Relancer Paul sur son justificatif",
  approval_required: false, ...over,
});

describe("P16D §6 — un rappel PROGRAMMÉ n'est jamais présenté comme ENVOYÉ", () => {
  it.each(["reminder", "deadline_reminder"])(
    "%s terminé ⇒ « Planifié » (neutre), JAMAIS « Envoyé » (succès)",
    (type) => {
      const [a] = deriveV1Artifacts([task({ type, status: "succeeded" })]);
      expect(a.status).toBe("scheduled");
      expect(a.statusView.label).toBe("Planifié");
      expect(a.statusView.label).not.toBe("Envoyé");
      // La tonalité porte la vérité autant que le mot : pas de `success` sur un envoi absent.
      expect(a.statusView.tone).not.toBe("success");
    },
  );

  it("un VRAI envoi reste « Envoyé » — la correction ne dégrade pas le cas légitime", () => {
    const [a] = deriveV1Artifacts([task({ type: "email_send", status: "succeeded" })]);
    expect(a.status).toBe("sent");
    expect(a.statusView.label).toBe("Envoyé");
    expect(a.statusView.tone).toBe("success");
  });

  it("`email_send` réel s'arrête en `blocked` (awaiting_integration) ⇒ « À relire », jamais « Envoyé »", () => {
    // C'est l'état réellement produit par le runtime : l'exécuteur d'email renvoie
    // `awaiting_integration` (jamais `succeeded`) et le worker gare la tâche en `blocked`.
    const [a] = deriveV1Artifacts([task({ type: "email_send", status: "blocked" })]);
    expect(a.statusView.label).toBe("À relire");
    expect(a.statusView.label).not.toBe("Envoyé");
    expect(a.statusView.tone).not.toBe("success");
  });

  it("une tâche en attente de validation n'est jamais « Envoyé » ni « Terminé »", () => {
    const [a] = deriveV1Artifacts([task({ type: "email_send", status: "in_progress", approval_required: true })]);
    expect(a.statusView.label).toBe("À valider");
    expect(a.statusView.tone).toBe("warning");
  });
});

describe("P16D §6 — un seul cerveau de statut (aucun libellé ré-inventé hors du présentateur)", () => {
  it("le statusView produit par deriveV1Artifacts est EXACTEMENT celui du présentateur canonique", () => {
    const cases: Array<[string, string]> = [
      ["reminder", "succeeded"], ["email_send", "succeeded"], ["email_send", "blocked"],
      ["document_generate", "succeeded"], ["email_send", "failed"],
    ];
    for (const [type, status] of cases) {
      const [a] = deriveV1Artifacts([task({ type, status })]);
      // Si v1.ts ré-inventait un libellé, cette égalité casserait.
      expect(a.statusView).toEqual(artifactStatusView(a.status));
    }
  });

  it("le vocabulaire canonique distingue bien préparé / planifié / envoyé / signé", () => {
    expect(artifactStatusView("draft").label).toBe("Brouillon");
    expect(artifactStatusView("scheduled").label).toBe("Planifié");
    expect(artifactStatusView("awaiting_validation").label).toBe("À valider");
    expect(artifactStatusView("sent").label).toBe("Envoyé");
    expect(artifactStatusView("signed").label).toBe("Signé");
    // Un statut inconnu ne devient JAMAIS un succès inventé.
    expect(artifactStatusView("n_importe_quoi").label).toBe("Inconnu");
    expect(artifactStatusView("n_importe_quoi").tone).not.toBe("success");
  });
});
