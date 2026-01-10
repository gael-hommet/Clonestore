import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

export default [
  // Ignore build + deps
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "out/**"],
  },

  // Base JS
  js.configs.recommended,

  // TS recommended (sans config "type-aware" pour éviter la galère)
  ...tseslint.configs.recommended,

  // App code
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      // Next recommended
      ...next.configs.recommended.rules,

      // React hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Node config files (pour éviter "module is not defined")
  {
    files: ["**/*.config.{js,cjs,mjs}", "next.config.{js,cjs,mjs}"],
    rules: {
      "no-undef": "off",
    },
  },
];

