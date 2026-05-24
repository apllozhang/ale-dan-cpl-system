import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["dist/", "node_modules/", ".manus/", ".manus-logs/", "patches/"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);
