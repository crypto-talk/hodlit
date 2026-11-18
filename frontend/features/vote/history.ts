import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import type { DailyPollResult, MyVote, MyVotePage, PollResultPage, ResultChoice } from "./types";

/**
 * 지난 투표 결과와 내 투표 기록 (HODL-102 · 109, `docs/POLL_HISTORY_API.md`).
 *
 * 서버 규칙
 *   - 방 결과는 **어제까지**와 닫힌 투표의 오늘 결과만 온다. 진행 중인 오늘 결과는 여기 없다 —
 *     오늘 참여한 사람만 투표 칸에서 본다. 그 정책을 이 화면이 돌아가지 않는다
 *   - 참여가 있던 날만 온다. 날짜 · 투표 내림차순
 *   - 보유자 집계는 투표할 때 서버가 남긴 보유 상태로 센 것이다. 회원 목록 · 개인별 상태는 오지 않는다
 *   - 내 기록은 방이 닫혀도 볼 수 있다. 남의 기록을 보는 API 는 없다
 */

type DailyResult = components["schemas"]["DailyResult"];
type ChoiceResponse = components["schemas"]["ChoiceResponse"];
type ResultPageResponse = components["schemas"]["PageResponseDailyResult"];
type VoteHistory = components["schemas"]["VoteHistory"];
type VotePageResponse = components["schemas"]["PageResponseVoteHistory"];

export const POLL_RESULT_PAGE_SIZE = 10;
export const MY_VOTE_PAGE_SIZE = 20;

export function pollResultsQueryKey(symbol: string, page: number) {
  return ["poll-results", symbol, page] as const;
}

export function myVotesQueryKey(memberId: number | null, page: number) {
  return ["my-votes", memberId, page] as const;
}

/** 방의 지난 결과. `page` 는 1부터 받는다. */
export async function loadPollResults(symbol: string, page: number): Promise<PollResultPage> {
  const query = new URLSearchParams({
    page: String(Math.max(1, page) - 1),
    size: String(POLL_RESULT_PAGE_SIZE),
  });
  const result = await http<ResultPageResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}/polls/results?${query.toString()}`,
  );
  return {
    items: (result.items ?? []).flatMap(toDailyResult),
    page: (result.page ?? 0) + 1,
    totalPages: result.totalPages ?? 0,
    totalElements: result.totalElements ?? 0,
  };
}

/** 내 투표 기록. `page` 는 1부터 받는다. */
export async function loadMyVotes(page: number): Promise<MyVotePage> {
  const query = new URLSearchParams({
    page: String(Math.max(1, page) - 1),
    size: String(MY_VOTE_PAGE_SIZE),
  });
  const result = await http<VotePageResponse>(`/api/v1/me/votes?${query.toString()}`);
  return {
    items: (result.items ?? []).flatMap(toMyVote),
    page: (result.page ?? 0) + 1,
    totalPages: result.totalPages ?? 0,
    totalElements: result.totalElements ?? 0,
  };
}

/** 질문 · 날짜가 빠진 항목은 버린다. 그럴듯하게 채우지 않는다. */
export function toDailyResult(raw: DailyResult): DailyPollResult[] {
  if (typeof raw.pollId !== "number" || !raw.question || !raw.day) return [];
  const holder = (raw.holderResults ?? []).find((group) => group.holderStatus === "HOLDER");
  const holderTotal = holder?.totalVotes ?? 0;
  return [
    {
      pollId: raw.pollId,
      symbol: raw.coinSymbol ?? "",
      question: raw.question,
      day: raw.day,
      totalVotes: raw.totalVotes ?? 0,
      choices: toChoices(raw.choices),
      // 보유자 참여가 0 이면 견줄 것이 없다. 0% 막대를 그리지 않게 null 로 둔다.
      holders:
        holder && holderTotal > 0
          ? { totalVotes: holderTotal, choices: toChoices(holder.choices) }
          : null,
    },
  ];
}

export function toMyVote(raw: VoteHistory): MyVote[] {
  if (typeof raw.id !== "number" || !raw.day) return [];
  return [
    {
      id: raw.id,
      day: raw.day,
      choiceId: raw.choiceId ?? -1,
      choiceLabel: raw.choiceLabel ?? "",
      result: raw.result ? (toDailyResult(raw.result)[0] ?? null) : null,
    },
  ];
}

function toChoices(choices: ChoiceResponse[] | undefined): ResultChoice[] {
  return (choices ?? []).flatMap((choice) =>
    typeof choice.id === "number" && choice.label
      ? [{ id: choice.id, label: choice.label, votes: choice.voteCount ?? 0 }]
      : [],
  );
}

/** 선택지의 비율(0~1). 참여가 없으면 0. */
export function shareOf(votes: number, total: number): number {
  return total > 0 ? votes / total : 0;
}
