import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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
