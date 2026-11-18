import { describe, expect, it } from "vitest";
import { shareOf, toDailyResult, toMyVote } from "./history";

const choices = [
  { id: 1, label: "상승", voteCount: 3 },
  { id: 2, label: "하락", voteCount: 1 },
];
const raw = {
  pollId: 7,
  coinSymbol: "ETH",
  question: "오를까?",
  active: false,
  day: "2026-11-09",
  totalVotes: 4,
  choices,
};

describe("toDailyResult", () => {
  it("보유자 집계가 없으면 holders 는 null", () => {
    const [result] = toDailyResult(raw);
    expect(result.holders).toBeNull();
    expect(result.choices).toEqual([
      { id: 1, label: "상승", votes: 3 },
      { id: 2, label: "하락", votes: 1 },
    ]);
  });

  it("HOLDER 묶음만 보유자 집계로 쓴다", () => {
    const [result] = toDailyResult({
      ...raw,
      holderResults: [
        { holderStatus: "NOT_CONNECTED", totalVotes: 2, choices },
        {
          holderStatus: "HOLDER",
          totalVotes: 2,
          choices: [
            { id: 1, label: "상승", voteCount: 0 },
            { id: 2, label: "하락", voteCount: 2 },
          ],
        },
      ],
    });
    expect(result.holders).toEqual({
      totalVotes: 2,
      choices: [
        { id: 1, label: "상승", votes: 0 },
        { id: 2, label: "하락", votes: 2 },
      ],
    });
  });

  it("보유자 참여가 0 이면 견주지 않는다", () => {
    const [result] = toDailyResult({
      ...raw,
      holderResults: [{ holderStatus: "HOLDER", totalVotes: 0, choices }],
    });
    expect(result.holders).toBeNull();
  });

  it("질문 · 날짜가 없는 항목은 버린다", () => {
    expect(toDailyResult({ ...raw, question: undefined })).toEqual([]);
    expect(toDailyResult({ ...raw, day: undefined })).toEqual([]);
  });
});

describe("toMyVote", () => {
  it("내 선택과 그날 결과를 담는다", () => {
    const [vote] = toMyVote({
      id: 1,
      day: "2026-11-09",
      choiceId: 2,
      choiceLabel: "하락",
      result: raw,
    });
    expect(vote.choiceLabel).toBe("하락");
    expect(vote.result?.question).toBe("오를까?");
  });

  it("결과가 없어도 기록은 남긴다", () => {
    expect(
      toMyVote({ id: 1, day: "2026-11-09", choiceId: 2, choiceLabel: "하락" })[0].result,
    ).toBeNull();
  });
});

describe("shareOf", () => {
  it("참여가 없으면 0", () => {
    expect(shareOf(0, 0)).toBe(0);
    expect(shareOf(1, 4)).toBe(0.25);
  });
});
