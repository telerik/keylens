import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify("test"),
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
