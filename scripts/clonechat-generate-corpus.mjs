#!/usr/bin/env node
// scripts/clonechat-generate-corpus.mjs
//
// CloneChat Unified Intelligence — génération DÉTERMINISTE du corpus CloneStore.
//
// Exécute le vrai module runtime (src/lib/clonechat/core/knowledge-corpus.ts) à travers vitest
// (qui résout déjà l'alias `@` vers `src/`, comme le reste du projet — voir vitest.config.ts),
// via un test-générateur dédié gated par la variable d'environnement CLONECHAT_GENERATE_CORPUS.
// Écrit un instantané JSON versionné + un manifeste (hash de contenu, comptage par catégorie),
// et ÉCHOUE si une catégorie obligatoire disparaît (garde anti-régression du corpus).
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", "src/lib/clonechat/core/__tests__/generate-corpus.gen.test.ts", "--reporter=verbose"],
  { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, CLONECHAT_GENERATE_CORPUS: "1" } },
);
process.exit(result.status ?? 1);
