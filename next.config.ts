import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // @electric-sql/pglite est une devDependency chargée UNIQUEMENT par le chemin
  // dev/E2E local de CloneStory (gardé par CLONESTORY_LOCAL_PGLITE). On le traite
  // comme paquet serveur externe pour qu'il résolve ses assets natifs normalement.
  // Aucun effet en production (jamais importé sans la variable).
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
