import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests: pure logic (stats, file checks, API client) and small components.
// Playwright covers full user flows in e2e/.
export default defineConfig({
  // TSX is compiled by Vite's built-in transform using tsconfig's "jsx": "react-jsx".
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
