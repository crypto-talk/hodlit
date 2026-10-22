import { describe, expect, it } from "vitest";
import { canShowResults, toRoomPoll } from "./api";
import { kstDay, msUntilKstMidnight } from "./kst-day";

describe("kstDay", () => {
  it("UTC 15시가 한국 자정이다", () => {
    expect(kstDay(Date.parse("2026-10-22T14:59:59Z"))).toBe("2026-10-22");
    expect(kstDay(Date.parse("2026-10-22T15:00:00Z"))).toBe("2026-10-23");
  });
});

describe("msUntilKstMidnight", () => {
  it("한국 23:59:59 이면 1초 남는다", () => {
    expect(msUntilKstMidnight(Date.parse("2026-10-22T14:59:59Z"))).toBe(1000);
  });

  it("자정 정각이면 하루 뒤를 가리킨다", () => {
    expect(msUntilKstMidnight(Date.parse("2026-10-22T15:00:00Z"))).toBe(24 * 60 * 60 * 1000);
  });
});

const BEFORE = {
  id: 3,
  coinSymbol: "ETH",
  question: "내일 오를까요?",
  active: true,
  day: "2026-10-23",
  participatedToday: false,
  choices: [
    { id: 10, label: "오른다" },
    { id: 11, label: "내린다" },
  ],
};

const AFTER = {
  ...BEFORE,
  participatedToday: true,
  userChoiceId: 11,
  totalVotes: 4,
  choices: [
    { id: 10, label: "오른다", voteCount: 3 },
    { id: 11, label: "내린다", voteCount: 1 },
  ],
};

describe("toRoomPoll", () => {
  it("참여 전에는 표 수 · 내 선택이 null 이다(0 이 아니다)", () => {
    const poll = toRoomPoll(BEFORE);
    expect(poll.participated).toBe(false);
    expect(poll.totalVotes).toBeNull();
    expect(poll.myChoiceId).toBeNull();
    expect(poll.choices.map((c) => c.votes)).toEqual([null, null]);
  });

  it("참여 뒤에는 결과가 있다", () => {
    const poll = toRoomPoll(AFTER);
    expect(poll.myChoiceId).toBe(11);
    expect(poll.totalVotes).toBe(4);
    expect(poll.choices.map((c) => c.votes)).toEqual([3, 1]);
  });

  it("필수 값이 없으면 실패한다", () => {
    expect(() => toRoomPoll({ ...BEFORE, question: undefined })).toThrow();
    expect(() => toRoomPoll({ ...BEFORE, choices: [{ id: 10, label: "오른다" }] })).toThrow();
  });
});

describe("canShowResults", () => {
  it("오늘 참여했고 날짜가 같을 때만", () => {
    expect(canShowResults(toRoomPoll(AFTER), "2026-10-23")).toBe(true);
    expect(canShowResults(toRoomPoll(AFTER), "2026-10-24")).toBe(false);
    expect(canShowResults(toRoomPoll(BEFORE), "2026-10-23")).toBe(false);
  });
});
