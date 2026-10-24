import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * 임포트 방향 규칙 (구조 규칙 1, F-4).
 *
 *   app/  →  features/  →  components/ · lib/
 *
 * 역방향과 features 끼리의 직접 참조를 막는다. 문서로만 둔 규칙은 안 지켜진
 * 전례가 있고, 사람보다 에이전트가 먼저 어긴다.
 *
 * 같은 feature 안에서는 `./` 상대경로를 쓴다(F-3). 그래서 features 안에서
 * `@/features/*` 를 막는 것이 자기 feature 참조까지 걸러 주는 역할을 겸한다.
 */
const DOWNWARD_ONLY = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@/app/*", "@/app"],
          message:
            "app/ 은 가장 바깥이라 아무도 참조할 수 없습니다. 필요한 코드는 features/ 나 lib/ 로 내리세요.",
        },
      ],
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app", "@/features/*", "@/features"],
              message:
                "공용 코드(components/, lib/)는 app/ 과 features/ 를 참조할 수 없습니다. 참조가 필요하면 그건 공용이 아닙니다.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app"],
              message: "features/ 는 app/ 을 참조할 수 없습니다.",
            },
            {
              group: ["@/features/*", "@/features"],
              message:
                "features 끼리 직접 참조할 수 없습니다. 같은 feature 안이면 './' 상대경로를, 공유가 필요하면 components/ 나 lib/ 로 내리세요.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["app/**/*.{ts,tsx}"],
    rules: DOWNWARD_ONLY,
  },

  // 포맷 관련 규칙은 Prettier에 맡기고 ESLint에서 끈다. 항상 마지막에 온다.
  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // shadcn/ui 에서 복사해 온 프리미티브. 원본과의 diff 를 유지하려고 검사에서 뺀다.
    "components/ui/**",
    // openapi-typescript 생성물. `pnpm gen:api` 로 다시 만들어지므로 손대지 않는다.
    "lib/api-schema.ts",
  ]),
]);

export default eslintConfig;
