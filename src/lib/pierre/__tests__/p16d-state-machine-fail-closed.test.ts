// src/lib/pierre/__tests__/p16d-state-machine-fail-closed.test.ts
// P16D §4 — DURCISSEMENT DE LA MACHINE À ÉTATS : les transitions impossibles ÉCHOUENT FERMÉ.
//
// La table canonique (state-machine.ts) est la SEULE source des transitions permises ; aucune
// route ni aucun dépôt ne change un statut par un UPDATE nu. Ce fichier prouve, transition par
// transition, que les sauts interdits par P16D §4 sont bien REFUSÉS — et surtout qu'ils lèvent
// une erreur typée (`illegal_transition`) plutôt que de passer en silence.
//
// Aucun renommage d'état canonique : P16D vérifie l'existant, il ne le réécrit pas.

import { describe, it, expect } from "vitest";
import {
  assertMissionTransition, assertTaskTransition,
  canTransitionMission, canTransitionTask,
  MISSION_STATUSES, TASK_STATUSES,
  TERMINAL_MISSION_STATUSES,
  type MissionStatus, type TaskStatus,
} from "@/lib/pierre/v1/state-machine";

describe("P16D §4 — sauts interdits : la mission ne peut pas court-circuiter son cycle", () => {
  // « DRAFT → COMPLETED » : préparer ne vaut JAMAIS terminer.
  it("draft → done est REFUSÉ (préparé ≠ terminé)", () => {
    expect(canTransitionMission("draft", "done")).toBe(false);
    expect(() => assertMissionTransition("draft", "done")).toThrow();
  });

  // « PREPARED → SENT sans autorisation » : ready/planned ne saute pas la validation en done.
  it.each([["planned"], ["ready"], ["awaiting_validation"], ["queued"]] as Array<[MissionStatus]>)(
    "%s → done est REFUSÉ (aucune complétion sans exécution réelle)",
    (from) => {
      expect(canTransitionMission(from, "done")).toBe(false);
      expect(() => assertMissionTransition(from, "done")).toThrow();
    },
  );

  // « FAILED → COMPLETED sans preuve de réconciliation ».
  it("failed → done est REFUSÉ (un échec ne devient pas un succès sans repasser par une reprise)", () => {
    expect(canTransitionMission("failed", "done")).toBe(false);
    expect(() => assertMissionTransition("failed", "done")).toThrow();
    // La seule sortie légitime d'un échec est une reprise explicite / escalade / archivage.
    expect(canTransitionMission("failed", "retry_scheduled")).toBe(true);
    expect(canTransitionMission("failed", "escalated")).toBe(true);
  });

  // « CANCELLED → EXECUTING ».
  it.each([["in_progress"], ["queued"], ["ready"], ["done"]] as Array<[MissionStatus]>)(
    "cancelled → %s est REFUSÉ (une mission annulée ne redémarre jamais)",
    (to) => {
      expect(canTransitionMission("cancelled", to)).toBe(false);
      expect(() => assertMissionTransition("cancelled", to)).toThrow();
    },
  );

  it("archived est un puits : aucune sortie", () => {
    for (const to of MISSION_STATUSES) {
      if (to === "archived") continue;                  // l'identité est tolérée, pas un mouvement
      expect(canTransitionMission("archived", to)).toBe(false);
    }
  });

  it("les états terminaux ne retournent jamais en exécution", () => {
    for (const from of TERMINAL_MISSION_STATUSES) {
      expect(canTransitionMission(from, "in_progress")).toBe(false);
      expect(canTransitionMission(from, "queued")).toBe(false);
    }
  });
});

describe("P16D §4 — sauts interdits au niveau TÂCHE", () => {
  it("draft → succeeded est REFUSÉ (rien ne réussit sans avoir été exécuté)", () => {
    expect(canTransitionTask("draft", "succeeded")).toBe(false);
    expect(() => assertTaskTransition("draft", "succeeded")).toThrow();
  });

  it("awaiting_validation → in_progress est REFUSÉ (on n'exécute pas ce qui attend une validation)", () => {
    // La seule sortie est `ready` (après décision humaine) — jamais l'exécution directe.
    expect(canTransitionTask("awaiting_validation", "in_progress")).toBe(false);
    expect(() => assertTaskTransition("awaiting_validation", "in_progress")).toThrow();
    expect(canTransitionTask("awaiting_validation", "ready")).toBe(true);
  });

  it("cancelled → in_progress / succeeded est REFUSÉ", () => {
    expect(canTransitionTask("cancelled", "in_progress")).toBe(false);
    expect(canTransitionTask("cancelled", "succeeded")).toBe(false);
    expect(() => assertTaskTransition("cancelled", "succeeded")).toThrow();
  });

  it("failed → succeeded est REFUSÉ (pas de succès sans reprise explicite)", () => {
    expect(canTransitionTask("failed", "succeeded")).toBe(false);
    expect(() => assertTaskTransition("failed", "succeeded")).toThrow();
    expect(canTransitionTask("failed", "retry_scheduled")).toBe(true);
  });

  it("queued → succeeded est REFUSÉ : « en file » ne vaut JAMAIS « terminé »", () => {
    expect(canTransitionTask("queued", "succeeded")).toBe(false);
    expect(() => assertTaskTransition("queued", "succeeded")).toThrow();
  });

  it("succeeded ne repart jamais en exécution", () => {
    for (const to of TASK_STATUSES) {
      if (to === "succeeded" || to === "archived") continue;
      expect(canTransitionTask("succeeded", to)).toBe(false);
    }
  });
});

describe("P16D §4 — l'échec est FERMÉ : aucune transition inconnue ne passe", () => {
  it("un statut hors table est refusé, jamais toléré par défaut", () => {
    expect(canTransitionMission("n_importe_quoi" as MissionStatus, "done")).toBe(false);
    expect(canTransitionTask("n_importe_quoi" as TaskStatus, "succeeded")).toBe(false);
    expect(() => assertTaskTransition("n_importe_quoi" as TaskStatus, "succeeded")).toThrow();
  });

  it("le refus lève une erreur `illegal_transition` typée (jamais un échec silencieux)", () => {
    try {
      assertMissionTransition("cancelled", "in_progress");
      throw new Error("aurait dû lever");
    } catch (e) {
      expect(String((e as { code?: string }).code ?? (e as Error).message)).toMatch(/illegal_transition|cancelled/i);
    }
  });
});
