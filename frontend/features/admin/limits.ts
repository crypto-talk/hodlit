import { safeExternalUrl, safeLink } from "@/lib/safe-url";
import type { BannerInput, NewsInput, PollInput } from "./types";

/**
 * 관리자 입력 검사. 길이와 규칙은 백엔드 값을 그대로 옮긴 것이다
 * (`docs/COMMUNITY_NEWS_API.md` · `DAILY_ROOM_POLLS_API.md` · `ASSIGNED_FEATURES_API.md`).
 * 서버가 같은 검사를 다시 한다 — 여기는 보내기 전에 어느 칸이 문제인지 알려 주는 용도다.
 *
 * 돌려주는 값은 칸 이름 → 안내 문구다. 문제가 없으면 빈 객체.
 */

export const NEWS_MAX = { title: 200, summary: 1000, sourceName: 100, sourceUrl: 1000 } as const;
export const POLL_MAX = { question: 200, choice: 100, choices: 10 } as const;
export const POLL_MIN_CHOICES = 2;
export const BANNER_MAX = { title: 100, altText: 200, url: 1000 } as const;
/** 배너 이미지 형식 · 용량. 미디어 업로드 제한과 같다. */
export const BANNER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const BANNER_IMAGE_BYTES = 25 * 1024 * 1024;

export type Problems<T> = Partial<Record<keyof T, string>>;

function required(value: string, max: number, name: string): string | null {
  const text = value.trim();
  if (!text) return `${name}을(를) 적어 주세요.`;
  if (text.length > max) return `${name}은(는) ${max}자까지입니다. 지금 ${text.length}자입니다.`;
  return null;
}

export function newsProblems(input: NewsInput): Problems<NewsInput> {
  const problems: Problems<NewsInput> = {};
  const title = required(input.title, NEWS_MAX.title, "제목");
  const summary = required(input.summary, NEWS_MAX.summary, "요약");
  const sourceName = required(input.sourceName, NEWS_MAX.sourceName, "출처");
  const sourceUrl = required(input.sourceUrl, NEWS_MAX.sourceUrl, "원문 링크");
  if (title) problems.title = title;
  if (summary) problems.summary = summary;
  if (sourceName) problems.sourceName = sourceName;
  if (sourceUrl) problems.sourceUrl = sourceUrl;
  else if (!safeExternalUrl(input.sourceUrl.trim())) {
    problems.sourceUrl = "http:// 또는 https:// 로 시작하는 주소만 됩니다.";
  }
  return problems;
}

/** 선택지 칸마다의 문제는 `choices` 한 줄로 모은다. 어느 칸인지 문구에 적는다. */
export function pollProblems(input: PollInput): Problems<PollInput> {
  const problems: Problems<PollInput> = {};
  const question = required(input.question, POLL_MAX.question, "질문");
  if (question) problems.question = question;

  const labels = input.choices.map((choice) => choice.trim());
  const empty = labels.findIndex((label) => !label);
  const long = labels.findIndex((label) => label.length > POLL_MAX.choice);
  // 서버는 앞뒤 공백을 자르고 대소문자를 무시한 채 같은 선택지를 거절한다.
  const seen = new Set<string>();
  const duplicate = labels.findIndex((label) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });

  if (labels.length < POLL_MIN_CHOICES) {
    problems.choices = `선택지는 ${POLL_MIN_CHOICES}개 이상이어야 합니다.`;
  } else if (labels.length > POLL_MAX.choices) {
    problems.choices = `선택지는 ${POLL_MAX.choices}개까지입니다.`;
  } else if (empty >= 0) {
    problems.choices = `${empty + 1}번 선택지가 비어 있습니다.`;
  } else if (long >= 0) {
    problems.choices = `${long + 1}번 선택지는 ${POLL_MAX.choice}자까지입니다.`;
  } else if (duplicate >= 0) {
    problems.choices = `${duplicate + 1}번 선택지가 앞의 선택지와 같습니다.`;
  }
  return problems;
}

export function bannerProblems(input: BannerInput): Problems<BannerInput> {
  const problems: Problems<BannerInput> = {};
  const title = required(input.title, BANNER_MAX.title, "관리용 제목");
  const altText = required(input.altText, BANNER_MAX.altText, "대체 텍스트");
  if (title) problems.title = title;
  if (altText) problems.altText = altText;
  if (!input.imageUrl) problems.imageUrl = "이미지를 올려 주세요.";

  const link = input.linkUrl.trim();
  if (link.length > BANNER_MAX.url) {
    problems.linkUrl = `링크는 ${BANNER_MAX.url}자까지입니다.`;
  } else if (link && !safeLink(link)) {
    problems.linkUrl =
      "/ 로 시작하는 사이트 안 주소나 http(s) 주소만 됩니다. 비워 두면 링크 없는 배너입니다.";
  }
  return problems;
}

/** 올리기 전 이미지 파일 검사. 문제가 없으면 null. */
export function bannerImageProblem(file: { type: string; size: number }): string | null {
  if (!BANNER_IMAGE_TYPES.includes(file.type)) return "JPG · PNG · WEBP · GIF 만 올릴 수 있습니다.";
  if (file.size > BANNER_IMAGE_BYTES) return "이미지는 25MB 까지입니다.";
  return null;
}
