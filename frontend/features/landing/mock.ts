/**
 * 랜딩 목데이터.
 *
 * ⚠️ 여기 있는 값이 랜딩의 가짜 데이터 전부다.
 *
 * 방 목록·전체 글·핫글은 실제 API 에서 온다(`features/room/api.ts`,
 * `./api.ts`). 뜨는 방도 실제 API(HODL-44)로 바뀌었다. 상단 전광판은 서비스 문구 목값을
 * 코인 시세로 바꿨다(HODL-57, `components/layout/price-ticker.tsx`). 남은 것은 하나다.
 *   - VOTES     일일 투표. `/communities/{symbol}/poll` 이 생겼다(HODL-64). 아직 안 붙였다
 *
 * 구조 규칙 2 에 따라 이 파일은 `./api.ts` 밖으로 새지 않는다. 화면은
 * `api.ts` 의 함수를 통해서만 이 값을 본다.
 */

import type { VoteRow } from "./types";

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
