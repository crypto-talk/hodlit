import { describe, expect, it } from "vitest";
import { isHeavyModeration, moderationAction, moderationTarget } from "./moderation-log";

const log = (target_type: string, before_state: string, after_state: string) => ({
  target_type,
  target_id: 3,
  before_state,
  after_state,
});

describe("moderationTarget", () => {
  it("대상 종류를 한글로", () => {
    expect(moderationTarget(log("posts", "false", "true"))).toBe("글 #3");
    expect(moderationTarget(log("categories", "NONE", "SAVED"))).toBe("카테고리 #3");
  });

  it("모르는 종류는 그대로", () => {
    expect(moderationTarget(log("banners", "NONE", "SAVED"))).toBe("banners #3");
  });
});

describe("moderationAction", () => {
  it("글 숨김 · 해제", () => {
    expect(moderationAction(log("posts", "false", "true"))).toBe("숨김");
    expect(moderationAction(log("posts", "true", "false"))).toBe("숨김 해제");
  });

  it("회원 정지 · 해제", () => {
    expect(moderationAction(log("members", "false", "true"))).toBe("이용 정지");
    expect(moderationAction(log("members", "true", "false"))).toBe("정지 해제");
  });

  it("방 운영 상태와 카탈로그 변경", () => {
    expect(moderationAction(log("rooms", "CLOSE", "OPEN"))).toBe("운영 상태 닫힘 → 열림");
    expect(moderationAction(log("rooms", "NONE", "CREATED"))).toBe("생성");
    expect(moderationAction(log("rooms", "EXISTING", "INACTIVE"))).toBe("삭제(비활성화)");
  });

  it("카테고리 생성 · 수정 · 삭제", () => {
    expect(moderationAction(log("categories", "NONE", "SAVED"))).toBe("생성");
    expect(moderationAction(log("categories", "EXISTING", "SAVED"))).toBe("수정");
    expect(moderationAction(log("categories", "EXISTING", "DELETED"))).toBe("삭제");
  });

  it("모르는 값은 원래 값을 보인다", () => {
    expect(moderationAction(log("rooms", "A", "B"))).toBe("A → B");
  });
});

describe("isHeavyModeration", () => {
  it("숨김 · 정지 · 삭제 · 닫힘만 무겁다", () => {
    expect(isHeavyModeration(log("posts", "false", "true"))).toBe(true);
    expect(isHeavyModeration(log("posts", "true", "false"))).toBe(false);
    expect(isHeavyModeration(log("rooms", "OPEN", "CLOSE"))).toBe(true);
    expect(isHeavyModeration(log("categories", "NONE", "SAVED"))).toBe(false);
  });
});
