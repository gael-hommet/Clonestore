// First-scene integrity check — on a FRESH load of /demo, BEFORE any interaction, scene 1 must be
// fully visible with no clipping and no internal scrollbar. Reproduces the 1366x768 clipping HARD FAIL.
const { chromium } = require("playwright");
const BASE = process.env.DEMO_BASE || "http://localhost:3006";
const VPS = [
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1366x768", w: 1366, h: 768 },
  { name: "1280x720", w: 1280, h: 720 },
  { name: "1024x768", w: 1024, h: 768 },
  { name: "768x1024", w: 768, h: 1024 },
  { name: "430x932", w: 430, h: 932 },
  { name: "390x844", w: 390, h: 844 },
  { name: "375x812", w: 375, h: 812 },
];

(async () => {
  const b = await chromium.launch();
  let allPass = true;
  for (const vp of VPS) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    await p.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForSelector(".demo-stage-root", { timeout: 30000 });
    await p.waitForTimeout(700); // fresh load, no interaction
    const r = await p.evaluate(() => {
      const inVp = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), inside: b.top >= -0.5 && b.bottom <= window.innerHeight + 0.5 && b.width > 0 && b.height > 0 };
      };
      const view = document.querySelector(".demo-stage-view");
      const num = document.querySelector(".cine-num__value"); // "11 h 35"
      const cta = document.querySelector(".demo-scene-actions .demo-btn, .demo-btn-primary--hero, .demo-shell .demo-btn-primary");
      // Progression : points (desktop) OU libellé de chapitre / barre (mobile, points masqués volontairement).
      const prog = [".demo-progress-dots", ".demo-progress-chap", ".demo-progress-track"]
        .map((s) => document.querySelector(s))
        .find((el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0);
      return {
        docScrollTop: document.documentElement.scrollTop | 0,
        viewScrollTop: view ? view.scrollTop | 0 : -1,
        internalScrollbar: view ? view.scrollHeight > view.clientHeight + 1 : false,
        num: inVp(num),
        cta: inVp(cta),
        progress: inVp(prog),
        noHScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
      };
    });
    const ok = r.docScrollTop === 0 && r.viewScrollTop === 0 && !r.internalScrollbar
      && r.num && r.num.inside && r.cta && r.cta.inside && r.progress && r.progress.inside && r.noHScroll;
    if (!ok) allPass = false;
    console.log(`${ok ? "PASS" : "FAIL"}  ${vp.name}  ` + JSON.stringify({
      scrollTop: r.docScrollTop + "/" + r.viewScrollTop, scrollbar: r.internalScrollbar,
      numTop: r.num && r.num.top, numIn: r.num && r.num.inside, ctaIn: r.cta && r.cta.inside, progIn: r.progress && r.progress.inside,
    }));
  }
  await b.close();
  console.log(allPass ? "FIRST_SCENE_ALL_PASS" : "FIRST_SCENE_FAIL");
  process.exit(allPass ? 0 : 1);
})().catch((e) => { console.log("FATAL", e.message.slice(0, 200)); process.exit(1); });
