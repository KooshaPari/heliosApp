import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/desktop/tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30000,
  use: {
    headless: true,
  },
});
