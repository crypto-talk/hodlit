import { defineConfig } from "@playwright/test";

/** 빌드 후 실행한다. API 응답은 각 브라우저 테스트가 가로채 운영 데이터를 변경하지 않는다. */
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:13000", trace: "retain-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 13000",
    url: "http://127.0.0.1:13000/login",
    timeout: 60_000,
  },
});
