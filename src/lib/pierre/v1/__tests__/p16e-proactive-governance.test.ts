// src/lib/pierre/v1/__tests__/p16e-proactive-governance.test.ts
// P16E §8 — la proactivité RH est GOUVERNÉE (aucun second cerveau créé ; on vérifie l'existant :
// hr-proactive/{detector,deduplication,signal-registry,mission-creation} + cognitive-runtime/
// proactive-controller). Pierre observe / détecte / propose — il n'exécute jamais d'action humaine
// ni d'effet de bord pendant la détection ; la conversion en mission est une REQUÊTE gouvernée.

import { describe, it, expect } from "vitest";
import { detect } from "@/lib/pierre/v1/hr-proactive/detector";
import { deduplicate } from "@/lib/pierre/v1/hr-proactive/deduplication";
import { signalToMissionRequest } from "@/lib/pierre/v1/hr-proactive/mission-creation";
import { SIGNAL_KEYS } from "@/lib/pierre/v1/hr-proactive/signal-registry";
import { decideProactive, runProactiveBatch } from "@/lib/pierre/v1/cognitive-runtime/proactive-controller";
import type { HrSignal } from "@/lib/pierre/v1/hr-proactive/signal-types";

const KEY = SIGNAL_KEYS[0]; // un signal réellement enregistré
const at = "2026-07-13T09:00:00.000Z";

function candidate(company: string, subject: string, key = KEY) {
  return { signalKey: key, companyId: company, subjectRef: subject, detectedAt: at };
}

describe("P16E §8 — détection déterministe et fail-closed", () => {
  it("seul un signal ENREGISTRÉ est émis ; une clé inconnue est ignorée (fail-closed)", () => {
    const out = detect([candidate("co-A", "emp-1"), candidate("co-A", "emp-2", "cle_inexistante")]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe(KEY);
  });

  it("la détection est PURE : aucun effet de bord, sortie déterministe", () => {
    const a = detect([candidate("co-A", "emp-1")]);
    const b = detect([candidate("co-A", "emp-1")]);
    expect(a).toEqual(b);
  });

  it("un signal ne porte JAMAIS de PII brute (subjectRef opaque + pas de champ email/nom/salaire)", () => {
    const [s] = detect([candidate("co-A", "emp-1")]);
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/email|salaire|salary|@|nom_complet/i);
    expect(s.subjectRef).toBe("emp-1"); // référence opaque
  });
});

describe("P16E §8 — déduplication : pas de spam, pas de double alerte", () => {
  it("un dedupKey déjà vivant est supprimé (une seule alerte par (clé, sujet))", () => {
    const detected = detect([candidate("co-A", "emp-1"), candidate("co-A", "emp-1")]);
    const { fresh, suppressed } = deduplicate(detected, []);
    expect(fresh).toHaveLength(1);
    expect(suppressed).toBe(1);
  });

  it("un dedupKey déjà OUVERT en base (existingDedupKeys) est supprimé", () => {
    const detected = detect([candidate("co-A", "emp-1")]);
    const { fresh, suppressed } = deduplicate(detected, [detected[0].dedupKey]);
    expect(fresh).toHaveLength(0);
    expect(suppressed).toBe(1);
  });

  it("déduplication DÉTERMINISTE (même entrée → même sortie)", () => {
    const d = detect([candidate("co-A", "emp-1"), candidate("co-A", "emp-1")]);
    expect(deduplicate(d).fresh).toEqual(deduplicate(d).fresh);
  });
});

describe("P16E §8 — décision gouvernée : jamais d'exécution autonome d'une action humaine", () => {
  it("decideProactive ne produit que observe/task/mission/alert (jamais 'send'/'sign'/'decide')", () => {
    for (const sev of ["info", "warning", "critical"] as const) {
      const s: HrSignal = { key: KEY, companyId: "co-A", subjectRef: "e1", detectedAt: at, severity: sev, dedupKey: `${KEY}:e1` };
      const o = decideProactive(s);
      expect(["ignore", "observe", "task", "mission", "alert"]).toContain(o.decision);
      // une décision « mission » est une REQUÊTE gouvernée (pack), jamais une mission exécutée ici.
      if (o.decision === "mission") { expect(o.missionRequest).not.toBeNull(); expect(o.missionRequest?.companyId).toBe("co-A"); }
    }
  });

  it("fail-closed : un signal sans pack gouverné ⇒ pas de missionRequest (observe/alert seulement)", () => {
    const s: HrSignal = { key: "signal_sans_pack", companyId: "co-A", subjectRef: "e1", detectedAt: at, severity: "critical", dedupKey: "x:e1" };
    expect(signalToMissionRequest(s)).toBeNull();
    expect(decideProactive(s).decision).toBe("alert"); // critique sans pack ⇒ alerte, jamais mission
  });

  it("la priorité est bornée et déterministe (pas de fausse urgence)", () => {
    const info = decideProactive({ key: KEY, companyId: "c", subjectRef: "e", detectedAt: at, severity: "info", dedupKey: "k" });
    const crit = decideProactive({ key: KEY, companyId: "c", subjectRef: "e", detectedAt: at, severity: "critical", dedupKey: "k" });
    expect(info.priority).toBeLessThan(crit.priority);
    expect(crit.priority).toBeLessThanOrEqual(100);
  });
});

describe("P16E §8 — isolation multi-tenant + tri", () => {
  it("la requête de mission préserve le companyId du signal (jamais un autre tenant)", () => {
    const s: HrSignal = { key: KEY, companyId: "co-B", subjectRef: "e1", detectedAt: at, severity: "warning", dedupKey: `${KEY}:e1` };
    const req = signalToMissionRequest(s);
    if (req) expect(req.companyId).toBe("co-B");
  });

  it("runProactiveBatch classe par priorité et dédoublonne (déterministe)", () => {
    const detected = detect([candidate("co-A", "e1"), candidate("co-A", "e1"), candidate("co-A", "e2")]);
    const { outcomes, suppressed } = runProactiveBatch(detected, []);
    expect(suppressed).toBe(1); // e1 dupliqué
    expect(outcomes.length).toBe(2);
    for (let i = 1; i < outcomes.length; i++) expect(outcomes[i - 1].priority).toBeGreaterThanOrEqual(outcomes[i].priority);
  });
});
