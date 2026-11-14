import type { Metadata, Viewport } from "next";
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

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();
  const imageUrl = `${origin}/og.png`;
  const title = "Hodlit | 증명된 투자자들의 코인 커뮤니티";
  const description = "회원가입하고, 선택적으로 지갑 자산을 인증해 코인별 투자자들과 이야기하세요.";

  return {
    // 페이지가 적는 canonical 같은 상대 주소는 이 주소를 기준으로 완성된다.
    metadataBase: new URL(origin),
    // 페이지는 "BTC 방" 처럼 앞부분만 적는다. 뒤의 " | Hodlit" 은 여기서 붙는다.
    // 제목을 안 정한 페이지는 default 를 쓴다.
    title: { default: title, template: "%s | Hodlit" },
    description,
    openGraph: { title, description, images: [{ url: imageUrl, width: 2400, height: 1260 }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
