import { http } from "./http";

/** 보유 기록 갱신을 기다리는 최대 시간. 넘으면 기다리지 않고 진행한다. */
const HOLDING_REFRESH_TIMEOUT_MS = 8_000;

/**
 * ⚠️ 임시 조치 — 글 · 댓글을 보내기 직전에 보유 기록을 갱신한다.
 *
 * 서버는 글 · 댓글을 저장할 때 잔액을 새로 읽지 않고, `GET /me/assets` 가 마지막으로
 * 저장한 기록을 스냅샷으로 복사한다(HODL-42 수정 이후). 그런데 이 API 를 부르는 화면이
 * 없어서 지갑을 연결해도 미인증으로 붙었다. 그래서 보내기 직전에 한 번 부른다.
 *
 * 글쓰기(`features/post`)와 댓글(`features/comment`)이 같이 쓰므로 `lib/` 에 있다.
 *
 * 실패해도 막지 않는다. 서버는 갱신에 실패하면 503 을 주고 이전 기록을 그대로 두므로,
 * 마지막으로 성공한 기록이 붙는다. 지갑이 없으면 서버가 빈 목록을 바로 돌려준다.
 *
 * 이 순서는 브라우저가 지키는 것이라 API 를 직접 부르면 건너뛸 수 있다. 진짜 해결은
 * 서버가 저장 처리 안에서 갱신하는 것이다(HODL-45). 그게 들어오면 이 파일과 호출하는
 * 곳(`PostDraft.verifiable`, 댓글 작성의 `verifiable`)을 지운다.
 */
export async function refreshHoldings(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOLDING_REFRESH_TIMEOUT_MS);
  try {
    await http<unknown>("/api/v1/me/assets", { signal: controller.signal });
  } catch {
    // 갱신 실패는 작성 실패가 아니다. 마지막 기록으로 진행한다.
  } finally {
    clearTimeout(timer);
  }
}
