import { defineConfig } from "vitest/config";

/**
 * 유닛 테스트 설정 (F-5).
 *
 * 대상은 틀렸을 때 화면이 깨지지 않고 조용히 잘못 동작하는 곳으로 좁힌다.
 *   - `lib/holder-snapshot/` · `lib/format/` — 지갑을 특정할 수 있는 표기가 나간다
 *   - `lib/http.ts` — 토큰이 안 실리거나 401 재시도가 새도 증상만 보인다
 * 컴포넌트 테스트는 하지 않고, 사용자 시나리오는 Playwright(F-6)가 맡는다.
 *
 * `tests/rendered-html.test.mjs` 는 빌드 산출물을 검사하는 별개 성격이라
 * 여기 포함하지 않는다. `pnpm run test:html` 로 따로 돌린다.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["features/**/*.test.ts", "lib/**/*.test.ts"],
  },
  resolve: {
    // tsconfig 의 "@/*" 별칭을 Vite 가 직접 읽는다.
    tsconfigPaths: true,
  },
});
