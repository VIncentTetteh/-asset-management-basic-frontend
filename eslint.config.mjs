import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler's experimental "no setState in effect" rule flags every
      // fetch-on-mount effect (a pattern used deliberately in several contexts/
      // hooks that predate React Query adoption there). Downgraded to a warning
      // until those call sites are migrated to React Query — see assetiq-revamp
      // plan Phase 4 follow-up.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    // Playwright fixtures pass their value to a callback conventionally named
    // `use`, which the React Hooks rule mistakes for React's `use` hook.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
