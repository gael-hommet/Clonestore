import type { MetadataRoute } from "next";

/**
 * Manifest canonique CloneStore (PWA).
 *
 * Bloc PWA isolé — n'importe AUCUN module P19. Généré par la convention Next
 * `app/manifest.ts` : Next injecte automatiquement `<link rel="manifest" href="/manifest.webmanifest">`
 * dans le <head>, sans qu'on ait à éditer le layout pour le lien.
 *
 * Règles :
 *  - `start_url` = route PUBLIQUE sûre. Ne JAMAIS pointer vers un deep-link authentifié :
 *    les routes du cockpit (`/mon-clonestore`, ...) restent protégées par leurs gardes serveur
 *    et redirigent vers `/login` si la session est absente. L'auth n'est jamais contournée.
 *  - Icônes `any` = logo existant ; icônes `maskable` = variantes générées par padding du même
 *    logo (aucune déformation).
 *  - `shortcuts` uniquement vers des routes réellement stables.
 *  - Pas de `screenshots` tant qu'aucune capture réelle n'existe (pas de référence fictive).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CloneStore — Pierre, votre RH augmenté",
    short_name: "CloneStore",
    description:
      "CloneStore — accédez à Pierre, votre employé RH IA premium, directement depuis votre écran d'accueil.",
    id: "/",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    theme_color: "#f8f4ec",
    background_color: "#f8f4ec",
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Mon espace CloneStore",
        short_name: "Mon espace",
        description: "Retrouvez votre cockpit et Pierre.",
        url: "/mon-clonestore?utm_source=pwa-shortcut",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Se connecter",
        short_name: "Connexion",
        description: "Accédez à votre compte CloneStore.",
        url: "/login?utm_source=pwa-shortcut",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Installer CloneStore",
        short_name: "Installer",
        description: "Guide d'installation et état de l'application.",
        url: "/installer?utm_source=pwa-shortcut",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
