import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const title = "Hodlit — 증명된 투자자들의 코인 커뮤니티";
  const description = "회원가입하고, 선택적으로 지갑 자산을 인증해 코인별 투자자들과 이야기하세요.";

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: imageUrl, width: 1734, height: 907 }] },
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
