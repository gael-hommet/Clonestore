// /demo — CHAPITRE 3 : vérification des ÉTATS INTERACTIFS (comparateurs + explorateur).
// Pilote réellement les sélecteurs et assert :
//  • comparateur de temps : les 3 modes changent la valeur ; jamais NaN/Infinity ; « −N% » cohérent.
//  • comparateur financier : profil/mode/période changent le gain net ; négatif AFFICHÉ (jamais caché) ;
//    trois grandeurs distinctes présentes ; jamais NaN/Infinity.
//  • explorateur : CloneOS/CloneADN/CloneGuard/CloneVoice/CloneCall/CloneRoom/CloneChat sélectionnables,
//    chacun avec un statut honnête ; CloneVoice = « Live bloqué » ; CloneChat jamais « Disponible ».
// Navigation par clavier (marche sur tout viewport). Exit 0 = CH3_INTERACTIVE_ALL_PASS.
const { chromium } = require("playwright");
const BASE = process.env.DEMO_BASE || "http://localhost:3006";
const SCENES = [
  "value", "clonestore", "objective", "execution", "validation", "result",
  "category", "departments", "value-business", "how",
  "time-value", "money-value", "tech-architecture", "tech-explorer",
];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const results = [];
  const ok = (name, cond, extra) => results.push({ name, pass: !!cond, extra });
  const badNumber = (s) => /NaN|Infinity|undefined|€\s*€|\bnull\b/.test(s || "");

  await p.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector(".demo-stage-root", { timeout: 30000 });
  await p.waitForTimeout(400);

  const scene = () => p.getAttribute(".demo-stage-root", "data-demo-scene");
  async function gotoScene(id) {
    const target = SCENES.indexOf(id);
    // repartir du début pour un chemin déterministe
    while ((await scene()) !== "value") { await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(90); }
    for (let i = 0; i < target; i++) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(120); }
    await p.waitForFunction((x) => document.querySelector(".demo-stage-root")?.getAttribute("data-demo-scene") === x, id, { timeout: 6000 }).catch(() => {});
  }
  const clickText = async (t) => { await p.locator(`.demo-seg__opt:has-text("${t}")`).first().click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(150); };

  // ── Scène 11 : comparateur de temps ─────────────────────────────────────────
  await gotoScene("time-value");
  ok("scene 11 active", (await scene()) === "time-value");
  const headlineNums = [];
  for (const mode of ["Brouillon", "Exécution partagée", "Autonomie gouvernée"]) {
    await clickText(mode);
    const num = await p.locator(".demo-lab-headline__num").innerText().catch(() => "");
    const lbl = await p.locator(".demo-lab-headline__lbl").innerText().catch(() => "");
    headlineNums.push(num);
    ok(`time mode ${mode}: -N% valide`, /^−\d+%$/.test(num.trim()), num);
    ok(`time mode ${mode}: pas de NaN`, !badNumber(num + " " + lbl));
  }
  // les 3 modes ne donnent pas tous la même valeur (le mode change réellement le résultat)
  ok("time: les 3 modes diffèrent", new Set(headlineNums).size >= 2, JSON.stringify(headlineNums));
  // changer de profil recalcule (pas de crash)
  await clickText("PME active");
  ok("time: profil PME ok", /^−\d+%$/.test(((await p.locator(".demo-lab-headline__num").innerText().catch(() => "")) || "").trim()));
  // période mission
  await clickText("Mission");
  const missionNum = await p.locator(".demo-lab-headline__num").innerText().catch(() => "");
  ok("time: période Mission valide", /^−\d+%$/.test(missionNum.trim()) && !badNumber(missionNum), missionNum);

  // ── Scène 12 : comparateur financier ────────────────────────────────────────
  await gotoScene("money-value");
  ok("scene 12 active", (await scene()) === "money-value");
  const netTexts = [];
  for (const mode of ["Brouillon", "Exécution partagée", "Autonomie gouvernée"]) {
    await clickText(mode);
    const net = await p.locator(".demo-fin-net__num").innerText().catch(() => "");
    netTexts.push(net);
    ok(`money mode ${mode}: pas de NaN`, !badNumber(net), net);
    ok(`money mode ${mode}: montant présent`, /\d/.test(net), net);
  }
  ok("money: gain net varie selon le mode", new Set(netTexts).size >= 2, JSON.stringify(netTexts));
  // les 3 grandeurs distinctes sont présentes
  // innerText reflète le rendu (text-transform: uppercase sur les libellés) → comparaison insensible à la casse.
  const proofsText = await p.locator(".demo-fin-proofs").innerText().catch(() => "");
  ok("money: 3 grandeurs distinctes", /capacité libérée/i.test(proofsText) && /économie comptable/i.test(proofsText) && /temps récupéré/i.test(proofsText), proofsText.slice(0, 80));
  ok("money: aucune valeur cassée", !badNumber(proofsText));
  // négatif possible et AFFICHÉ (PME + Brouillon + mensuel maximise la chance d'un net faible/négatif)
  await clickText("PME active"); await clickText("Brouillon"); await clickText("Mensuel");
  const netPme = await p.locator(".demo-fin-net__num").innerText().catch(() => "");
  const negClass = await p.locator(".demo-fin-net__num").getAttribute("class").catch(() => "");
  ok("money: net PME/brouillon affiché (jamais caché/NaN)", /\d/.test(netPme) && !badNumber(netPme), netPme);
  // si le signe est négatif, la classe --neg doit être posée (honnêteté : on n'embellit pas)
  ok("money: signe négatif honnête", !netPme.trim().startsWith("−") || /--neg/.test(negClass || ""), netPme + " | " + negClass);

  // ── Scène 14 : explorateur ─────────────────────────────────────────────────
  await gotoScene("tech-explorer");
  ok("scene 14 active", (await scene()) === "tech-explorer");
  const probes = ["cloneos", "cloneadn", "cloneguard", "clonevoice", "clonecall", "cloneroom", "clonechat"];
  for (const id of probes) {
    await p.locator(`[data-tech-id="${id}"]`).click({ timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(150);
    const sel = await p.getAttribute(".demo-explorer-detail", "data-tech-selected").catch(() => null);
    const detail = await p.locator(".demo-explorer-detail").innerText().catch(() => "");
    const badge = await p.locator(".demo-explorer-detail__head .demo-tech-badge").innerText().catch(() => "");
    ok(`explorer ${id}: sélectionné`, sel === id, sel);
    ok(`explorer ${id}: détail + statut honnête`, detail.length > 40 && badge.trim().length > 0, badge);
    if (id === "clonevoice") ok("explorer clonevoice = Live bloqué", /Live bloqué/i.test(badge), badge);
    if (id === "clonechat") ok("explorer clonechat ≠ Disponible", !/Disponible localement/i.test(badge), badge);
    if (id === "clonecall") ok("explorer clonecall : mention appel sortant bloqué", /sortant/i.test(detail) || /bloqu/i.test(detail), "");
  }

  await b.close();
  let all = true;
  for (const r of results) { console.log((r.pass ? "PASS" : "FAIL") + "  " + r.name + (r.pass ? "" : "  << " + (r.extra || ""))); if (!r.pass) all = false; }
  console.log(all ? "CH3_INTERACTIVE_ALL_PASS" : "CH3_INTERACTIVE_FAIL");
  process.exit(all ? 0 : 1);
})().catch((e) => { console.log("FATAL", e.message.slice(0, 200)); process.exit(1); });
