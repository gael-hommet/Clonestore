// C1.8 TORTURE §2 — 200 CONVERSATIONS multi-tours (10 à 50 tours). Prouve que la résolution
// d'intention : (1) RETIENT le bon contexte (ellipse « et pour l'acheter ? » sur le sujet Pierre) ;
// (2) ABANDONNE l'ancien contexte quand l'utilisateur change de sujet ; (3) ne récupère JAMAIS un
// sujet d'une AUTRE conversation (isolation : chaque appel ne reçoit que SON historique) ; (4) ne
// réutilise pas un CTA obsolète ; (5) ne force pas une intention passée (négation/correction).
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolveNavigationIntent, type NavContext } from "../intent-taxonomy";

const visitor: NavContext = { mode: "visitor", hasActiveCompany: false, country: null };
type Turn = { role: "user" | "assistant"; text: string };

// Bruit de remplissage pour porter chaque conversation à 10–50 tours SANS parler de Pierre ni d'achat.
const FILLER: Turn[] = [
  { role: "user", text: "il fait beau aujourd'hui" }, { role: "assistant", text: "Je reste concentré sur CloneStore." },
  { role: "user", text: "ok merci" }, { role: "assistant", text: "Avec plaisir." },
  { role: "user", text: "juste une remarque" }, { role: "assistant", text: "Je vous écoute." },
  { role: "user", text: "rien de spécial" }, { role: "assistant", text: "D'accord." },
];
function pad(base: Turn[], toTurns: number): Turn[] {
  const out = [...base];
  let i = 0;
  while (out.length < toTurns) { out.push(FILLER[i % FILLER.length]); i++; }
  return out.slice(0, toTurns);
}
// index déterministe (pas de Math.random — interdit) : longueur 10..50 dérivée de l'indice.
const lenFor = (i: number) => 10 + (i % 41);

describe("C1.8 TORTURE §2 — multi-tours : rétention, abandon, isolation, pas de CTA obsolète", () => {
  const rows: Array<Record<string, unknown>> = [];
  const rec = (kind: string, ok: boolean, detail: string) => rows.push({ kind, ok, detail });

  it("(1) RÉTENTION : 50 conversations « prix Pierre … et pour l'acheter ? » ⇒ /reserver/pierre", () => {
    let ok = 0;
    for (let i = 0; i < 50; i++) {
      const base: Turn[] = [{ role: "user", text: "combien coûte Pierre ?" }, { role: "assistant", text: "Pierre coûte 449 € …" }];
      const hist = pad(base, lenFor(i));
      const r = resolveNavigationIntent("et pour l'acheter ?", visitor, hist);
      const good = r.route === "/reserver/pierre" && !r.clarification_required;
      if (good) ok++; else rec("retention", false, `${i}: ${r.route}`);
    }
    rec("retention", ok === 50, `${ok}/50`);
    expect(ok).toBe(50);
  });

  it("(2) ABANDON : 50 conversations « prix Pierre … montre-moi la démo » ⇒ /demo/pierre (pas resté sur le prix)", () => {
    let ok = 0;
    for (let i = 0; i < 50; i++) {
      const base: Turn[] = [{ role: "user", text: "combien coûte Pierre ?" }, { role: "assistant", text: "Pierre coûte 449 € …" }];
      const hist = pad(base, lenFor(i));
      const r = resolveNavigationIntent("finalement montre-moi la démo Pierre", visitor, hist);
      const good = r.route === "/demo/pierre";
      if (good) ok++; else rec("abandon", false, `${i}: ${r.route}`);
    }
    rec("abandon", ok === 50, `${ok}/50`);
    expect(ok).toBe(50);
  });

  it("(3) ISOLATION : 50 conversations FRAÎCHES (historique vide/étranger) ⇒ « et pour l'acheter ? » NE force PAS la réservation", () => {
    let ok = 0;
    for (let i = 0; i < 50; i++) {
      // Historique d'une AUTRE conversation qui ne parle PAS de Pierre (aucune fuite ne doit résoudre l'ellipse).
      const foreign: Turn[] = [{ role: "user", text: "quel temps fait-il" }, { role: "assistant", text: "Je reste sur CloneStore." }];
      const hist = pad(foreign, lenFor(i));
      const r = resolveNavigationIntent("et pour l'acheter ?", visitor, hist);
      const good = r.route !== "/reserver/pierre"; // pas de sujet Pierre ⇒ pas d'ellipse d'achat
      if (good) ok++; else rec("isolation", false, `${i}: ${r.route}`);
    }
    rec("isolation", ok === 50, `${ok}/50`);
    expect(ok).toBe(50);
  });

  it("(4+5) CORRECTION/NÉGATION : 50 conversations « je veux acheter Pierre … non, seulement la démo » ⇒ démo, jamais réservation forcée", () => {
    let ok = 0;
    for (let i = 0; i < 50; i++) {
      const base: Turn[] = [{ role: "user", text: "je veux acheter Pierre" }, { role: "assistant", text: "Pour obtenir Pierre…" }];
      const hist = pad(base, lenFor(i));
      const r = resolveNavigationIntent("non, seulement voir la démo", visitor, hist);
      const good = r.route === "/demo/pierre" && r.route !== "/reserver/pierre";
      if (good) ok++; else rec("correction", false, `${i}: ${r.route}`);
    }
    rec("correction", ok === 50, `${ok}/50`);
    expect(ok).toBe(50);
  });

  it("CONTAMINATION support→achat : après un fil de support, « combien coûte Pierre ? » reste une question de PRIX (pas de support)", () => {
    const hist = pad([{ role: "user", text: "le site plante" }, { role: "assistant", text: "Décrivez la page…" }], 20);
    const r = resolveNavigationIntent("combien coûte Pierre ?", visitor, hist);
    expect(r.route).toBe("/reserver/pierre");
    expect(r.intent).toBe("pierre_pricing");
  });

  it("écrit la preuve agrégée des 200 conversations", () => {
    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_TORTURE_MULTITURN_PROOF.json", JSON.stringify({
      conversations: 200, turns_range: "10-50", summary: rows.filter((r) => typeof r.detail === "string" && /\/\d+$/.test(r.detail as string)),
      failures: rows.filter((r) => r.ok === false),
    }, null, 2));
    expect(rows.filter((r) => r.ok === false).length).toBe(0);
  });
});
