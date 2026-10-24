import localFont from "next/font/local";

/**
 * Pretendard 셀프호스팅 (D-5).
 *
 * 구글 폰트에 없는 서체라 원격 로딩은 애초에 불가능하고, CDN `<link>` 는
 * 네트워크가 막힌 환경에서 빌드를 통째로 세운다. 그래서 파일을 저장소에 둔다.
 *
 * 가변 원본(PretendardVariable.woff2)은 2.0MB 한 덩어리다. 대신 정적 서브셋
 * 5벌(각 ~270KB)을 쓴다. @font-face 가 굵기마다 따로라 브라우저는 그 화면에
 * 실제로 쓰인 굵기만 받아 간다.
 *
 * 서브셋은 상용 한글 2350자 기준이다. 드문 음절이 들어간 닉네임은 대체 서체로
 * 떨어질 수 있다. 문제가 되면 가변 원본으로 바꾸거나 서브셋을 다시 뜬다.
 */
export const pretendard = localFont({
  src: [
    { path: "../styles/fonts/Pretendard-Regular.subset.woff2", weight: "400", style: "normal" },
    { path: "../styles/fonts/Pretendard-SemiBold.subset.woff2", weight: "600", style: "normal" },
    { path: "../styles/fonts/Pretendard-Bold.subset.woff2", weight: "700", style: "normal" },
    { path: "../styles/fonts/Pretendard-ExtraBold.subset.woff2", weight: "800", style: "normal" },
    { path: "../styles/fonts/Pretendard-Black.subset.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});
