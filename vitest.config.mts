import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests (Vitest + Testing Library on happy-dom). Playwright e2e specs in
 * e2e/ are a separate suite (`npm run e2e`) and are excluded here.
 */
export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    esbuild: { jsx: "automatic" },
    test: {
        environment: "happy-dom",
        include: ["tests/unit/**/*.test.{ts,tsx}"],
        restoreMocks: true,
        // Date assertions (billing period ends) must not depend on the host timezone.
        env: { TZ: "UTC" },
    },
});
