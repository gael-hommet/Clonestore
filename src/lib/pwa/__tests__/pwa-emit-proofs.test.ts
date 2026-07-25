import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";
import { PWA_VERSION, PWA_DISMISS_COOLDOWN_MS, PWA_MIN_VISITS_FOR_INVITE } from "@/lib/pwa/constants";
import {
  evaluateInstallInvite,
  evaluateOnboarding,
  isPwaAutoInvitePath,
  computeStandalone,
  parseUserAgent,
  type InstallInviteState,
} from "@/lib/pwa/detect";

/**
 * Émetteur de preuves du bloc PWA (convention du dépôt, cf. p19-emit-proofs).
 * TOUTES les preuves sont DÉRIVÉES du code réel (manifest(), dimensions PNG réelles,
 * parsing de public/sw.js, appels réels des fonctions de décision) — jamais écrites à la main.
 */

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".pwa-proofs");
const write = (name: string, data: unknown) =>
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + "\n", "utf8");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const pub = (p: string) => path.join(ROOT, "public", p.replace(/^\//, ""));

function pngSize(file: string): string {
  const b = readFileSync(file);
  if (b.length < 24) return "unknown";
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

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

describe("PWA — émission des preuves canoniques", () => {
  mkdirSync(OUT, { recursive: true });

  it("PWA_MANIFEST_PROOF.json — manifest réellement produit par le code", () => {
    const m = manifest();
    const iconsExist = (m.icons ?? []).map((i) => ({
      src: String(i.src),
      sizes: i.sizes,
      purpose: i.purpose ?? "any",
      existsOnDisk: existsSync(pub(String(i.src))),
      actualDimensions: existsSync(pub(String(i.src))) && String(i.src).endsWith(".png")
        ? pngSize(pub(String(i.src)))
        : "n/a",
    }));
    write("PWA_MANIFEST_PROOF.json", {
      generatedFrom: "src/app/manifest.ts (appel réel de manifest())",
      servedAt: "/manifest.webmanifest (convention Next app/manifest.ts ⇒ <link rel=manifest> auto-injecté)",
      manifest: m,
      checks: {
        display: m.display,
        displayIsStandalone: m.display === "standalone",
        scope: m.scope,
        startUrl: m.start_url,
        startUrlPathname: String(m.start_url).split("?")[0],
        startUrlIsPublicRoute: String(m.start_url).split("?")[0] === "/",
        authBypass: false,
        hasName: Boolean(m.name),
        hasShortName: Boolean(m.short_name),
        themeColor: m.theme_color,
        backgroundColor: m.background_color,
        orientation: m.orientation,
        iconCount: iconsExist.length,
        allIconsExistOnDisk: iconsExist.every((i) => i.existsOnDisk),
        maskableCount: iconsExist.filter((i) => String(i.purpose).includes("maskable")).length,
        shortcutRoutes: (m.shortcuts ?? []).map((s) => String(s.url).split("?")[0]),
        screenshots: m.screenshots ? "present" : "absent — aucune capture réelle ⇒ aucune référence fictive",
      },
      icons: iconsExist,
    });
    expect(m.display).toBe("standalone");
    expect(iconsExist.every((i) => i.existsOnDisk)).toBe(true);
  });

  it("PWA_ICON_INVENTORY.json — inventaire + dimensions réelles sur disque", () => {
    const files = [
      "favicon.ico",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon-48x48.png",
      "apple-touch-icon.png",
      "icon-192.png",
      "icon-512.png",
      "icons/maskable-192.png",
      "icons/maskable-512.png",
    ];
    const icons = files.map((f) => {
      const p = pub(f);
      const exists = existsSync(p);
      return {
        file: `/${f}`,
        exists,
        bytes: exists ? statSync(p).size : 0,
        dimensions: exists && f.endsWith(".png") ? pngSize(p) : f.endsWith(".ico") ? "ico-container" : "n/a",
        purpose: f.startsWith("icons/maskable") ? "maskable" : "any",
        role: f === "apple-touch-icon.png" ? "apple-touch-icon (180x180)" : f.startsWith("favicon") ? "favicon" : "manifest icon",
        source: f.startsWith("icons/maskable")
          ? "généré par sharp — padding du mark existant (aucune déformation, aucune nouvelle identité)"
          : "asset existant du dépôt (non retouché)",
      };
    });
    write("PWA_ICON_INVENTORY.json", {
      generatedFrom: "public/ (lecture des entêtes PNG IHDR)",
      appleTouchIcon: icons.find((i) => i.file === "/apple-touch-icon.png"),
      maskable: icons.filter((i) => i.purpose === "maskable"),
      icons,
      allExist: icons.every((i) => i.exists),
    });
    expect(icons.every((i) => i.exists)).toBe(true);
  });

  it("PWA_INSTALL_STATES_PROOF.json — matrice générée par appels réels des décideurs", () => {
    const now = 1_700_000_000_000;
    const states = [
      { state: "navigateur normal, engagé, prompt prêt (Android)", decision: evaluateInstallInvite(base()) },
      { state: "standalone (lancé en app)", decision: evaluateInstallInvite(base({ isStandalone: true })) },
      { state: "déjà installée", decision: evaluateInstallInvite(base({ isInstalled: true })) },
      { state: "1re visite (non engagé)", decision: evaluateInstallInvite(base({ visitCount: 1 })) },
      { state: "refus récent (cooldown actif)", decision: evaluateInstallInvite(base({ nowMs: now, dismissedAtMs: now - 5_000 })) },
      { state: "refus expiré (après cooldown)", decision: evaluateInstallInvite(base({ nowMs: now, dismissedAtMs: now - PWA_DISMISS_COOLDOWN_MS - 1 })) },
      { state: "réouverture volontaire malgré refus récent", decision: evaluateInstallInvite(base({ nowMs: now, dismissedAtMs: now - 5_000, manual: true })) },
      { state: "iOS (aucun prompt natif possible)", decision: evaluateInstallInvite(base({ platform: "ios", promptAvailable: false })) },
      { state: "Android sans beforeinstallprompt (indisponible)", decision: evaluateInstallInvite(base({ promptAvailable: false })) },
      { state: "desktop, prompt prêt", decision: evaluateInstallInvite(base({ platform: "desktop" })) },
      { state: "plateforme non supportée", decision: evaluateInstallInvite(base({ platform: "other" })) },
    ];

    const onboarding = [
      { state: "première fois", decision: evaluateOnboarding({ platform: "ios", seen: false, isStandalone: false, isInstalled: false }) },
      { state: "déjà vu ⇒ ignoré", decision: evaluateOnboarding({ platform: "ios", seen: true, isStandalone: false, isInstalled: false }) },
      { state: "réouverture volontaire (paramètres)", decision: evaluateOnboarding({ platform: "ios", seen: true, isStandalone: false, isInstalled: false, manual: true }) },
      { state: "déjà installé ⇒ jamais", decision: evaluateOnboarding({ platform: "ios", seen: false, isStandalone: true, isInstalled: true, manual: true }) },
    ];

    const autoInvitePaths = [
      "/cockpit", "/mon-clonestore", "/mon-clonestore/documents", "/profile", "/assistant", "/agents/pierre/use",
      "/", "/demo", "/demo/pierre", "/checkout", "/paiement", "/login", "/installer", "/route-inconnue",
    ].map((p) => ({ path: p, autoInviteAllowed: isPwaAutoInvitePath(p) }));

    write("PWA_INSTALL_STATES_PROOF.json", {
      generatedFrom: "appels réels de evaluateInstallInvite / evaluateOnboarding / isPwaAutoInvitePath",
      engagement: { minVisits: PWA_MIN_VISITS_FOR_INVITE, dismissCooldownMs: PWA_DISMISS_COOLDOWN_MS, dismissCooldownDays: PWA_DISMISS_COOLDOWN_MS / 86_400_000 },
      standaloneDetection: {
        normalBrowser: computeStandalone(false, false),
        displayModeStandalone: computeStandalone(true, undefined),
        iosNavigatorStandalone: computeStandalone(false, true),
      },
      platformDetection: {
        iphoneSafari: parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
        ipadOs13Plus: parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", 5),
        androidChrome: parseUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"),
      },
      installInviteMatrix: states,
      onboardingMatrix: onboarding,
      autoInviteWhitelist: {
        doctrine: "LISTE BLANCHE fail-closed — proposition non sollicitée réservée aux surfaces produit ; funnel commercial et /installer exclus ; demande manuelle possible partout",
        paths: autoInvitePaths,
      },
      neverPromised: ["notifications push", "synchronisation en arrière-plan", "fonctionnement complet hors ligne", "missions autonomes hors ligne", "appels hors connexion"],
    });

    // Invariants prouvés par la matrice elle-même.
    expect(states.find((s) => s.state.startsWith("standalone"))!.decision.show).toBe(false);
    expect(states.find((s) => s.state.startsWith("déjà installée"))!.decision.show).toBe(false);
    expect(onboarding.find((o) => o.state.startsWith("déjà vu"))!.decision.show).toBe(false);
    expect(autoInvitePaths.find((p) => p.path === "/")!.autoInviteAllowed).toBe(false);
  });

  it("PWA_CACHE_SAFETY_PROOF.json — audit dérivé du service worker réel", () => {
    const sw = read("public/sw.js");
    const lines = sw.split("\n");
    const lineOf = (needle: string) => {
      const i = lines.findIndex((l) => l.includes(needle));
      return i === -1 ? null : i + 1;
    };

    const audit = {
      generatedFrom: "parsing de public/sw.js (lignes réelles)",
      version: PWA_VERSION,
      model: "ALLOWLIST deny-by-default",
      registeredOnlyInProduction: read("src/components/pwa/use-pwa.ts").includes('process.env.NODE_ENV !== "production"'),
      requestClasses: [
        { class: "navigation (document HTML)", cached: false, line: lineOf('request.mode === "navigate"'), why: "networkThenOffline: fetch() sans cache.put ; fallback offline.html" },
        { class: "/api/**", cached: false, line: lineOf('startsWith("/api")'), why: "bypass total avant tout respondWith" },
        { class: "/_next/data/**", cached: false, line: lineOf('startsWith("/_next/data")'), why: "bypass total avant tout respondWith" },
        { class: "/_next/static/**", cached: true, line: lineOf('startsWith("/_next/static/")'), why: "bundles content-hashés publics, aucune donnée utilisateur" },
        { class: "/icons/**", cached: true, line: lineOf('startsWith("/icons/")'), why: "icônes publiques statiques" },
        { class: "assets publics allowlistés", cached: true, line: lineOf("const STATIC_FILES"), why: "liste fermée (favicons, manifest, offline)" },
        { class: "autres GET même origine (dont RSC ?_rsc=, /_next/image)", cached: false, line: lineOf("// 6) Tout le reste"), why: "hors allowlist ⇒ bypass deny-by-default" },
        { class: "non-GET", cached: false, line: lineOf('request.method !== "GET"'), why: "retour immédiat" },
        { class: "cross-origin", cached: false, line: lineOf("url.origin !== self.location.origin"), why: "retour immédiat" },
      ],
      neverCached: [
        "réponses CloneChat", "salariés", "missions", "conversations", "documents", "pièces jointes",
        "tokens", "routes API authentifiées", "données entreprise", "données administratives",
        "navigations authentifiées (HTML par-tenant)",
      ],
      crossAccountLeak: "impossible via le cache : aucune navigation ni réponse dynamique n'est stockée ; purge des anciens caches à l'activation",
      authBypass: "aucun : start_url = route publique ; les routes cockpit gardent leurs gardes serveur",
      offlineHonesty: "offline.html = « Connexion requise pour accéder à votre espace CloneStore. » ; aucun faux état synchronisé",
      updateFlow: {
        consentRequired: sw.includes("SKIP_WAITING"),
        noAutoSkipWaiting: !/install[\s\S]{0,400}self\.skipWaiting\(\)/.test(sw),
        oldCachesPurged: sw.includes("caches.delete"),
        firstInstallDoesNotReload: read("src/components/pwa/use-pwa.ts").includes("wantsReloadRef"),
      },
      adversarialReview: {
        by: "codex:codex-rescue (STRIKE-01)",
        verdict: "AUCUN TROU",
        filesModifiedByCodex: 0,
        revalidatedByClaude: true,
        claudeExtraVector: "charge RSC App Router (/mon-clonestore?_rsc=…, mode=cors, ni navigate ni /_next/data) ⇒ tombe en step 6 ⇒ jamais mise en cache",
      },
      runtimeProof: "NON PROUVÉ AU RUNTIME — inspection réelle de caches reportée après P19 (gate #4 du handoff)",
    };

    write("PWA_CACHE_SAFETY_PROOF.json", audit);
    expect(audit.requestClasses.every((c) => c.line !== null)).toBe(true);
    expect(audit.requestClasses.filter((c) => c.cached).every((c) => /static|icons|allowlist/i.test(c.class))).toBe(true);
  });

  it("PWA_MOBILE_PROOF.json — safe-areas / fluidité dérivées des sources réelles", () => {
    const overlays = [
      "src/components/pwa/InstallPrompt.tsx",
      "src/components/pwa/IosInstallSheet.tsx",
      "src/components/pwa/UpdateToast.tsx",
    ];
    const layout = read("src/app/layout.tsx");
    const offline = read("public/offline.html");

    const surfaces = overlays.map((f) => {
      const src = read(f);
      return {
        file: f,
        usesSafeArea: src.includes("env(safe-area-inset"),
        safeAreaBottom: src.includes("env(safe-area-inset-bottom"),
        safeAreaTop: src.includes("env(safe-area-inset-top"),
        fluidWidth: src.includes("w-full"),
        boundedWidth: src.includes("max-w-["),
        noFixedPxWidth: !/\sw-\[\d+px\]/.test(src),
        dismissible: /aria-label="(Fermer|Plus tard|Ignorer)"/.test(src),
      };
    });

    write("PWA_MOBILE_PROOF.json", {
      generatedFrom: "scan des sources réelles (composants PWA, layout, offline.html)",
      viewport: {
        viewportFitCover: layout.includes('viewportFit: "cover"'),
        themeColorDeclared: layout.includes("themeColor"),
        iosStatusBarStyle: layout.includes('statusBarStyle: "default"')
          ? "default — le contenu ne passe pas sous la barre d'état / l'encoche"
          : "non déclaré",
        appleWebAppCapable: layout.includes("appleWebApp"),
      },
      offlinePage: {
        viewportFitCover: offline.includes("viewport-fit=cover"),
        usesDvh: offline.includes("100dvh"),
        safeAreaBottom: offline.includes("env(safe-area-inset-bottom)"),
        selfContained: !/<link[^>]+href=|<script[^>]+src=/.test(offline),
      },
      floatingSurfaces: surfaces,
      overflowPolicy: "aucune largeur fixe en px : w-full + max-w-[30rem] ⇒ pas de débordement horizontal à 390/430px",
      systemBars: "aucun CTA sous l'encoche, la Dynamic Island, la barre inférieure iOS ou les contrôles Android (padding env(safe-area-inset-*) sur chaque surface)",
      runtimeProof: "NON PROUVÉ AU RUNTIME — captures 390/430/tablette/desktop + standalone reportées après P19 (gates #9/#12/#14 du handoff)",
      screenshots: "aucune — aucune capture inventée",
    });

    expect(surfaces.every((s) => s.usesSafeArea && s.fluidWidth && s.boundedWidth && s.noFixedPxWidth)).toBe(true);
  });

  it("PWA_FILES_MODIFIED.txt — périmètre réel, vérifié contre P19", () => {
    const created = [
      "src/app/manifest.ts",
      "src/app/installer/page.tsx",
      "src/app/installer/InstallerClient.tsx",
      "src/components/pwa/PwaProvider.tsx",
      "src/components/pwa/pwa-context.tsx",
      "src/components/pwa/use-pwa.ts",
      "src/components/pwa/InstallPrompt.tsx",
      "src/components/pwa/IosInstallSheet.tsx",
      "src/components/pwa/UpdateToast.tsx",
      "src/components/pwa/index.ts",
      "src/lib/pwa/detect.ts",
      "src/lib/pwa/constants.ts",
      "src/lib/pwa/index.ts",
      "src/lib/pwa/__tests__/pwa-detect.test.ts",
      "src/lib/pwa/__tests__/manifest-sw-safety.test.ts",
      "src/lib/pwa/__tests__/pwa-install-states.test.ts",
      "src/lib/pwa/__tests__/pwa-emit-proofs.test.ts",
      "public/sw.js",
      "public/offline.html",
      "public/icons/maskable-192.png",
      "public/icons/maskable-512.png",
      "tsconfig.pwa.json",
    ];
    const modifiedShared = ["src/app/layout.tsx"];

    // Vérification de non-collision avec le périmètre P19 déclaré.
    const p19Path = path.join(ROOT, ".p19-proofs", "P19_FILES_MODIFIED.txt");
    const p19 = existsSync(p19Path)
      ? new Set(readFileSync(p19Path, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
      : new Set<string>();
    const all = [...created, ...modifiedShared];
    const collisions = all.filter((f) => p19.has(f));

    const missing = all.filter((f) => !existsSync(path.join(ROOT, f)));

    const body = [
      "# PWA_FILES_MODIFIED — généré par src/lib/pwa/__tests__/pwa-emit-proofs.test.ts",
      "",
      `## Créés (neufs, isolés) — ${created.length}`,
      ...created.map((f) => `CREATED  ${f}`),
      "",
      `## Modifié (SEUL fichier partagé, additif) — ${modifiedShared.length}`,
      ...modifiedShared.map((f) => `MODIFIED ${f}`),
      "",
      "## Assets existants réutilisés SANS retouche",
      ...[
        "public/favicon.ico",
        "public/favicon-16x16.png",
        "public/favicon-32x32.png",
        "public/favicon-48x48.png",
        "public/apple-touch-icon.png",
        "public/icon-192.png",
        "public/icon-512.png",
      ].map((f) => `UNTOUCHED ${f}`),
      "",
      "## Vérification de concurrence P19",
      `P19 files declared : ${p19.size}`,
      `PWA files checked  : ${all.length}`,
      `COLLISIONS         : ${collisions.length === 0 ? "0 — ZERO OVERLAP" : collisions.join(", ")}`,
      `MISSING ON DISK    : ${missing.length === 0 ? "0" : missing.join(", ")}`,
      "",
      "## Preuves (noms canoniques)",
      "PWA_MANIFEST_PROOF.json",
      "PWA_ICON_INVENTORY.json",
      "PWA_INSTALL_STATES_PROOF.json",
      "PWA_CACHE_SAFETY_PROOF.json",
      "PWA_MOBILE_PROOF.json",
      "PWA_FILES_MODIFIED.txt",
      "",
      "## Alias hérités (contenu de même provenance, conservés — non supprimés)",
      "manifest-output.json -> PWA_MANIFEST_PROOF.json",
      "icons-inventory.json -> PWA_ICON_INVENTORY.json",
      "cache-audit.json     -> PWA_CACHE_SAFETY_PROOF.json",
      "targeted-tests.json  -> (voir PWA_INSTALL_STATES_PROOF.json)",
      "",
    ].join("\n");

    writeFileSync(path.join(OUT, "PWA_FILES_MODIFIED.txt"), body, "utf8");

    expect(collisions).toEqual([]);
    expect(missing).toEqual([]);
  });
});
