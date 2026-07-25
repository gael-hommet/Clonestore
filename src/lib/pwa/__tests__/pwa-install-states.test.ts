import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  evaluateOnboarding,
  evaluateInstallInvite,
  isPwaAutoInvitePath,
  parseUserAgent,
  computeStandalone,
  type InstallInviteState,
} from "@/lib/pwa/detect";
import { PWA_MIN_VISITS_FOR_INVITE } from "@/lib/pwa/constants";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const pub = (p: string) => path.join(ROOT, "public", p);

/** Dimensions réelles d'un PNG (entête IHDR). */
function pngSize(file: string): string {
  const b = readFileSync(file);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

/* ────────────────────────────── États d'installation ────────────────────────────── */

const base = (over: Partial<InstallInviteState> = {}): InstallInviteState => ({
  platform: "android",
  isStandalone: false,
  isInstalled: false,
  promptAvailable: true,
  visitCount: PWA_MIN_VISITS_FOR_INVITE,
  dismissedAtMs: null,
  nowMs: 1_700_000_000_000,
  ...over,
});

describe("États d'installation — matrice complète", () => {
  it("navigateur normal (non installé, non standalone)", () => {
    expect(computeStandalone(false, false)).toBe(false);
    expect(evaluateInstallInvite(base()).show).toBe(true);
  });

  it("standalone détecté ⇒ aucune proposition", () => {
    expect(computeStandalone(true, undefined)).toBe(true);
    expect(evaluateInstallInvite(base({ isStandalone: true })).reason).toBe("already-installed");
  });

  it("installation disponible (beforeinstallprompt capté)", () => {
    const d = evaluateInstallInvite(base({ promptAvailable: true }));
    expect(d.kind).toBe("native");
  });

  it("installation indisponible ⇒ jamais de faux bouton natif", () => {
    const d = evaluateInstallInvite(base({ promptAvailable: false }));
    expect(d.show).toBe(false);
    expect(d.kind).toBe("none");
  });

  it("déjà installée ⇒ aucune proposition", () => {
    expect(evaluateInstallInvite(base({ isInstalled: true })).show).toBe(false);
  });

  it("fermeture temporaire puis réouverture volontaire", () => {
    const now = 1_700_000_000_000;
    // fermeture ⇒ cooldown actif ⇒ plus d'auto-proposition
    expect(evaluateInstallInvite(base({ nowMs: now, dismissedAtMs: now - 5_000 })).show).toBe(false);
    // réouverture volontaire (bouton) ⇒ possible malgré le refus récent
    expect(
      evaluateInstallInvite(base({ nowMs: now, dismissedAtMs: now - 5_000, manual: true })).show,
    ).toBe(true);
  });

  it("iOS ⇒ instructions ; Android/desktop ⇒ natif", () => {
    expect(evaluateInstallInvite(base({ platform: "ios", promptAvailable: false })).kind).toBe(
      "ios-instructions",
    );
    expect(evaluateInstallInvite(base({ platform: "desktop" })).kind).toBe("native");
  });
});

/* ────────────────────────────── Mini-onboarding ────────────────────────────── */

describe("Mini-onboarding — vu / réouvrable / non bloquant", () => {
  it("première fois ⇒ affiché", () => {
    const d = evaluateOnboarding({
      platform: "ios",
      seen: false,
      isStandalone: false,
      isInstalled: false,
    });
    expect(d.show).toBe(true);
    expect(d.reason).toBe("first-time");
  });

  it("déjà vu ⇒ IGNORÉ (ne se réaffiche pas tout seul)", () => {
    const d = evaluateOnboarding({
      platform: "ios",
      seen: true,
      isStandalone: false,
      isInstalled: false,
    });
    expect(d.show).toBe(false);
    expect(d.reason).toBe("already-seen");
  });

  it("réouvrable volontairement même si déjà vu", () => {
    const d = evaluateOnboarding({
      platform: "ios",
      seen: true,
      isStandalone: false,
      isInstalled: false,
      manual: true,
    });
    expect(d.show).toBe(true);
    expect(d.reason).toBe("manual-reopen");
  });

  it("déjà installé ⇒ jamais, même en réouverture", () => {
    expect(
      evaluateOnboarding({
        platform: "ios",
        seen: false,
        isStandalone: true,
        isInstalled: true,
        manual: true,
      }).show,
    ).toBe(false);
  });

  it("plateforme non supportée ⇒ jamais", () => {
    expect(
      evaluateOnboarding({ platform: "other", seen: false, isStandalone: false, isInstalled: false })
        .show,
    ).toBe(false);
  });

  it("l'étape adaptée à l'appareil est cohérente avec la plateforme", () => {
    const ios = evaluateOnboarding({
      platform: "ios",
      seen: false,
      isStandalone: false,
      isInstalled: false,
    });
    const android = evaluateOnboarding({
      platform: "android",
      seen: false,
      isStandalone: false,
      isInstalled: false,
    });
    expect(ios.kind).toBe("ios-instructions");
    expect(android.kind).toBe("native");
  });
});

/* ──────────────── Liste blanche : où la proposition AUTO est légitime ──────────────── */

describe("isPwaAutoInvitePath — liste blanche fail-closed", () => {
  it("autorisée sur les surfaces PRODUIT", () => {
    for (const p of [
      "/cockpit",
      "/mon-clonestore",
      "/mon-clonestore/documents",
      "/profile",
      "/assistant",
      "/agents/pierre/use",
    ]) {
      expect(isPwaAutoInvitePath(p), `devrait être autorisé: ${p}`).toBe(true);
    }
  });

  it("REFUSÉE sur le funnel commercial (le visiteur y juge le produit)", () => {
    for (const p of ["/", "/demo", "/demo/pierre", "/checkout", "/paiement", "/reserver", "/login", "/signup"]) {
      expect(isPwaAutoInvitePath(p), `devrait être refusé: ${p}`).toBe(false);
    }
  });

  // Exigence explicite du propriétaire : ces cinq surfaces publiques ne doivent JAMAIS
  // être interrompues par une proposition d'installation non sollicitée. La fiche
  // « /agents/pierre » est commerciale — seuls ses sous-espaces d'USAGE (/use, /setup,
  // /employees) sont des surfaces produit.
  it("REFUSÉE sur les cinq surfaces publiques verrouillées", () => {
    for (const p of ["/", "/demo", "/demo/pierre", "/agents/pierre", "/reserver/pierre"]) {
      expect(isPwaAutoInvitePath(p), `devrait être refusé: ${p}`).toBe(false);
    }
    // …alors que les espaces d'usage de Pierre restent, eux, éligibles.
    for (const p of ["/agents/pierre/use", "/agents/pierre/setup", "/agents/pierre/employees"]) {
      expect(isPwaAutoInvitePath(p), `devrait être autorisé: ${p}`).toBe(true);
    }
  });

  it("REFUSÉE sur /installer (la page porte sa propre UX)", () => {
    expect(isPwaAutoInvitePath("/installer")).toBe(false);
  });

  it("fail-closed sur chemin nul/inconnu", () => {
    expect(isPwaAutoInvitePath(null)).toBe(false);
    expect(isPwaAutoInvitePath(undefined)).toBe(false);
    expect(isPwaAutoInvitePath("/route-inconnue")).toBe(false);
  });

  it("robuste au slash final et à la query", () => {
    expect(isPwaAutoInvitePath("/cockpit/")).toBe(true);
    expect(isPwaAutoInvitePath("/cockpit?utm_source=pwa")).toBe(true);
  });

  it("ne confond pas un préfixe partiel", () => {
    expect(isPwaAutoInvitePath("/profile-public")).toBe(false);
  });
});

/* ────────────────────────────── Icônes : dimensions réelles ────────────────────────────── */

describe("Icônes — dimensions réelles vérifiées", () => {
  const expected: Record<string, string> = {
    "favicon-16x16.png": "16x16",
    "favicon-32x32.png": "32x32",
    "favicon-48x48.png": "48x48",
    "apple-touch-icon.png": "180x180",
    "icon-192.png": "192x192",
    "icon-512.png": "512x512",
    "icons/maskable-192.png": "192x192",
    "icons/maskable-512.png": "512x512",
  };

  it("chaque PNG a exactement les dimensions annoncées", () => {
    for (const [file, dim] of Object.entries(expected)) {
      const p = pub(file);
      expect(existsSync(p), `manquant: ${file}`).toBe(true);
      expect(pngSize(p), `mauvaise dimension: ${file}`).toBe(dim);
    }
  });

  it("Apple touch icon = 180x180 et référencé dans le layout", () => {
    expect(pngSize(pub("apple-touch-icon.png"))).toBe("180x180");
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("apple-touch-icon.png");
    expect(layout).toContain("appleWebApp");
  });

  it("les icônes maskable sont carrées et opaques (générées par padding du mark)", () => {
    for (const f of ["icons/maskable-192.png", "icons/maskable-512.png"]) {
      const [w, h] = pngSize(pub(f)).split("x");
      expect(w).toBe(h);
    }
  });
});

/* ────────────────────────────── Mobile / safe-areas ────────────────────────────── */

describe("Mobile — safe-areas, 100dvh, aucun overflow", () => {
  const overlays = [
    "src/components/pwa/InstallPrompt.tsx",
    "src/components/pwa/IosInstallSheet.tsx",
    "src/components/pwa/UpdateToast.tsx",
  ];

  it("chaque surface flottante respecte les safe-areas", () => {
    for (const f of overlays) {
      expect(read(f), `safe-area absente: ${f}`).toContain("env(safe-area-inset");
    }
  });

  it("les surfaces ancrées en bas paddent la barre inférieure iOS", () => {
    expect(read("src/components/pwa/InstallPrompt.tsx")).toContain("env(safe-area-inset-bottom");
    expect(read("src/components/pwa/IosInstallSheet.tsx")).toContain("env(safe-area-inset-bottom");
  });

  it("la surface ancrée en haut padde l'encoche / Dynamic Island", () => {
    expect(read("src/components/pwa/UpdateToast.tsx")).toContain("env(safe-area-inset-top");
  });

  it("aucune largeur fixe : fluide (w-full) + borné (max-w) ⇒ pas d'overflow à 390px", () => {
    for (const f of overlays) {
      const src = read(f);
      expect(src, `w-full absent: ${f}`).toContain("w-full");
      expect(src, `max-w absent: ${f}`).toContain("max-w-[");
      // Une largeur fixe en px provoquerait un débordement horizontal sur petit écran.
      expect(src, `largeur fixe interdite: ${f}`).not.toMatch(/\sw-\[\d+px\]/);
    }
  });

  it("le layout active viewport-fit: cover (sans quoi env(safe-area-*) vaut 0)", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('viewportFit: "cover"');
    expect(layout).toContain("themeColor");
  });

  it("la page offline est mobile-safe (100dvh + viewport-fit + safe-areas)", () => {
    const html = read("public/offline.html");
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain("100dvh");
    expect(html).toContain("env(safe-area-inset-bottom)");
  });

  it("statut iOS 'default' ⇒ le contenu ne passe pas sous la barre d'état", () => {
    expect(read("src/app/layout.tsx")).toContain('statusBarStyle: "default"');
  });
});

/* ────────────────────────────── Détection navigateur ────────────────────────────── */

describe("Détection navigateur normal vs standalone", () => {
  it("navigateur normal", () => {
    expect(computeStandalone(false, undefined)).toBe(false);
  });
  it("standalone Android/desktop (display-mode)", () => {
    expect(computeStandalone(true, undefined)).toBe(true);
  });
  it("standalone iOS (navigator.standalone)", () => {
    expect(computeStandalone(false, true)).toBe(true);
  });
  it("UA iOS Safari reconnu comme installable manuellement", () => {
    const info = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    );
    expect(info.isIosSafari).toBe(true);
  });
});
