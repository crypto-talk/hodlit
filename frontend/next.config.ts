import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * AppKit ethers 어댑터가 끌고 오는 `@base-org/account` 는 서버용 빌드(`index.node.js`)에서
   * `@coinbase/cdp-sdk` 를 부르고, cdp-sdk 는 설치되지 않은 선택 의존성 `@x402/*` 를 import 한다.
   * 그래서 서버 렌더 번들을 만들다 Turbopack 이 멈춘다. 지갑 연결은 브라우저에서만 돌므로
   * 서버 번들에는 넣지 않고 외부 패키지로 둔다(HODL-55). 브라우저 번들은 영향이 없다.
   */
  serverExternalPackages: ["@base-org/account"],
};

export default nextConfig;
