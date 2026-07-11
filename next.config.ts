import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Répertoire de build ISOLABLE par variable d'environnement. Par défaut `.next` (comportement
  // inchangé — aucun effet sur d'autres sessions/builds). Permet à une preuve navigateur locale
  // de bâtir/servir depuis un distDir dédié (ex. NEXT_DIST_DIR=.next-p942) sans partager `.next`
  // avec un build concurrent. N'affecte jamais la production (variable non définie ⇒ `.next`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Paquets serveurs à NE PAS bundler (bindings natifs résolus normalement à l'exécution) :
  //  - @electric-sql/pglite : devDependency du chemin dev/E2E local de CloneStory ;
  //  - sharp : transformation d'image OBLIGATOIRE de CloneChat (P9.4.2 §9). Externaliser
  //    garantit que le binding natif est chargé tel quel dans le serveur de production
  //    (jamais mangé/mangled par le bundler) — sinon la transformation échouerait et l'image
  //    serait refusée. `pg` (durable CloneChat) est déjà chargé par import dynamique server-only.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
