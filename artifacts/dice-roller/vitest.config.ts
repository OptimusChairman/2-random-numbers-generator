import { defineConfig } from "vitest/config";
import path from "path";

// Separate from vite.config.ts, which requires PORT and BASE_PATH to be set.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
