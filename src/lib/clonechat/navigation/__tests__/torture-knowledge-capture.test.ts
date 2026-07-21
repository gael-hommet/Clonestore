// C1.8 TORTURE §3 — CONNAISSANCE PRODUIT À L'AVEUGLE. Exécute les questions de connaissance
// (générées indépendamment) sur le VRAI pipeline déterministe et capture chaque réponse pour audit.
// Invariants mécaniques DURS ici (100 %) : aucune route inventée, aucun href dangereux. La détection
// d'HALLUCINATION (feature/prix/dispo/action inventés, « je ne sais pas » manquant) est faite par un
// panel de JUGES indépendants sur le fichier capturé (voir C18_TORTURE_KNOWLEDGE_ANSWERS.json).
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { answerPublicQuestion } from "../../intelligence/c1-1/parrain-public-adapter";
import { isRealDestinationRoute } from "../destination-registry";
import { getRouteEntry } from "@/lib/nav/route-registry";

const DANGEROUS = /^(javascript:|data:|vbscript:|file:)/i;

describe("C1.8 TORTURE §3 — capture des réponses de connaissance produit (pour audit juges)", () => {
  it("capture 150 réponses + invariants durs : 0 route inventée, 0 href dangereux", async () => {
    const d = JSON.parse(readFileSync("src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json", "utf8"));
    const knowledge = d.groups.flatMap((g: { category: string; cases: Array<Record<string, unknown>> }) =>
      g.category === "product_knowledge" ? g.cases : []);
    const rows: Array<Record<string, unknown>> = [];
    let inventedRoutes = 0, dangerous = 0;
    for (const c of knowledge) {
      const a = await answerPublicQuestion({ question: c.message as string, at: "2026-07-18T10:00:00Z" });
      const links = a.relevantLinks.map((l) => l.route);
      const invented = links.some((r) => r.startsWith("/") && !isRealDestinationRoute(r) && getRouteEntry(r) === null);
      const dang = [...links, a.suggestedCTA?.route ?? ""].some((r) => DANGEROUS.test(r));
      if (invented) inventedRoutes++;
      if (dang) dangerous++;
      rows.push({
        q: c.message, must_refuse: c.must_refuse, is_impossible: c.is_impossible_or_oos,
        answer: a.answer, cta: a.suggestedCTA?.route ?? null, honesty: a.honesty,
      });
    }
    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_TORTURE_KNOWLEDGE_ANSWERS.json", JSON.stringify({
      total: rows.length, invented_routes: inventedRoutes, dangerous_hrefs: dangerous, rows,
    }, null, 2));
    // ── HONNÊTETÉ (mécanique) ──
    // (a) Une question de LIMITE (« Pierre peut-il licencier tout seul », « décision finale »,
    // « remplace le DRH ») ne doit JAMAIS recevoir un CTA d'ACHAT : on explique la limite, on ne vend pas.
    const limitQ = (q: string) => /peut[^.?!]{0,40}(tout\s+seul|a\s+ma\s+place|decision\s+finale|licencier|virer|signer)|remplace[a-z]*\s+[^.?!]{0,15}drh|paie\s+complete|decision\s+(finale|disciplinaire)/i.test(q.normalize("NFD").replace(/[̀-ͯ]/g, ""));
    const limitWithBuyCta = rows.filter((r) => limitQ(r.q as string) && r.cta === "/reserver/pierre");
    // (b) Une AFFIRMATION FAUSSE de prix (99/199/299) ne doit pas être confirmée : la réponse cite le vrai prix.
    const falsePriceAffirmed = rows.filter((r) => {
      const q = r.q as string, a = r.answer as string;
      const falseNum = /\b(99|199|299|9\s?€|gratuit)\b/.test(q);
      return falseNum && /\b(oui|c'est\s+ca|exact|en\s+effet|tout\s+a\s+fait)\b/i.test(a) && !/449|499/.test(a);
    });
    // (c) Une AFFIRMATION FAUSSE de pays (Canada/Maroc/USA…) ne doit pas être confirmée.
    const falseCountryAffirmed = rows.filter((r) => {
      const q = r.q as string, a = r.answer as string;
      const foreign = /\b(canada|maroc|usa|etats[- ]?unis|allemagne|espagne|italie|bresil)\b/i.test(q.normalize("NFD").replace(/[̀-ͯ]/g, ""));
      return foreign && /\b(oui|disponible|bien\s+sur|tout\s+a\s+fait)\b/i.test(a) && !/(france|belgique|luxembourg|suisse|4\s+pays)/i.test(a);
    });

    // eslint-disable-next-line no-console
    console.log(`\n  ▸ KNOWLEDGE : ${rows.length} réponses | routes inventées=${inventedRoutes} | href dangereux=${dangerous} | limite→achat=${limitWithBuyCta.length} | faux prix affirmé=${falsePriceAffirmed.length} | faux pays affirmé=${falseCountryAffirmed.length}`);
    expect(inventedRoutes).toBe(0);
    expect(dangerous).toBe(0);
    expect(rows.length).toBeGreaterThanOrEqual(140);
    expect(limitWithBuyCta, `limite→achat: ${JSON.stringify(limitWithBuyCta.map((r) => r.q))}`).toEqual([]);
    expect(falsePriceAffirmed, `faux prix affirmé: ${JSON.stringify(falsePriceAffirmed.map((r) => r.q))}`).toEqual([]);
    expect(falseCountryAffirmed, `faux pays affirmé: ${JSON.stringify(falseCountryAffirmed.map((r) => r.q))}`).toEqual([]);
  });
});
