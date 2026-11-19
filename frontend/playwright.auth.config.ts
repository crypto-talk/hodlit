import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/session-restore.spec.ts",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3110" },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --port 3110",
    url: "http://localhost:3110/login",
    env: { NEXT_PUBLIC_API_URL: "http://localhost:8798" },
    timeout: 120_000,
  },
});
