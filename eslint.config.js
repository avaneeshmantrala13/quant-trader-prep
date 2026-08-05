import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";

/**
 * Flat ESLint config (ESLint 9 + typescript-eslint 8). Scope: `src/` only.
 *
 * Intent: a fast, non-type-checked lint that catches real correctness bugs
 * (react-hooks rules, no-undef via TS, unused vars) without drowning a codebase
 * that was never linted before in stylistic noise. Formatting is owned entirely
 * by Prettier, so `eslint-config-prettier` (LAST) turns off every rule that
 * would fight it. Type-aware rules are intentionally NOT enabled — `tsc -b`
 * already does the type checking in `npm run build` / `npm run typecheck`.
 */
export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules", "infra/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Imports must precede other statements. The DOM-mounting tests
      // deliberately import `App` AFTER their `vi.mock()` calls (mocks must be
      // registered first), and disable this line-locally — so the rule must be
      // registered for those directives to resolve.
      "import/first": "error",
      // Vite fast-refresh boundary hygiene — warn, don't block (some files
      // intentionally co-locate a component with helpers/constants).
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Allow intentional unused args/vars when prefixed with `_`, and ignore
      // rest-sibling omissions (a common, deliberate destructure pattern).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Tests: relax rules that fire on deliberate test shapes (empty mocks, `any`
  // fixtures, non-null assertions on known-present data).
  {
    files: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  prettier,
);
