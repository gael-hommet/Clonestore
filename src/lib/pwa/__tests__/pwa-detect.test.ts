import { describe, it, expect } from "vitest";
import {
  parseUserAgent,
  computeStandalone,
  evaluateInstallInvite,
  isDismissalActive,
  describeDevice,
  type InstallInviteState,
} from "@/lib/pwa/detect";
import { PWA_DISMISS_COOLDOWN_MS, PWA_MIN_VISITS_FOR_INVITE } from "@/lib/pwa/constants";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  ipadOs:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  bot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

describe("parseUserAgent — plateforme", () => {
  it("détecte iPhone Safari", () => {
    const r = parseUserAgent(UA.iphoneSafari);
    expect(r.platform).toBe("ios");
    expect(r.isIos).toBe(true);
    expect(r.isIosSafari).toBe(true);
  });

  it("iOS Chrome (CriOS) n'est pas Safari (flux add-to-home indisponible)", () => {
    const r = parseUserAgent(UA.iphoneChrome);
    expect(r.platform).toBe("ios");
    expect(r.isIosSafari).toBe(false);
  });

  it("détecte Android", () => {
    const r = parseUserAgent(UA.androidChrome);
    expect(r.platform).toBe("android");
    expect(r.isAndroid).toBe(true);
    expect(r.isIos).toBe(false);
  });

  it("détecte desktop", () => {
    expect(parseUserAgent(UA.desktopChrome).platform).toBe("desktop");
  });

  it("iPadOS 13+ (UA Macintosh + tactile) est bien iOS", () => {
    expect(parseUserAgent(UA.ipadOs, 5).platform).toBe("ios");
    // Sans tactile, un vrai Mac reste desktop
    expect(parseUserAgent(UA.ipadOs, 0).platform).toBe("desktop");
  });

  it("un bot/UA inconnu tombe en 'other'", () => {
    expect(parseUserAgent(UA.bot).platform).toBe("other");
    expect(parseUserAgent("").platform).toBe("other");
  });
});

describe("computeStandalone", () => {
  it("vrai si display-mode standalone", () => {
    expect(computeStandalone(true, undefined)).toBe(true);
  });
  it("vrai si navigator.standalone (iOS installé)", () => {
    expect(computeStandalone(false, true)).toBe(true);
  });
  it("faux en navigateur normal", () => {
    expect(computeStandalone(false, false)).toBe(false);
    expect(computeStandalone(false, undefined)).toBe(false);
  });
});

const base = (over: Partial<InstallInviteState> = {}): InstallInviteState => ({
  platform: "android",
  isStandalone: false,
  isInstalled: false,
  promptAvailable: true,
  visitCount: PWA_MIN_VISITS_FOR_INVITE,
  dismissedAtMs: null,
  nowMs: 1_000_000_000_000,
  ...over,
});

describe("evaluateInstallInvite — non agressif & honnête", () => {
  it("Android engagé + prompt prêt ⇒ proposition native", () => {
    const d = evaluateInstallInvite(base());
    expect(d).toEqual({ show: true, kind: "native", reason: "native-prompt-ready" });
  });

  it("déjà installé (standalone) ⇒ jamais de proposition", () => {
    expect(evaluateInstallInvite(base({ isStandalone: true })).show).toBe(false);
    expect(evaluateInstallInvite(base({ isInstalled: true })).reason).toBe("already-installed");
  });

  it("iOS ⇒ instructions Partager (jamais prompt natif)", () => {
    const d = evaluateInstallInvite(base({ platform: "ios", promptAvailable: false }));
    expect(d.show).toBe(true);
    expect(d.kind).toBe("ios-instructions");
  });

  it("première visite ⇒ pas de proposition non sollicitée", () => {
    const d = evaluateInstallInvite(base({ visitCount: 1 }));
    expect(d.show).toBe(false);
    expect(d.reason).toBe("not-engaged-yet");
  });

  it("refus récent ⇒ cooldown, pas de réaffichage", () => {
    const now = 1_000_000_000_000;
    const d = evaluateInstallInvite(
      base({ nowMs: now, dismissedAtMs: now - 60_000 }),
    );
    expect(d.show).toBe(false);
    expect(d.reason).toBe("in-cooldown");
  });

  it("refus puis réouverture après le cooldown ⇒ re-proposable", () => {
    const now = 1_000_000_000_000;
    const d = evaluateInstallInvite(
      base({ nowMs: now, dismissedAtMs: now - PWA_DISMISS_COOLDOWN_MS - 1 }),
    );
    expect(d.show).toBe(true);
    expect(d.kind).toBe("native");
  });

  it("demande MANUELLE court-circuite l'engagement mais pas l'état installé", () => {
    // manuel, première visite, refus récent : on montre quand même (l'utilisateur a cliqué)
    const now = 1_000_000_000_000;
    const manual = evaluateInstallInvite(
      base({ manual: true, visitCount: 0, dismissedAtMs: now - 1000, nowMs: now }),
    );
    expect(manual.show).toBe(true);
    // ... sauf si déjà installé
    expect(
      evaluateInstallInvite(base({ manual: true, isStandalone: true })).show,
    ).toBe(false);
  });

  it("Android sans beforeinstallprompt : honnête (pas de faux bouton natif)", () => {
    const auto = evaluateInstallInvite(base({ promptAvailable: false }));
    expect(auto.show).toBe(false);
    expect(auto.reason).toBe("native-prompt-not-ready");
    const manual = evaluateInstallInvite(base({ promptAvailable: false, manual: true }));
    expect(manual.show).toBe(false);
    expect(manual.reason).toBe("native-prompt-unavailable");
  });

  it("plateforme non supportée ⇒ rien", () => {
    expect(evaluateInstallInvite(base({ platform: "other" })).reason).toBe(
      "unsupported-platform",
    );
  });
});

describe("isDismissalActive", () => {
  const now = 2_000_000_000_000;
  it("null ⇒ inactif", () => expect(isDismissalActive(null, now)).toBe(false));
  it("récent ⇒ actif", () =>
    expect(isDismissalActive(now - 1000, now)).toBe(true));
  it("expiré ⇒ inactif", () =>
    expect(isDismissalActive(now - PWA_DISMISS_COOLDOWN_MS - 1, now)).toBe(false));
});

describe("describeDevice", () => {
  it("libellés lisibles", () => {
    expect(describeDevice(parseUserAgent(UA.iphoneSafari))).toContain("iPhone");
    expect(describeDevice(parseUserAgent(UA.androidChrome))).toBe("Android");
    expect(describeDevice(parseUserAgent(UA.desktopChrome))).toBe("Ordinateur");
    expect(describeDevice(parseUserAgent(UA.bot))).toContain("non reconnu");
  });
});
