import MypageFrame from "./mypage-frame";

/**
 * 마이페이지 `/mypage/*` — 본인만 보는 화면.
 *
 * 탭마다 화면과 데이터가 전혀 달라서 쿼리(`?tab=`)가 아니라 하위 경로로 나눈다. 구조 규칙 8
 * (탭 상태는 URL 쿼리)은 같은 목록을 거르는 탭(방 게시판 전체 / 인증 같은 것)에 대한 것이다.
 *
 * 지갑(HODL-74) · 내 자산(HODL-67) 탭이 있다. 북마크 · 임시저장이 옆에 붙는다.
 * 남에게 보여 주는 공개 프로필은 `/@닉네임`(HODL-75)으로 따로 만든다.
 */
export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return <MypageFrame>{children}</MypageFrame>;
}
