import { defineConfig } from "@playwright/test";

// biome-ignore lint/style/noDefaultExport: Playwright requires default export for config
export default defineConfig({
  testDir: "apps/desktop/tests/e2e",
  timeout: 30000,
  use: {
    headless: true,
  },
});
