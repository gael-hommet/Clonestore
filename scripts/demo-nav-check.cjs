// Deterministic /demo navigation check — single click / single key = single scene advance.
// Reads data-demo-scene on .demo-stage-root (reflects index state immediately, not the animating
// frame). Run against a base URL (local dev or the READY Preview). Exit 0 = all pass.
const { chromium } = require("playwright");
const BASE = process.env.DEMO_BASE || "http://localhost:3005";
const SCENES = ["value", "clonestore", "objective", "execution", "validation", "result", "category", "departments", "value-business", "how", "time-value", "money-value", "tech-architecture", "tech-explorer"];
const LAST = SCENES.length - 1;

(async () => {
  const b = await chromium.launch();
  const results = [];
  const ok = (name, cond) => results.push({ name, pass: !!cond });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 160)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 140)); });

  const scene = () => p.getAttribute(".demo-stage-root", "data-demo-scene");
  const settle = () => p.waitForTimeout(430);
  const load = async () => { await p.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForSelector(".demo-stage-root", { timeout: 30000 }); await settle(); };

  await load();
  ok("initial = value", (await scene()) === "value");

  await p.locator(".demo-nav-arrow--next").click(); await settle();
  ok("1 Next = clonestore", (await scene()) === "clonestore");
  await p.locator(".demo-nav-arrow--next").click(); await settle();
  ok("2 Next = objective", (await scene()) === "objective");
  await p.locator(".demo-nav-arrow--prev").click(); await settle();
  ok("Prev = clonestore", (await scene()) === "clonestore");

  await load();
  const nextBtn = p.locator(".demo-nav-arrow--next");
  const prevBtn = p.locator(".demo-nav-arrow--prev");
  const seq = [await scene()];
  for (let i = 0; i < SCENES.length; i++) { if (!(await nextBtn.isDisabled())) await nextBtn.click(); await settle(); seq.push(await scene()); }
  ok("N Next never skip/double", JSON.stringify(seq) === JSON.stringify(["value", ...SCENES.slice(1), SCENES[LAST]]));
  ok("Next disabled only at last scene", await nextBtn.isDisabled());
  for (let i = 0; i < SCENES.length; i++) { if (!(await prevBtn.isDisabled())) await prevBtn.click(); await settle(); }
  ok("Prev back to value", (await scene()) === "value");
  ok("Prev disabled only at value", await prevBtn.isDisabled());

  await load();
  const kR = [await scene()];
  for (let i = 0; i < LAST; i++) { await p.keyboard.press("ArrowRight"); await settle(); kR.push(await scene()); }
  ok("ArrowRight value->last one-by-one", JSON.stringify(kR) === JSON.stringify(SCENES));
  const kL = [await scene()];
  for (let i = 0; i < LAST; i++) { await p.keyboard.press("ArrowLeft"); await settle(); kL.push(await scene()); }
  ok("ArrowLeft last->value one-by-one", JSON.stringify(kL) === JSON.stringify([...SCENES].reverse()));

  // click during transition must not skip/blank/desync
  await load();
  await p.locator(".demo-nav-arrow--next").click();
  await p.waitForTimeout(80); // mid-transition
  await p.locator(".demo-nav-arrow--next").click();
  await settle();
  ok("double-fast-click lands exactly on objective", (await scene()) === "objective");
  const op = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".demo-scene-frame")).opacity));
  ok("active frame opacity > 0.95", op > 0.95);

  ok("no console/page errors", errs.length === 0);

  await b.close();
  let all = true;
  for (const r of results) { console.log((r.pass ? "PASS" : "FAIL") + "  " + r.name); if (!r.pass) all = false; }
  if (errs.length) errs.slice(0, 6).forEach((e) => console.log("  err:", e));
  console.log(all ? "NAV_ALL_PASS" : "NAV_FAIL");
  process.exit(all ? 0 : 1);
})().catch((e) => { console.log("FATAL", e.message.slice(0, 200)); process.exit(1); });
