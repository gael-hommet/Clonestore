// src/lib/clonestore/cloneos/__tests__/cloneos-shell-invariants.test.ts
// P12 §13.2/13.4/13.5/13.7 — invariants du shell : no-page-scroll déclaré, surfaces présentes,
// participants CloneRoom, cadrage Pierre, absence de confusion produit. Vérifie la config nav +
// scanne les sources réelles (comme la preuve de framing P9.6) — attrape les régressions.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COCKPIT_RAIL_NAV, COCKPIT_BOTTOM_NAV } from "@/components/cloneos/cloneos-nav";
import { CLONEOS_ROUTES } from "../cloneos-app-shell-contract";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const SHELL = "src/components/cloneos/CloneOsAppShell.tsx";
const GLOBALS = "src/app/globals.css";
const ROOM = "src/components/cloneroom/CloneRoomConsole.tsx";
const PIERRE = "src/components/cockpit/PierreCockpitConsole.tsx";
const GLOBAL_COCKPIT = "src/components/cockpit/GlobalCockpitConsole.tsx";
const MON = "src/components/mon-clonestore/MonCloneStoreShell.tsx";
const CMD = "src/components/cloneos/CloneOsCommandSurface.tsx";
const COMPOSER = "src/components/pierre/cockpit/MissionComposer.tsx";

describe("P12 CloneOS shell invariants", () => {
  it("nav config aligns with the contract routes (rail + bottom nav)", () => {
    expect(COCKPIT_RAIL_NAV.find((n) => n.key === "cockpit")?.href).toBe(CLONEOS_ROUTES.cockpit);
    expect(COCKPIT_RAIL_NAV.find((n) => n.key === "room")?.href).toBe(CLONEOS_ROUTES.cloneRoom);
    expect(COCKPIT_RAIL_NAV.find((n) => n.key === "pierre")?.href).toBe(CLONEOS_ROUTES.pierre);
    // §13.4 mobile: CloneOS / Missions / Validations / Employés / Mon CloneStore reachable in the bottom nav
    const bottomKeys = COCKPIT_BOTTOM_NAV.map((n) => n.key);
    expect(bottomKeys).toEqual(["cockpit", "missions", "validations", "employees", "mon_clonestore"]);
    expect(COCKPIT_BOTTOM_NAV.find((n) => n.key === "mon_clonestore")?.href).toBe(CLONEOS_ROUTES.monClonestore);
  });

  it("§13.4 globals.css declares the no-page-scroll console (cos-root 100dvh + overflow hidden + surfaces)", () => {
    const css = read(GLOBALS);
    expect(css).toContain(".cos-root");
    expect(css).toMatch(/\.cos-root[\s\S]*?height:\s*100dvh/);
    expect(css).toMatch(/\.cos-root[\s\S]*?overflow:\s*hidden/);
    // internal scroll allowed on the main content
    expect(css).toContain(".cos-main-scroll");
    expect(css).toMatch(/\.cos-main-scroll[\s\S]*?overflow-y:\s*auto/);
    // bottom nav only on mobile; rail hidden on mobile
    expect(css).toContain(".cos-bottomnav");
    expect(css).toMatch(/max-width:\s*767px[\s\S]*?\.cos-rail\s*\{\s*display:\s*none/);
  });

  it("§13.4 the app shell renders top bar + rail + main + context + bottom nav surfaces", () => {
    const s = read(SHELL);
    for (const cls of ["cos-root", "cos-topbar", "cos-rail", "cos-main", "cos-context", "cos-bottomnav"]) {
      expect(s).toContain(cls);
    }
    // testids for the browser proof
    for (const t of ["cos-topbar", "cos-rail", "cos-main", "cos-context", "cos-bottomnav", "cos-context-drawer"]) {
      expect(s).toContain(t);
    }
  });

  it("§13.7 Pierre is framed as AI HR employee, NEVER assistant/chatbot/copilote in the console surfaces", () => {
    const pierre = read(PIERRE);
    expect(pierre).toContain("Employé IA RH");
    // scan the surface sources; allow the technical /assistant route path but no Pierre-as-assistant role
    for (const file of [PIERRE, GLOBAL_COCKPIT, CMD, ROOM]) {
      const txt = read(file).toLowerCase().replace(/\/assistant/g, "").replace(/\/api\/assistant/g, "");
      expect(txt).not.toMatch(/pierre[^.\n]{0,24}(assistant|chatbot|copilote|copilot|cobot)/);
      expect(txt).not.toContain("assistant rh");
    }
  });

  it("§13.2 no product confusion (CloneOS coordinates ≠ executes HR; CloneRoom ≠ cockpit; Mon CloneStore ≠ cockpit)", () => {
    // CloneOS command surface states it coordinates and Pierre executes HR
    const cmd = read(CMD);
    expect(cmd).toMatch(/coordonne.*Pierre.*exécute/i);
    // CloneRoom explicitly is not the Global Cockpit / does not replace Pierre
    const room = read(ROOM);
    expect(room).toMatch(/N'est PAS le Global Cockpit|ne remplace pas Pierre/i);
    // Mon CloneStore is distinct: "gérer, pas travailler" + links to the cockpit
    const mon = read(MON);
    expect(mon).toMatch(/gérer|Le travail se fait dans le Cockpit/i);
    expect(mon).toContain("CLONEOS_ROUTES.cockpit"); // explicit "open cockpit" link (distinct spaces)
    expect(mon).toContain("mon-clonestore-open-cockpit");
  });

  it("§13.5 CloneRoom renders the contract participants (CloneOS + Pierre + Empreinte + memory)", () => {
    const room = read(ROOM);
    expect(room).toContain("CLONEROOM_PARTICIPANTS");
    expect(room).toContain("data-testid=\"cloneroom-participants\"");
    expect(room).toContain("data-testid=\"cloneroom-composer\"");
    // messages can become missions (action extraction)
    expect(room).toMatch(/En faire une mission|Créer une mission RH/);
  });

  it("§13.5 action extraction is CONTENT-CARRYING (message text → Pierre's real composer), not a static route", () => {
    // CloneRoom builds a compose route from the message's OWN content (encoded), not a fixed URL
    const room = read(ROOM);
    expect(room).toContain("composeMissionRoute");
    expect(room).toContain("encodeURIComponent");
    expect(room).toContain("?compose=");
    // the per-message button uses that message's sourceText/text; the context button uses lastHuman
    expect(room).toContain("composeMissionRoute(m.sourceText ?? m.text)");
    expect(room).toContain("composeMissionRoute(lastHuman)");
    // Pierre's console reads ?compose and seeds the REAL composer (no HR logic reimplemented)
    const pierre = read(PIERRE);
    expect(pierre).toContain("\"compose\"");
    expect(pierre).toContain("initialValue={missionSeed}");
    // The P9.3 composer accepts the seed additively (empty seed = unchanged behavior)
    const composer = read(COMPOSER);
    expect(composer).toContain("initialValue");
    expect(composer).toMatch(/if\s*\(open\s*&&\s*initialValue\)\s*setInput\(initialValue\)/);
  });

  it("§13.6 Global Cockpit shows CloneOS first + workforce + validations + missions in context", () => {
    const g = read(GLOBAL_COCKPIT);
    expect(g).toContain("CloneOsCommandSurface"); // CloneOS first screen
    expect(g).toContain("Main-d'œuvre IA");        // workforce pane
    expect(g).toContain("Validations en attente");
    expect(g).toContain("Missions en cours");
    expect(g).toContain("global-context");         // context pane testid
  });
});
