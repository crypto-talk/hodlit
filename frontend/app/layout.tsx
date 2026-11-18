import type { Metadata, Viewport } from "next";
import { toJsonLd } from "@/lib/json-ld";
import { siteOrigin } from "@/lib/site-origin";
import { pretendard } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

/**
 * 한글 이름은 "호들릿"이다. 검색에서 한글로 찾는 사람이 닿도록 사이트 제목 · 설명 ·
 * 사이트 이름 구조화 데이터에 같이 적는다. 표기를 하나로 모아야 검색엔진이 그 이름을
 * 사이트 이름으로 익히므로 "호들잇" 같은 다른 표기는 화면 어디에도 쓰지 않는다.
 */
const SITE_NAME = "Hodlit";
const SITE_NAME_KO = "호들릿";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();
  const imageUrl = `${origin}/og.png`;
  const title = `${SITE_NAME} ${SITE_NAME_KO} | 증명된 투자자들의 코인 커뮤니티`;
  const description = `${SITE_NAME_KO}(${SITE_NAME})에 가입하고, 선택적으로 지갑 자산을 인증해 코인별 투자자들과 이야기하세요.`;

  return {
    // 페이지가 적는 canonical 같은 상대 주소는 이 주소를 기준으로 완성된다.
    metadataBase: new URL(origin),
    // 페이지는 "BTC 방" 처럼 앞부분만 적는다. 뒤의 " | Hodlit" 은 여기서 붙는다.
    // 제목을 안 정한 페이지는 default 를 쓴다.
    title: { default: title, template: "%s | Hodlit" },
    description,
    openGraph: {
      siteName: `${SITE_NAME} ${SITE_NAME_KO}`,
      title,
      description,
      images: [{ url: imageUrl, width: 2400, height: 1260 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const origin = await siteOrigin();
  // 검색 결과에 뜨는 사이트 이름. 구글은 홈의 이 값을 읽는다.
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: [SITE_NAME_KO],
    url: `${origin}/`,
  };

  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          // 서버가 만든 JSON 이고 `<` 는 이스케이프돼 있다.
          dangerouslySetInnerHTML={{ __html: toJsonLd(website) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
