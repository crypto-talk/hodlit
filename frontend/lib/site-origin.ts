import { headers } from "next/headers";

/**
 * 지금 요청이 들어온 사이트 주소(`https://hodlit.xyz`). 서버 컴포넌트 · `generateMetadata` 전용.
 *
 * 배포 주소를 환경변수로 따로 두지 않고 요청 헤더에서 읽는다. 미리보기 배포 · 로컬에서도
 * 그 주소 그대로 OG 이미지 · canonical · 구조화 데이터가 만들어진다.
 */
export async function siteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
