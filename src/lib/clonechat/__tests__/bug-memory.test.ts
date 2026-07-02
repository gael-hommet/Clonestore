import { describe, it, expect } from "vitest";
import {
  createInMemoryBugStore,
  fingerprint,
  symptomSimilarity,
  redactSymptom,
} from "../bug-memory";

const AT = "2026-07-02T10:00:00.000Z";

describe("Mémoire de bugs — empreinte stable & tenant-safe", () => {
  it("l'empreinte ignore l'ordre des mots et les identifiants volatils", () => {
    const a = fingerprint("le bouton reste grisé mission 12345");
    const b = fingerprint("mission 98765 grisé le bouton reste");
    expect(a).toBe(b);
  });
  it("redactSymptom retire e-mails, nombres et noms propres", () => {
    const r = redactSymptom("Marie Dupont (marie@acme.io) signale l'erreur 40321 sur le contrat");
    expect(r).not.toMatch(/Marie Dupont/);
    expect(r).not.toMatch(/marie@acme\.io/);
    expect(r).not.toMatch(/40321/);
    expect(r).toMatch(/\[nom\]|\[email\]|\[num\]/);
  });
  it("symptomSimilarity mesure un recouvrement de tokens", () => {
    expect(symptomSimilarity("bouton envoyer grisé", "bouton envoyer grisé")).toBe(1);
    expect(symptomSimilarity("bouton grisé", "cockpit vide missions")).toBeLessThan(0.2);
  });
});

describe("Mémoire de bugs — cas connus & occurrences", () => {
  it("retrouve un cas amorcé par correspondance floue et propose un contournement", async () => {
    const store = createInMemoryBugStore();
    const m = await store.find("le bouton d'envoi est grisé, impossible d'envoyer");
    expect(m.matched).toBe(true);
    expect(m.case?.workaround).toBeTruthy();
  });
  it("crée un cas inconnu (reported, occurrence 1) puis incrémente l'occurrence", async () => {
    const store = createInMemoryBugStore([]);
    const first = await store.report({ symptoms: "widget xyz ne se charge jamais", at: AT });
    expect(first.status).toBe("reported");
    expect(first.occurrences).toBe(1);
    const second = await store.report({ symptoms: "widget xyz ne se charge jamais", at: AT });
    expect(second.occurrences).toBe(2);
    expect(second.fingerprint).toBe(first.fingerprint);
  });
  it("un cas avec solution est marqué resolved", async () => {
    const store = createInMemoryBugStore([]);
    const c = await store.report({ symptoms: "erreur foo", solution: "faire bar", at: AT });
    expect(c.status).toBe("resolved");
    expect(c.solution).toBe("faire bar");
  });
  it("liste triée par occurrences décroissantes", async () => {
    const store = createInMemoryBugStore([]);
    await store.report({ symptoms: "aaa bbb ccc", at: AT });
    await store.report({ symptoms: "ddd eee fff", at: AT });
    await store.report({ symptoms: "ddd eee fff", at: AT });
    const list = await store.list();
    expect(list[0].occurrences).toBeGreaterThanOrEqual(list[1].occurrences);
  });
});
