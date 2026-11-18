import { ApiError } from "@/lib/http";

/**
 * 관리자 동작이 실패했을 때 토스트에 적을 문구.
 *
 * 서버가 준 문구가 있으면 그것을 쓴다 — 입력 검사 실패(400) · 충돌(409)의 이유가 거기 있다.
 * 권한(403)과 로그인 만료(401)는 서버 문구가 영어거나 짧아서 여기서 정한다.
 */
export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 풀렸습니다. 다시 로그인해 주세요.";
    if (error.status === 403) {
      return error.code === "ROOM_CLOSED"
        ? "닫힌 방이라 할 수 없습니다. 방을 먼저 열어 주세요."
        : "관리자 권한이 없어 처리하지 못했습니다.";
    }
    if (error.message) return error.message;
  }
  return fallback;
}
