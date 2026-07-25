import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";
import { PWA_COPY } from "@/lib/pwa/constants";

const ROOT = process.cwd();
const pub = (p: string) => path.join(ROOT, "public", p.replace(/^\//, ""));
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Routes réellement stables autorisées dans le manifest (aucune route fictive/authed-deeplink). */
const STABLE_ROUTES = new Set(["/", "/mon-clonestore", "/login", "/installer"]);

describe("Manifest canonique", () => {
  const m = manifest();

  it("champs de base corrects", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBe("CloneStore");
    expect(m.display).toBe("standalone");
    expect(m.scope).toBe("/");
    expect(m.theme_color).toBeTruthy();
    expect(m.background_color).toBeTruthy();
    expect(m.orientation).toBe("portrait");
  });

  it("start_url = route PUBLIQUE sûre (jamais un deep-link authentifié)", () => {
    const start = String(m.start_url);
    const pathnamePart = start.split("?")[0];
    expect(pathnamePart).toBe("/"); // accueil public ; l'auth n'est jamais contournée
  });

  it("déclare au moins une icône maskable et une icône 'any' 512", () => {
    const icons = m.icons ?? [];
    const maskable = icons.filter((i) => String(i.purpose ?? "").includes("maskable"));
    const any512 = icons.filter(
      (i) => i.sizes === "512x512" && String(i.purpose ?? "any").includes("any"),
    );
    expect(maskable.length).toBeGreaterThanOrEqual(1);
    expect(any512.length).toBeGreaterThanOrEqual(1);
  });

  it("toutes les icônes référencées existent réellement sur le disque", () => {
    for (const icon of m.icons ?? []) {
      expect(existsSync(pub(String(icon.src))), `icône manquante: ${icon.src}`).toBe(true);
    }
  });

  it("les raccourcis ne pointent que vers des routes stables", () => {
    for (const s of m.shortcuts ?? []) {
      const route = String(s.url).split("?")[0];
      expect(STABLE_ROUTES.has(route), `raccourci vers route non stable: ${route}`).toBe(true);
    }
  });
});

describe("Service worker — fail-safe (aucun cache sensible)", () => {
  const sw = read("public/sw.js");

  it("API et données RSC : bypass total (jamais interceptées)", () => {
    expect(sw).toContain('url.pathname.startsWith("/api")');
    expect(sw).toContain('url.pathname.startsWith("/_next/data")');
  });

  it("les navigations passent par réseau d'abord et NE sont PAS mises en cache", () => {
    expect(sw).toContain("networkThenOffline");
    // Extrait le corps de networkThenOffline et vérifie l'absence de cache.put.
    const m = sw.match(/async function networkThenOffline[\s\S]*?\n}/);
    expect(m, "networkThenOffline introuvable").toBeTruthy();
    expect(m![0]).not.toMatch(/cache\.put/);
  });

  it("allowlist deny-by-default : seul /_next/static est caché, jamais /_next/data", () => {
    const m = sw.match(/function isCacheableStatic[\s\S]*?\n}/);
    expect(m, "isCacheableStatic introuvable").toBeTruthy();
    // On teste le CODE, pas les commentaires : on retire les commentaires avant l'absence-grep
    // (un commentaire explicatif mentionne légitimement « /_next/data »).
    const body = m![0]
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toContain('/_next/static/');
    expect(body).not.toContain('/_next/data');
  });

  it("gère la mise à jour consentie (SKIP_WAITING) et purge les vieux caches", () => {
    expect(sw).toContain("SKIP_WAITING");
    expect(sw).toContain("skipWaiting()");
    expect(sw).toContain("caches.delete");
  });

  it("ne met en cache aucune requête non-GET", () => {
    expect(sw).toContain('request.method !== "GET"');
  });

  it("ne contient aucun cache aveugle de toutes les requêtes (anti-fuite)", () => {
    // Un SW dangereux ferait `cache.addAll` de pages ou cache.put sur navigation/API.
    expect(sw).not.toMatch(/addAll\(\s*\[?\s*["'`]\/["'`]/); // pas de precache de "/"
  });
});

describe("Page offline neutre", () => {
  it("affiche le message exact, sans faux état synchronisé", () => {
    const html = read("public/offline.html");
    expect(html).toContain(PWA_COPY.offline);
    expect(html.toLowerCase()).not.toContain("synchronis"); // aucun faux « synchronisé »
  });
});

describe("Icônes présentes sur le disque", () => {
  it("tous les formats attendus existent", () => {
    for (const f of [
      "favicon.ico",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon-48x48.png",
      "apple-touch-icon.png",
      "icon-192.png",
      "icon-512.png",
      "icons/maskable-192.png",
      "icons/maskable-512.png",
    ]) {
      expect(existsSync(pub(f)), `manquant: ${f}`).toBe(true);
    }
  });
});
