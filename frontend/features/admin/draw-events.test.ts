import { describe, expect, it } from "vitest";
import {
  adminDrawPhase,
  drawEventProblems,
  formatKst,
  formatOdds,
  isPrizeImageUrl,
  kstInputToUtc,
  lockReason,
  parseWeight,
  prizeOdds,
  prizeProblems,
  samePrizes,
  statusAction,
  toDrawStatus,
  utcToKstInput,
} from "./draw-events";
import type { DrawPrizeInput } from "./types";

const at = (iso: string) => Date.parse(iso);
const window = { startsAt: "2026-11-20T01:00:00Z", endsAt: "2026-11-27T01:00:00Z" };

describe("adminDrawPhase", () => {
  it("초안은 시작 전이면 draft, 시작 시각이 지나면 expired", () => {
    const draft = { ...window, status: "DRAFT" as const };
    expect(adminDrawPhase(draft, at("2026-11-19T00:00:00Z"))).toBe("draft");
    expect(adminDrawPhase(draft, at("2026-11-20T01:00:00Z"))).toBe("expired");
    expect(adminDrawPhase(draft, at("2026-12-01T00:00:00Z"))).toBe("expired");
  });

  it("연 이벤트는 기간으로 시작 전 · 진행 중 · 종료를 가른다", () => {
    const active = { ...window, status: "ACTIVE" as const };
    expect(adminDrawPhase(active, at("2026-11-19T00:00:00Z"))).toBe("scheduled");
    expect(adminDrawPhase(active, at("2026-11-20T01:00:00Z"))).toBe("live");
    expect(adminDrawPhase(active, at("2026-11-27T01:00:00Z"))).toBe("ended");
  });

  it("중지는 종료 전까지만 paused, 끝나면 ended", () => {
    const paused = { ...window, status: "PAUSED" as const };
    expect(adminDrawPhase(paused, at("2026-11-19T00:00:00Z"))).toBe("paused");
    expect(adminDrawPhase(paused, at("2026-11-22T00:00:00Z"))).toBe("paused");
    expect(adminDrawPhase(paused, at("2026-11-28T00:00:00Z"))).toBe("ended");
  });

  it("모르는 상태값은 unknown 이고 버튼도 이유도 그에 맞춘다", () => {
    expect(adminDrawPhase({ ...window, status: null }, at("2026-11-19T00:00:00Z"))).toBe("unknown");
    expect(toDrawStatus("CLOSED")).toBeNull();
    expect(toDrawStatus("PAUSED")).toBe("PAUSED");
    expect(statusAction("unknown")).toBeNull();
    expect(lockReason("unknown")).not.toBeNull();
  });

  it("상태마다 누를 수 있는 버튼과 잠금 이유", () => {
    expect(statusAction("draft")).toBe("open");
    expect(statusAction("scheduled")).toBe("pause");
    expect(statusAction("live")).toBe("pause");
    expect(statusAction("paused")).toBe("resume");
    expect(statusAction("ended")).toBeNull();
    expect(statusAction("expired")).toBeNull();
    expect(lockReason("draft")).toBeNull();
    expect(lockReason("live")).toContain("한 번 연");
    expect(lockReason("expired")).toContain("새 이벤트");
  });
});

describe("한국 시간 ↔ UTC", () => {
  it("입력칸의 숫자를 한국 시간으로 읽어 UTC 로 바꾼다", () => {
    expect(kstInputToUtc("2026-11-20T10:00")).toBe("2026-11-20T01:00:00.000Z");
    // 한국 자정 직후는 UTC 로 전날이다.
    expect(kstInputToUtc("2026-01-01T00:30")).toBe("2025-12-31T15:30:00.000Z");
    expect(kstInputToUtc("2026-11-20T10:00:30")).toBe("2026-11-20T01:00:30.000Z");
  });

  it("없는 날짜 · 모양이 아닌 값은 null", () => {
    expect(kstInputToUtc("2026-02-30T10:00")).toBeNull();
    expect(kstInputToUtc("2026-11-20")).toBeNull();
    expect(kstInputToUtc("")).toBeNull();
  });

  it("UTC 를 입력칸 값으로 되돌린다", () => {
    expect(utcToKstInput("2026-11-20T01:00:00Z")).toBe("2026-11-20T10:00");
    expect(utcToKstInput("2025-12-31T15:30:00Z")).toBe("2026-01-01T00:30");
    expect(utcToKstInput("엉뚱한 값")).toBe("");
  });

  it("표기도 한국 시간이다", () => {
    expect(formatKst("2025-12-31T15:30:00Z")).toContain("2026");
    expect(formatKst("2025-12-31T15:30:00Z")).toContain("00:30");
    expect(formatKst("")).toBe("");
  });
});

describe("당첨 확률", () => {
  it("가중치 / 가중치 합", () => {
    expect(prizeOdds([1, 3])).toEqual([25, 75]);
    expect(prizeOdds([5])).toEqual([100]);
  });

  it("잘못된 가중치 줄은 null 이고 합에서도 빠진다", () => {
    expect(prizeOdds([1, null, 1])).toEqual([50, null, 50]);
    expect(prizeOdds([null])).toEqual([null]);
  });

  it("표기", () => {
    expect(formatOdds(25)).toBe("25%");
    expect(formatOdds(100 / 3)).toBe("33.33%");
    expect(formatOdds(0.001)).toBe("0.01% 미만");
    expect(formatOdds(null)).toBe("—");
  });

  it("가중치는 안전한 양의 정수만", () => {
    expect(parseWeight("10")).toBe(10);
    expect(parseWeight(" 7 ")).toBe(7);
    expect(parseWeight("0")).toBeNull();
    expect(parseWeight("-1")).toBeNull();
    expect(parseWeight("1.5")).toBeNull();
    expect(parseWeight("")).toBeNull();
    expect(parseWeight("9007199254740993")).toBeNull();
  });
});

describe("drawEventProblems", () => {
  const now = at("2026-11-12T00:00:00Z");
  const input = {
    title: "새해 뽑기",
    description: "",
    startsAt: "2026-11-20T10:00",
    endsAt: "2026-11-27T10:00",
  };

  it("맞으면 문제 없음. 설명은 비워도 된다", () => {
    expect(drawEventProblems(input, now)).toEqual({});
  });

  it("시작은 지금보다 뒤, 종료는 시작보다 뒤", () => {
    expect(drawEventProblems({ ...input, startsAt: "2026-11-12T08:00" }, now).startsAt).toContain(
      "지금보다",
    );
    expect(drawEventProblems({ ...input, endsAt: "2026-11-20T10:00" }, now).endsAt).toContain(
      "시작 시각보다",
    );
  });

  it("빈 제목 · 긴 제목 · 긴 설명", () => {
    const problems = drawEventProblems(
      { ...input, title: " ", description: "가".repeat(2001) },
      now,
    );
    expect(problems.title).toContain("적어 주세요");
    expect(problems.description).toContain("2000자");
    expect(drawEventProblems({ ...input, title: "가".repeat(101) }, now).title).toContain("100자");
  });
});

const prize = (patch: Partial<DrawPrizeInput> = {}): DrawPrizeInput => ({
  key: "k",
  name: "스티커",
  description: "",
  imageUrl: "/api/v1/media/3f2504e0-4f89-11d3-9a0c-0305e82c3301.png",
  weight: "1",
  ...patch,
});

describe("prizeProblems", () => {
  it("맞으면 문제 없음", () => {
    expect(
      prizeProblems([prize(), prize({ name: "쿠폰", imageUrl: "https://a.com/b.png" })]),
    ).toEqual({ list: null, rows: {} });
  });

  it("상품이 없으면 목록 문제", () => {
    expect(prizeProblems([]).list).toContain("하나 이상");
  });

  it("같은 이름은 앞뒤 공백을 자르고 비교한다", () => {
    expect(prizeProblems([prize(), prize({ name: " 스티커 " })]).rows).toEqual({
      1: "앞의 상품과 이름이 같습니다.",
    });
  });

  it("이미지 · 가중치 문제를 줄마다 알려 준다", () => {
    const { rows } = prizeProblems([
      prize({ imageUrl: "" }),
      prize({ name: "b", imageUrl: "http://a.com/b.png" }),
      prize({ name: "c", weight: "0" }),
    ]);
    expect(rows[0]).toContain("이미지를");
    expect(rows[1]).toContain("https");
    expect(rows[2]).toContain("가중치");
  });

  it("가중치 합이 너무 크면 목록 문제", () => {
    const big = String(Number.MAX_SAFE_INTEGER);
    expect(
      prizeProblems([prize({ weight: big }), prize({ name: "b", weight: big })]).list,
    ).toContain("합");
  });
});

describe("isPrizeImageUrl", () => {
  it("올린 파일 · https 만", () => {
    expect(isPrizeImageUrl("/api/v1/media/a.png")).toBe(true);
    expect(isPrizeImageUrl("https://example.com/a.png")).toBe(true);
    expect(isPrizeImageUrl("http://example.com/a.png")).toBe(false);
    expect(isPrizeImageUrl("https://u:p@example.com/a.png")).toBe(false);
    expect(isPrizeImageUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("samePrizes", () => {
  it("순서와 칸을 본다. key 는 보지 않는다", () => {
    const a = [prize({ key: "1" }), prize({ key: "2", name: "b" })];
    expect(samePrizes(a, [prize({ key: "x" }), prize({ key: "y", name: "b" })])).toBe(true);
    expect(samePrizes(a, [a[1], a[0]])).toBe(false);
    expect(samePrizes(a, [a[0]])).toBe(false);
  });
});
