import { describe, expect, it } from "vitest";
import { ApiError } from "./http";
import { nicknameAwareMessage, nicknameProblem, normalizeNickname } from "./nickname";

describe("nicknameProblem", () => {
  it.each(["고래", "whale_01", "새우-2", "ㄱㄴ", "ABCdef", "가".repeat(40)])(
    "%j 는 통과",
    (value) => {
      expect(nicknameProblem(value)).toBeNull();
    },
  );

  it("앞뒤 공백은 잘라서 본다", () => {
    expect(normalizeNickname("  고래  ")).toBe("고래");
    expect(nicknameProblem("  고래  ")).toBeNull();
  });

  it.each(["", "고", " 고 ", "가".repeat(41)])("%j 는 길이 문제", (value) => {
    expect(nicknameProblem(value)).toMatch(/2~40자/);
  });

  it("사이 공백은 따로 알려 준다", () => {
    expect(nicknameProblem("고래 상어")).toMatch(/공백/);
  });

  it.each(["@고래", "고래!", "whale.eth", "고래🐋", "고래/상어", "ｗｈａｌｅ"])(
    "%j 는 문자 문제",
    (value) => {
      expect(nicknameProblem(value)).toMatch(/한글, 영문, 숫자/);
    },
  );
});

describe("nicknameAwareMessage", () => {
  const error = (status: number, message: string) => new ApiError(status, { code: "", message });

  it("409 는 서버 문구를 그대로", () => {
    expect(nicknameAwareMessage(error(409, "이미 사용 중인 닉네임입니다."), "x")).toBe(
      "이미 사용 중인 닉네임입니다.",
    );
  });

  it("닉네임 입력 검사 400 은 규칙 안내로", () => {
    expect(nicknameAwareMessage(error(400, "nickname: 닉네임에는 한글, 영문만…"), "x")).toMatch(
      /닉네임 규칙을 확인해 주세요/,
    );
  });

  it("다른 필드 400 은 필드 이름만 뗀다", () => {
    expect(nicknameAwareMessage(error(400, "loginId: 영문, 숫자만 됩니다."), "x")).toBe(
      "영문, 숫자만 됩니다.",
    );
  });

  it("Error 가 아니면 기본 문구", () => {
    expect(nicknameAwareMessage("boom", "실패")).toBe("실패");
  });
});
