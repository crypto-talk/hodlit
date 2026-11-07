/**
 * 닉네임 규칙 (HODL-103 · 104). 회원가입과 마이페이지 닉네임 변경이 같이 쓴다.
 *
 * 서버 규칙을 그대로 옮겼다(`backend/.../member/Nickname.java`, `docs/AUTH_API.md`):
 * 앞뒤 공백을 자른 뒤 2~40자, 한글 · 영문 · 숫자 · `_` · `-` 만. 내부 공백 · 다른 특수문자 ·
 * 이모지는 안 된다. 서버가 바뀌면 여기도 바꾼다.
 *
 * 새로 입력하는 값에만 쓴다. 규칙이 생기기 전에 만든 닉네임(공백 · `@` 등이 든 것)은
 * 화면에 그대로 보여 준다 — 프로필 주소는 회원 id 라 닉네임 모양과 상관없다.
 */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 40;

/** 입력칸 아래에 늘 보여 주는 안내. */
export const NICKNAME_HINT = `${NICKNAME_MIN}~${NICKNAME_MAX}자, 한글 · 영문 · 숫자 · 밑줄(_) · 하이픈(-)`;

/**
 * Java `\p{IsHangul}` 은 유니코드 Hangul 문자 체계다(완성형 · 자모 · 호환 자모 포함).
 * JS 는 `\p{Script=Hangul}` 이 같은 범위다.
 */
const ALLOWED = /^[\p{Script=Hangul}A-Za-z0-9_-]+$/u;

/** 서버와 같은 정규화. Java `String.strip()` 처럼 앞뒤 공백만 자른다. */
export function normalizeNickname(value: string): string {
  return value.trim();
}

/**
 * 규칙 검사. 맞으면 null, 아니면 사용자에게 보일 문구.
 * 길이는 서버(`@Size`)처럼 UTF-16 길이로 센다. 한글은 한 글자가 1 이다.
 */
export function nicknameProblem(value: string): string | null {
  const nickname = normalizeNickname(value);
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX)
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해 주세요.`;
  if (!ALLOWED.test(nickname))
    return /\s/.test(nickname)
      ? "닉네임 사이에는 공백을 넣을 수 없습니다."
      : "닉네임에는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 쓸 수 있습니다.";
  return null;
}

/**
 * 회원가입 · 닉네임 변경 실패 문구.
 *
 * - 409 는 서버 문구가 이미 정확하다("이미 사용 중인 닉네임입니다." · "…아이디입니다.")
 * - 400 입력 검사 실패는 `nickname: 닉네임에는 …` 처럼 필드 이름이 붙어 온다. 닉네임이면
 *   안내 문구로 바꾸고, 다른 필드(아이디 · 비밀번호)는 필드 이름만 뗀다
 */
export function nicknameAwareMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const status = (error as { status?: unknown }).status;
  if (status !== 400) return error.message;
  const field = /^(\w+):\s*([\s\S]+)$/.exec(error.message);
  if (!field) return error.message;
  return field[1] === "nickname" ? `닉네임 규칙을 확인해 주세요. (${NICKNAME_HINT})` : field[2];
}
