import { describe, it, expect } from "vitest";
import { permissionsFromKeys, DEFAULT_PERMISSIONS } from "../permissions";

describe("permissionsFromKeys", () => {
  it("clés vides → défaut sûr (le serveur reste l'autorité)", () => {
    expect(permissionsFromKeys([])).toEqual(DEFAULT_PERMISSIONS);
    expect(permissionsFromKeys(null)).toEqual(DEFAULT_PERMISSIONS);
  });

  it("dérive chaque capacité depuis les clés canoniques", () => {
    const p = permissionsFromKeys(["mission.create", "validation.decide", "mission.read"]);
    expect(p.canCreateMission).toBe(true);
    expect(p.canDecideValidations).toBe(true);
    expect(p.canCancelMission).toBe(false);
    expect(p.canDownloadDocuments).toBe(true);
  });

  it("wildcard company.* accorde tout", () => {
    const p = permissionsFromKeys(["company.*"]);
    expect(p.canCreateMission && p.canDecideValidations && p.canCancelMission).toBe(true);
  });

  it("hr_operator (lecture seule) ne peut pas décider", () => {
    const p = permissionsFromKeys(["mission.read", "validation.read", "task.read", "employee.read"]);
    expect(p.canDecideValidations).toBe(false);
    expect(p.canCreateMission).toBe(false);
    expect(p.canDownloadDocuments).toBe(true);
  });
});
