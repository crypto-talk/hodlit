import type { ModerationLog } from "./types";

/**
 * 관리 이력 한 줄을 사람이 읽는 문장으로 바꾼다.
 *
 * 백엔드는 `moderation_logs` 의 값을 그대로 준다(`docs/ASSIGNED_FEATURES_API.md`).
 * 값은 쓰는 곳마다 다르다.
 *
 * - `posts` · `members`: 숨김 · 정지 여부 `"true"` / `"false"` (ModerationService)
 * - `rooms`: 운영 상태 `OPEN` / `CLOSE` (RoomAdminService), 또는
 *   `NONE→CREATED` · `EXISTING→UPDATED` · `EXISTING→INACTIVE` (RoomCatalogService)
 * - `categories`: `NONE|EXISTING→SAVED` · `EXISTING→DELETED`
 *
 * 모르는 값이 오면 원래 값을 그대로 보인다. 지어낸 문장보다 낫다.
 */

const TARGET: Record<string, string> = {
  posts: "글",
  members: "회원",
  rooms: "방",
  categories: "카테고리",
};

const ROOM_STATUS: Record<string, string> = {
  OPEN: "열림",
  CLOSE: "닫힘",
};

export function moderationTarget(log: Pick<ModerationLog, "target_type" | "target_id">): string {
  return `${TARGET[log.target_type] ?? log.target_type} #${log.target_id}`;
}

export function moderationAction(
  log: Pick<ModerationLog, "target_type" | "before_state" | "after_state">,
): string {
  const { target_type: type, before_state: before, after_state: after } = log;

  if (type === "posts") {
    if (after === "true") return "숨김";
    if (after === "false") return "숨김 해제";
  }
  if (type === "members") {
    if (after === "true") return "이용 정지";
    if (after === "false") return "정지 해제";
  }
  if (type === "rooms") {
    if (ROOM_STATUS[before] && ROOM_STATUS[after]) {
      return `운영 상태 ${ROOM_STATUS[before]} → ${ROOM_STATUS[after]}`;
    }
    if (after === "CREATED") return "생성";
    if (after === "UPDATED") return "정보 수정";
    if (after === "INACTIVE") return "삭제(비활성화)";
  }
  if (type === "categories") {
    if (after === "SAVED") return before === "NONE" ? "생성" : "수정";
    if (after === "DELETED") return "삭제";
  }
  return `${before} → ${after}`;
}

/** 숨김 · 정지 · 삭제처럼 무거운 조치인지. 이력에서 빨간 글자로 보인다. */
export function isHeavyModeration(
  log: Pick<ModerationLog, "target_type" | "after_state">,
): boolean {
  if (log.target_type === "posts" || log.target_type === "members")
    return log.after_state === "true";
  return (
    log.after_state === "INACTIVE" || log.after_state === "DELETED" || log.after_state === "CLOSE"
  );
}
