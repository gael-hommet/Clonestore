import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "@next/eslint-plugin-next";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": next,
    },
    rules: {
      // ✅ Next recommended rules (optionnel mais ok)
      ...next.configs["core-web-vitals"].rules,

      // ✅ LA règle qui te bloque le build
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

