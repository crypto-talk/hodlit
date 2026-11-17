import { defineConfig } from "@playwright/test";

const rustApi = process.env.AUTH_E2E_API_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3109" },
  webServer: [
    ...(rustApi
      ? []
      : [{ command: "node tests/e2e/auth-api.mjs", url: "http://127.0.0.1:8799/health" }]),
    {
      command: "node node_modules/next/dist/bin/next dev --port 3109",
      url: "http://localhost:3109/login",
      env: { NEXT_PUBLIC_API_URL: rustApi ?? "http://127.0.0.1:8799" },
      timeout: 120_000,
    },
  ],
});
