/*
 * CloneStore — Service Worker minimal FAIL-SAFE (bloc PWA isolé).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DOCTRINE DE SÉCURITÉ (invariant absolu — ne jamais assouplir) :
 *   Modèle ALLOWLIST « deny-by-default ». Seuls des ASSETS STATIQUES publics et
 *   content-hashés sont mis en cache. TOUT le reste passe en réseau direct et
 *   n'est JAMAIS stocké.
 *
 *   Ne sont JAMAIS mis en cache :
 *     - /api/**                     (réponses API authentifiées, CloneChat, etc.)
 *     - /_next/data/**              (données RSC par-utilisateur / par-tenant)
 *     - toute NAVIGATION (documents HTML)  → réseau d'abord, fallback offline, jamais stocké
 *     - données RH, missions, employés, documents, pièces jointes, tokens
 *     - routes administratives / cockpit  (couvertes : navigations jamais cachées)
 *     - toute origine tierce
 *
 *   Conséquence : aucune donnée d'une entreprise ne peut réapparaître sur un autre
 *   compte ou après déconnexion via le cache. En ligne, le comportement est
 *   identique à l'absence de SW (transparent).
 * ────────────────────────────────────────────────────────────────────────────
 */

// Version tracée SANS secret. Modifier cette valeur = nouveau byte-diff de sw.js
// ⇒ déclenche le flux de mise à jour (updatefound) côté client.
const CLONESTORE_PWA_VERSION = "1.0.0";
const SHELL_CACHE = `clonestore-shell-v${CLONESTORE_PWA_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Assets statiques précachés (aucune donnée sensible ; publics et stables).
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll échoue en bloc si un asset manque : on précache tolérant, un manquant
      // ne doit pas casser l'installation du SW.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch {
            /* asset indisponible : on ignore, fail-safe */
          }
        }),
      );
      // Pas de skipWaiting() automatique : une nouvelle version attend le consentement
      // utilisateur (message SKIP_WAITING) pour ne pas rafraîchir brutalement une saisie.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge des anciens caches (mécanisme de mise à jour + anti-fuite).
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("clonestore-shell-") && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "GET_VERSION") {
    // Réponse de version (traçabilité sans secret) au port du client.
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ type: "VERSION", version: CLONESTORE_PWA_VERSION });
    }
  }
});

/** Assets statiques mis en cache = allowlist stricte deny-by-default. */
function isCacheableStatic(url) {
  const p = url.pathname;
  // Bundles content-hashés et immuables : JS/CSS/fonts. JAMAIS /_next/data (données par-tenant).
  if (p.startsWith("/_next/static/")) return true;
  if (p.startsWith("/icons/")) return true;
  const STATIC_FILES = new Set([
    OFFLINE_URL,
    "/manifest.webmanifest",
    "/favicon.ico",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/favicon-48x48.png",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
  ]);
  return STATIC_FILES.has(p);
}

async function networkThenOffline(request) {
  try {
    // Navigations : réseau D'ABORD. La réponse (potentiellement authentifiée /
    // par-tenant) n'est JAMAIS mise en cache.
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response(
        "Connexion requise pour accéder à votre espace CloneStore.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      )
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      // On ne stocke que des réponses statiques saines et de même origine.
      if (res && res.status === 200 && res.type === "basic") {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // 1) Seules les requêtes GET peuvent toucher le cache. Le reste = réseau direct.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // 2) Origines tierces : bypass total.
  if (url.origin !== self.location.origin) return;

  // 3) API et données RSC : bypass TOTAL, jamais interceptées ni mises en cache.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next/data")) return;

  // 4) Navigations (documents) : réseau d'abord, fallback offline, jamais stockées.
  if (request.mode === "navigate") {
    event.respondWith(networkThenOffline(request));
    return;
  }

  // 5) Assets statiques allowlistés : stale-while-revalidate.
  if (isCacheableStatic(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 6) Tout le reste (même origine, dynamique) : bypass — réseau direct, aucun cache.
  return;
});
