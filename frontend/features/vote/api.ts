import type { components } from "@/lib/api-schema";
import { ApiError, http } from "@/lib/http";
import { isOpenRoom } from "@/lib/room-status";
import type { PollChoice, RoomPoll } from "./types";

/**
 * 방 일일 투표 (HODL-64, `docs/DAILY_ROOM_POLLS_API.md`). 구조 규칙 2: 데이터 진입점은 여기 하나.
 *
 * 서버 규칙
 *   - 회원 · 투표 · 한국 날짜당 한 번. 바꾸거나 다시 내면 409
 *   - 오늘 참여하기 전에는 결과(표 수 · 내 선택)를 아예 주지 않는다. 다른 길로 결과를 얻지 않는다
 *   - 한국 자정에 하루가 바뀌고, 같은 질문에 다음 날 다시 참여할 수 있다
 *
 * ⚠️ 생성 타입은 모든 필드가 선택(`?`)이다. 여기서 한 번 좁힌다.
 */

type PollResponse = components["schemas"]["PollResponse"];
type CoinResponse = components["schemas"]["CoinResponse"];
type ChoiceResponse = components["schemas"]["ChoiceResponse"];

export function roomPollQueryKey(symbol: string, memberId: number | null, day: string) {
  return ["room-poll", symbol, memberId, day] as const;
}

/**
 * 방의 현재 투표. 방에 열린 투표가 없으면 null.
 *
 * 없는 방도 404 지만, 방 게시판은 방을 먼저 확인한 뒤에만 이걸 부른다.
 */
export async function loadRoomPoll(symbol: string): Promise<RoomPoll | null> {
  try {
    const poll = await http<PollResponse>(`/api/v1/communities/${encodeURIComponent(symbol)}/poll`);
    return toRoomPoll(poll);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function openPollsQueryKey(memberId: number | null, day: string) {
  return ["open-polls", memberId, day] as const;
}

/**
 * 투표가 열린 방들 (랜딩 "오늘의 투표").
 *
 * ⚠️ 열린 투표 목록 API 가 없어서 방 목록(`/coins`)을 받고 방마다 `/poll` 을 한 번씩 부른다.
 * 방 수만큼 요청이 나간다. 목록 API 가 생기면 이 함수만 바꾼다.
 *
 * 방 목록 순서로 돌려준다. 랜딩은 이걸 하루 단위로 섞는다(`daily-order.ts`).
 * "참여자가 많은 순"은 만들 수 없다 — 참여 전에는 서버가 표 수를 주지 않는다.
 * 방 하나가 실패해도 나머지는 보여 준다. 전부 실패했을 때만 실패로 본다.
 * 닫힌 방(HODL-77)은 부르지 않는다. 투표가 403 으로 막혀 요청만 낭비된다.
 */
export async function loadOpenPolls(): Promise<RoomPoll[]> {
  const coins = await http<CoinResponse[]>("/api/v1/coins");
  const symbols = coins
    .filter(isOpenRoom)
    .map((coin) => coin.symbol)
    .filter((symbol): symbol is string => typeof symbol === "string" && symbol !== "");
  if (symbols.length === 0) return [];

  const results = await Promise.allSettled(symbols.map(loadRoomPoll));
  if (results.every((result) => result.status === "rejected")) {
    throw new Error("투표를 불러오지 못했습니다.");
  }

  // 방 칸이 같은 키로 이어 쓰도록 심볼은 요청한 값으로 맞춘다.
  return results.flatMap((result, index) =>
    result.status === "fulfilled" && result.value
      ? [{ ...result.value, symbol: symbols[index] }]
      : [],
  );
}

/** 오늘 참여. 응답은 참여 뒤의 투표(결과 포함)다. */
export async function castVote(pollId: number, choiceId: number): Promise<RoomPoll> {
  const poll = await http<PollResponse>(`/api/v1/polls/${pollId}/votes`, {
    method: "POST",
    body: JSON.stringify({ choiceId }),
  });
  return toRoomPoll(poll);
}

/**
 * 응답을 화면 모양으로. 필수 값이 빠졌으면 그럴듯하게 채우지 않고 실패로 본다.
 * 참여 전에는 표 수가 null 로 남는다(0 이 아니다).
 */
export function toRoomPoll(raw: PollResponse): RoomPoll {
  const { id, question, day } = raw;
  if (typeof id !== "number" || !question || !day) {
    throw new Error("투표 응답에 필요한 값이 없습니다.");
  }

  const choices = (raw.choices ?? []).filter(hasChoice).map((choice): PollChoice => ({
    id: choice.id,
    label: choice.label,
    votes: typeof choice.voteCount === "number" ? choice.voteCount : null,
  }));
  if (choices.length < 2) throw new Error("투표 선택지가 없습니다.");

  const participated = raw.participatedToday === true;

  return {
    id,
    symbol: raw.coinSymbol ?? "",
    question,
    day,
    participated,
    myChoiceId: participated && typeof raw.userChoiceId === "number" ? raw.userChoiceId : null,
    totalVotes: participated && typeof raw.totalVotes === "number" ? raw.totalVotes : null,
    choices,
  };
}

/**
 * 결과를 보여 줘도 되는지. 오늘 참여했고, 응답의 날짜가 지금의 한국 날짜와 같을 때만.
 * 자정 직전에 낸 요청이 자정 뒤에 돌아오면 날짜가 어긋난다.
 */
export function canShowResults(poll: RoomPoll, today: string): boolean {
  return poll.participated && poll.day === today && poll.totalVotes !== null;
}

function hasChoice(value: ChoiceResponse): value is ChoiceResponse & { id: number; label: string } {
  return typeof value.id === "number" && typeof value.label === "string" && value.label !== "";
}
