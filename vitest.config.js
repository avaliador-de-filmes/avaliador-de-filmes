import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.js"],
    include: ["tests/**/*.{test,spec}.{js,jsx}"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{js,jsx}"],
    },
  },
});
