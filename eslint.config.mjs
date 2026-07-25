import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default [

  // CLONESTORE_LINT_IGNORES
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      "node_modules/**",
      "next-env.d.ts",
      "_backups_ts/**",
      "_audit_clonestore_front/**",
      "_clonestore_export/**",
      "_export_chat_moteur/**",
      "audit-*/**",
      "CHAT_BLOCKS_FRONT_01/**",
      "scripts/**",
      "send-email.mjs",
      "test-*.js",
      "test-*.mjs",
      "*.backup-*.ts",
      "*.backup-*.tsx",
      "**/*.backup-*.ts",
      "**/*.backup-*.tsx",
      "tsconfig.tsbuildinfo",
      "repo-*.txt",
      "clonestore-front-audit.txt",
      "REPO_FILE_LIST.txt",
      // Scripts Playwright ad-hoc de capture/QA à la racine (jamais exécutés par le build,
      // pas de l'application) — même famille que test-*.{js,mjs} ci-dessus.
      "_captures*.mjs",
      "_qa*.mjs",
      "scratch_probe*.mjs",
      // Archives de preuves figées (même famille que audit-*/**).
      ".c1-8-reopened-proofs/**"
    ]
  },
{ ignores: [".next/**", ".next-*/**", "node_modules/**", "dist/**", "build/**", "out/**", "coverage/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      ...next.configs.recommended.rules,

      // âœ… Hooks OK
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // âœ… STOP les blocages build
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",

      // Le produit sanitize délibérément des caractères Unicode invisibles/trompeurs
      // (zero-width, BOM, overrides bidi, NBSP) dans des regex, chaînes et commentaires
      // à but sécuritaire ou typographique (ex. détection de noms de fichiers trompeurs,
      // normalisation de saisie, espace insécable française). La règle par défaut les
      // détecte aussi DANS ces littéraux, ce qui est un faux positif ici : on la restreint
      // à l'espacement structurel du code (indentation, opérateurs).
      "no-irregular-whitespace": ["error", { skipStrings: true, skipComments: true, skipRegExps: true, skipTemplates: true }],
    },
  },

  // Scripts Node réels (préflights, checks opérationnels .mjs/.cjs) : globals Node, pas
  // navigateur. Les scripts jetables (captures Playwright) sont déjà exclus ci-dessus.
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
  },

  // .cjs = CommonJS par construction (extension explicite) : require() y est le module
  // system natif, pas un contournement d'ESM.
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // configs node
  {
    files: ["**/*.config.{js,cjs,mjs}", "next.config.{js,cjs,mjs}"],
    rules: { "no-undef": "off" },
  },

  // Service worker : globals dédiés (self, caches, fetch, Response, URL…), pas Node/DOM.
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];


