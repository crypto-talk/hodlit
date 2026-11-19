import { ApiError } from "@/lib/http";
import type { QueryClient } from "@tanstack/react-query";
import { adminErrorMessage } from "./error-message";

/** API 번호를 JS 숫자로 정확하게 보낼 수 있는 양의 정수만 허용한다. */
export function parsePollNumber(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value.trim())) return null;
  const id = Number(value.trim());
  return Number.isSafeInteger(id) ? id : null;
}

export function pollDeletionError(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "이미 삭제되었거나 존재하지 않는 투표입니다. 목록을 다시 확인해 주세요.";
  }
  return adminErrorMessage(error, "삭제 결과를 확인하지 못했습니다. 다시 조회한 뒤 확인해 주세요.");
}

/** 방·홈·지난 결과·내 기록을 함께 갱신한다. 사용자와 날짜를 포함한 하위 키도 모두 대상이다. */
const POLL_QUERY_PREFIXES = [
  ["admin", "poll"],
  ["admin", "poll-detail"],
  ["room-poll"],
  ["open-polls"],
  ["poll-results"],
  ["my-votes"],
] as const;

export function refreshPollQueries(queryClient: QueryClient) {
  return Promise.all(
    POLL_QUERY_PREFIXES.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
