import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

export default [
  
  // CLONESTORE_LINT_IGNORES
  {
    ignores: [
      ".next/**",
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
      "REPO_FILE_LIST.txt"
    ]
  },
{ ignores: [".next/**", "node_modules/**", "dist/**", "out/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx}"],
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
    },
  },

  // configs node
  {
    files: ["**/*.config.{js,cjs,mjs}", "next.config.{js,cjs,mjs}"],
    rules: { "no-undef": "off" },
  },
];


