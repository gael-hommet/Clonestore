// src/lib/clonechat/public-answer/__tests__/c18-a2-regression-155.test.ts
// C1.8 A2 — RÉGRESSION des 155 cas jugés FAIL par le panel aveugle A/B/C.
//
// Les identifiants du corpus servent UNIQUEMENT à identifier les régressions : le code produit,
// lui, n'en connaît aucun. Les assertions sont dérivées du MESSAGE (contrats), jamais d'une
// réponse attendue mot pour mot — et l'ancienne signature exacte de chaque réponse fautive est
// interdite, pour qu'un retour en arrière soit détecté immédiatement.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { answerPublicQuestion } from "../../intelligence/c1-1/parrain-public-adapter";
import { INTERNAL_TOKEN_RX, PLACEHOLDER_RX, PARASITE_RX, DODGE_RX } from "../public-output-guard";

const FIXTURE = "src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json";
const FROZEN_BEFORE = ".c1-8-reopened-proofs/a2/remediation/_frozen-backup/C18_FROZEN_FULL_RESPONSE_META.json";
const AT = "2026-07-18T10:00:00Z";

/** Les 155 identifiants jugés FAIL (C18_A2_FINAL_VERDICTS.json, verdict final du panel). */
const FAIL_IDS: readonly number[] = [
  10, 21, 22, 24, 28, 35, 36, 38, 52, 54, 56, 61, 63, 65, 66, 67, 84, 90, 91, 93, 99, 104, 105, 109,
  110, 123, 124, 125, 138, 139, 142, 149, 178, 182, 197, 215, 227, 230, 231, 232, 237, 244, 271, 274,
  290, 293, 295, 298, 302, 303, 307, 309, 310, 312, 313, 316, 323, 330, 331, 333, 334, 348, 352, 353,
  359, 360, 371, 375, 376, 377, 379, 383, 384, 386, 388, 389, 392, 395, 397, 400, 403, 404, 405, 408,
  410, 411, 412, 416, 417, 419, 422, 423, 427, 431, 432, 433, 436, 438, 449, 450, 452, 462, 476, 479,
  483, 491, 499, 502, 507, 517, 518, 521, 533, 549, 600, 609, 619, 620, 624, 652, 675, 676, 678, 681,
  682, 684, 686, 698, 702, 708, 710, 715, 719, 725, 732, 734, 749, 794, 828, 855, 862, 863, 869, 871,
  874, 883, 894, 898, 904, 913, 922, 938, 942, 943, 1001,
];

const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").replace(/[’']/g, "'");

function corpusMessages(): string[] {
  const d = JSON.parse(readFileSync(FIXTURE, "utf8")) as { groups: { cases: Array<{ message: string }> }[] };
  return d.groups.flatMap((g) => g.cases).map((c) => c.message);
}

// ── Contrats d'audit, dérivés du message (miroir indépendant du classifieur produit) ──
const TROUBLE = /\b(marche pa|fonctionne pa|ne marche|ne fonctionne|bug|erreur|panne|plante|casse|deconne|rame|fige|bloque|echoue|refuse|impossible|arrive pa|rien ne se passe|fait rien|reagit pa|page blanche|ecran (noir|blanc|fige)|reste (blanc|noir|fige|vide)|tourne dans le vide|en boucle|expire|perdu|disparu|introuvable|est vide|mort\b|souci|probleme|comprends rien|jamais recu|pas recu|pa recu|toujours pas|repond (pa|plus)|se lance pas|trop lourde|jette dehors|grise|deux fois|c'est normal|transaction en cours|rien valide|passe ou pas|cadenas)\b/;
const BILLING = /\b(rembours|debit|preleve|prelevement|factur|paiement|paye|checkout|carte|cb\b|iban|rib|recu\b|transaction|banque|code promo|449|499)\b/;
const OUT_COUNTRY = /\b(canada|quebec|maroc|casa\b|allemagne|berlin|londres|angleterre|etats[- ]?unis|usa\b|new ?york|espagne|madrid|italie|portugal|tunisie)\b/;
const CGV = /\bcgv\b|conditions generales de vente|condition legal/;
// « rem-BOURSE-ment » contient « bourse » : les radicaux financiers doivent être bornés, sinon une
// demande de remboursement serait lue comme un ordre boursier.
const ILLICIT = /\b(hack|pirate)\b|\bvirement\b|\bvire[rz]? \d|\bbourse\b|\bscrap[a-z]*\b|\bpython\b|\bantidat[a-z]*\b|\bfalsifi[a-z]*\b|invente un article|donnees d'autres|autres (boites|entreprises)/;
const COMMERCIAL_TEXT = /\b\d{3}\s*(?:€|eur|euros|chf)\b|\bréserv[a-z]*\b|prix fondateur|démo immersive/i;
const COMMERCIAL_ROUTES = new Set(["/reserver/pierre", "/demo", "/demo/pierre"]);

describe("C1.8 A2 — les 155 anciens FAIL sont couverts par des contrats de régression", () => {
  const messages = corpusMessages();
  const before: Map<number, string> = new Map();
  if (existsSync(FROZEN_BEFORE)) {
    const f = JSON.parse(readFileSync(FROZEN_BEFORE, "utf8")) as { cases: Array<{ id: number; full_answer: string }> };
    for (const c of f.cases) before.set(c.id, c.full_answer);
  }

  it("le corpus source expose bien les 1003 messages attendus", () => {
    expect(messages.length).toBe(1003);
    expect(FAIL_IDS.length).toBe(155);
  });

  it("aucune des 155 réponses fautives ne réapparaît à l'identique", async () => {
    if (before.size === 0) { expect(before.size).toBe(0); return; }
    const identical: number[] = [];
    for (const id of FAIL_IDS) {
      const a = await answerPublicQuestion({ question: messages[id], at: AT });
      if (before.get(id) === a.answer) identical.push(id);
    }
    expect(identical, `signatures inchangées: ${JSON.stringify(identical)}`).toEqual([]);
  });

  it("les 155 respectent les contrats généraux (0 jargon interne, 0 placeholder, 0 dérobade, 0 parasite)", async () => {
    const violations: Array<Record<string, unknown>> = [];
    for (const id of FAIL_IDS) {
      const a = await answerPublicQuestion({ question: messages[id], at: AT });
      const v: string[] = [];
      if (INTERNAL_TOKEN_RX.test(a.answer)) v.push("INTERNAL");
      if (PLACEHOLDER_RX.test(a.answer)) v.push("PLACEHOLDER");
      if (PARASITE_RX.test(a.answer)) v.push("PARASITE");
      if (DODGE_RX.test(a.answer)) v.push("DODGE");
      if (a.answer.trim().length < 40) v.push("EMPTY");
      if (v.length) violations.push({ id, message: messages[id], v });
    }
    expect(violations, JSON.stringify(violations.slice(0, 5))).toEqual([]);
  });

  it("les 155 respectent les contrats spécifiques à leur situation", async () => {
    const violations: Array<Record<string, unknown>> = [];
    for (const id of FAIL_IDS) {
      const q = messages[id];
      const m = norm(q);
      const a = await answerPublicQuestion({ question: q, at: AT });
      const routes = [a.suggestedCTA?.route ?? "", ...a.relevantLinks.map((l) => l.route)];
      const v: string[] = [];

      // Incident ou litige financier ⇒ aucune pression commerciale, destination de support.
      if (TROUBLE.test(m) || (BILLING.test(m) && /rembours|debite|preleve|facture/.test(m))) {
        if (COMMERCIAL_TEXT.test(a.answer)) v.push("COMMERCIAL_TEXT_ON_INCIDENT");
        if (routes.some((r) => COMMERCIAL_ROUTES.has(r))) v.push("COMMERCIAL_CTA_ON_INCIDENT");
      }
      // Pays hors lancement ⇒ non-couverture énoncée, aucune incitation à réserver.
      if (OUT_COUNTRY.test(m)) {
        if (!/pas encore|ne fait pas partie|pas couvert/.test(norm(a.answer))) v.push("OUT_COUNTRY_NOT_STATED");
        if (a.suggestedCTA?.route === "/reserver/pierre") v.push("OUT_COUNTRY_PUSHED");
      }
      // CGV demandées ⇒ CGV délivrées.
      if (CGV.test(m) && /\bcgv\b|conditions generales de vente/.test(m) && a.suggestedCTA?.route !== "/legal/cgv") {
        v.push("CGV_MISROUTED");
      }
      // Demande illicite ⇒ refus nommé, jamais un CTA d'achat.
      if (ILLICIT.test(m)) {
        if (!/^(non|je ne)|jamais|refus|illegal|pas mon metier/.test(norm(a.answer))) v.push("ILLICIT_NOT_REFUSED");
        if (a.suggestedCTA?.route === "/reserver/pierre" && !/449|499/.test(a.answer)) v.push("ILLICIT_PUSHED_PURCHASE");
      }
      if (v.length) violations.push({ id, message: q, route: a.suggestedCTA?.route ?? null, v });
    }
    expect(violations, JSON.stringify(violations.slice(0, 8))).toEqual([]);
  });
});
