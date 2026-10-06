/**
 * 글 길이 제한.
 *
 * 백엔드 `PostDtos.CreatePostRequest` 의 `@Size(max=…)` 와 같은 값이다.
 * 백엔드가 바꾸면 여기도 같이 바꾼다. 화면에서 먼저 막아야 400 을 받고 나서
 * 쓴 글을 고치는 일이 없다.
 */
export const TITLE_MAX = 120;
export const CONTENT_MAX = 5000;

/** 방 심볼로 받아들일 모양. `?symbol=` 을 그대로 믿지 않으려고 둔다. */
const SYMBOL_PATTERN = /^[A-Z0-9]{1,10}$/;

export function safeSymbol(value: string | undefined): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return SYMBOL_PATTERN.test(upper) ? upper : null;
}

/**
 * 발행 전에 화면에서 거르는 것.
 *
 * 백엔드는 `@NotBlank` 라 공백만 있는 제목·본문을 거절한다. 같은 기준으로
 * 앞뒤 공백을 잘라서 본다. 문제가 없으면 null.
 */
export function draftProblem(draft: {
  coinSymbol: string;
  title: string;
  content: string;
}): string | null {
  if (!draft.coinSymbol) return "방을 골라 주세요.";
  if (draft.title.trim().length === 0) return "제목을 입력해 주세요.";
  if (draft.title.length > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지입니다.`;
  if (draft.content.trim().length === 0) return "본문을 입력해 주세요.";
  if (draft.content.length > CONTENT_MAX) return `본문은 ${CONTENT_MAX}자까지입니다.`;
  return null;
}
