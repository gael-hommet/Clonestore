import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

export default [
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

      // ✅ Hooks OK
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ✅ STOP les blocages build
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


