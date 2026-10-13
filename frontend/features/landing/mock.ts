/**
 * 랜딩 목데이터.
 *
 * ⚠️ 여기 있는 값이 랜딩의 가짜 데이터 전부다.
 *
 * 방 목록·전체 글·핫글은 실제 API 에서 온다(`features/room/api.ts`,
 * `./api.ts`). 뜨는 방도 실제 API(HODL-44)로 바뀌었다. 남은 것은 아래 두 가지다.
 *   - MARQUEE   상단 전광판. 랜딩 전체 집계 API 는 아직 없다
 *   - VOTES     일일 투표. `/communities/{symbol}/poll` 이 생겼다(HODL-64). 아직 안 붙였다
 *
 * 구조 규칙 2 에 따라 이 파일은 `./api.ts` 밖으로 새지 않는다. 화면은
 * `api.ts` 의 함수를 통해서만 이 값을 본다.
 */

import type { MarqueeItem, VoteRow } from "./types";

/**
 * ⚠️ 숫자 세 개는 전부 목값입니다. 오늘 올라온 글 수와 지갑 연결 사용자 수는
 * 집계 API가 없고, 평균 보유 기간은 holdingMonths가 아직 전부 null이라 계산 자체가
 * 불가능합니다. **오픈 전에 진짜 값으로 바꾸거나 빼야 합니다.**
 * 대기 중인 API: 랜딩 집계
 */
export const MARQUEE: MarqueeItem[] = [
  {
    lead: "지갑에 이름표를 붙인 커뮤니티",
    text: " — 글쓴이가 그 코인을 실제로 들고 있는지 보입니다",
  },
  { text: "오늘 올라온 글 ", value: "340" },
  { text: "평균 보유 기간이 가장 긴 방 ", value: "BTC 1년 4개월" },
  { text: "지갑 연결한 사용자 ", value: "128명" },
];

/** 붙일 API: 일일 투표 `/communities/{symbol}/poll` (`docs/DAILY_ROOM_POLLS_API.md`) */
export const VOTES: VoteRow[] = [
  {
    symbol: "ETH",
    allWidth: "68%",
    allLabel: "68% (312명)",
    holderWidth: "41%",
    holderLabel: "41% (68명)",
  },
  {
    symbol: "BTC",
    allWidth: "54%",
    allLabel: "54% (204명)",
    holderWidth: "61%",
    holderLabel: "61% (51명)",
  },
  {
    symbol: "SOL",
    allWidth: "71%",
    allLabel: "71% (96명)",
    holderWidth: "33%",
    holderLabel: "9명 중 3명",
  },
];
