/**
 * 랜딩 목데이터.
 *
 * ⚠️ 여기 있는 값이 랜딩의 가짜 데이터 전부다.
 *
 * 방 목록·전체 글·핫글은 실제 API 에서 온다(`features/room/api.ts`,
 * `./api.ts`). 남은 것은 아래 세 가지다.
 *   - MARQUEE   상단 전광판. 랜딩 전체 집계 API 는 아직 없다
 *   - TRENDING  뜨는 방. `GET /communities/stats?window=24h` 가 생겼다(HODL-44). 아직 안 붙였다
 *   - VOTES     일일 투표. `/communities/{symbol}/poll` 이 생겼다(HODL-64). 아직 안 붙였다
 *
 * 구조 규칙 2 에 따라 이 파일은 `./api.ts` 밖으로 새지 않는다. 화면은
 * `api.ts` 의 함수를 통해서만 이 값을 본다.
 */

import type { MarqueeItem, TrendingRoom, VoteRow } from "./types";

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

/** 붙일 API: `GET /communities/stats?window=24h` (`docs/COMMUNITY_STATISTICS_API.md`) */
export const TRENDING: TrendingRoom[] = [
  {
    rank: 1,
    symbol: "ETH",
    name: "이더리움",
    posts: 47,
    comments: 210,
    hot: true,
    latest: "덴쿤 이후 L2 수수료, 실제 체감은 어느 정도인가요",
  },
  {
    rank: 2,
    symbol: "BTC",
    name: "비트코인",
    posts: 39,
    comments: 174,
    hot: true,
    latest: "현물 ETF 순유입이 3주 연속인데 이번엔 뭐가 다른가",
  },
  {
    rank: 3,
    symbol: "SOL",
    name: "솔라나",
    posts: 31,
    comments: 96,
    hot: false,
    latest: "솔라나 밸리데이터 직접 돌려본 3개월 후기",
  },
  {
    rank: 4,
    symbol: "XRP",
    name: "리플",
    posts: 22,
    comments: 88,
    hot: true,
    latest: "2년 3개월 들고 있으면서 배운 것 몇 가지",
  },
  {
    rank: 5,
    symbol: "ARB",
    name: "아비트럼",
    posts: 18,
    comments: 74,
    hot: false,
    latest: "에어드랍 이후 남은 사람들은 무엇을 보고 있나",
  },
  {
    rank: 6,
    symbol: "DOGE",
    name: "도지코인",
    posts: 14,
    comments: 61,
    hot: true,
    latest: "밈코인 방에도 보유 배지가 필요한 이유",
  },
  {
    rank: 7,
    symbol: "LINK",
    name: "체인링크",
    posts: 9,
    comments: 38,
    hot: false,
    latest: "오라클 수수료 구조를 처음부터 다시 읽어봤습니다",
  },
  {
    rank: 8,
    symbol: "ADA",
    name: "카르다노",
    posts: 6,
    comments: 27,
    hot: false,
    latest: "거버넌스 투표 참여율이 낮은 이유가 뭘까요",
  },
  {
    rank: 9,
    symbol: "AVAX",
    name: "아발란체",
    posts: 5,
    comments: 19,
    hot: false,
    latest: "서브넷 운영비 실측치 공유합니다",
  },
  {
    rank: 10,
    symbol: "OP",
    name: "옵티미즘",
    posts: 4,
    comments: 12,
    hot: false,
    latest: "리트로 펀딩 라운드 결과를 어떻게 봐야 하나",
  },
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
