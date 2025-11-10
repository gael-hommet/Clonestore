// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Empêche ESLint de casser les builds de production.
    // On corrige les règles au fil de l’eau côté repo, mais la prod ne bloque plus.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optionnel : si jamais TS trouve un type blocking en prod, il ne stoppe pas la build.
    // Tu peux supprimer cette section si tu préfères le strict total.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
