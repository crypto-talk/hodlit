/**
 * 글 길이 제한.
 *
 * 백엔드 `PostDtos.CreatePostRequest` 의 `@Size(max=…)` 와 같은 값이다.
 * 백엔드가 바꾸면 여기도 같이 바꾼다. 화면에서 먼저 막아야 400 을 받고 나서
 * 쓴 글을 고치는 일이 없다.
 */
export const TITLE_MAX = 120;
export const CONTENT_MAX = 5000;

/** `CreatePostRequest.media` 의 `@Size(max=8)`. */
export const IMAGE_MAX = 8;

/** `MediaService.MAX_BYTES`. 서버 multipart 설정도 25MB 다. */
const IMAGE_BYTES_MAX = 25 * 1024 * 1024;

/**
 * `MediaService.EXTENSIONS` 의 이미지 쪽. 서버는 영상(mp4·webm·mov)도 받지만
 * 동영상은 링크 임베드만으로 시작하기로 했다. 직접 업로드는 넣지 않는다.
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** 고를 수 없는 파일이면 그 이유, 괜찮으면 null. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "JPG · PNG · WEBP · GIF 만 올릴 수 있습니다.";
  }
  if (file.size > IMAGE_BYTES_MAX) return "이미지는 25MB 이하여야 합니다.";
  return null;
}

/**
 * 백엔드 `PostService.YOUTUBE` 와 같은 패턴. 영상 id(11자)를 꺼낸다.
 * 서버가 다시 검사하지만, 화면에서 먼저 걸러야 미리보기를 보여줄 수 있다.
 */
const YOUTUBE_PATTERN =
  /^(?:https:\/\/)?(?:www\.)?(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&].*)?$/;

export function youtubeVideoId(url: string): string | null {
  return YOUTUBE_PATTERN.exec(url.trim())?.[1] ?? null;
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
  youtubeUrl: string;
}): string | null {
  if (!draft.coinSymbol) return "방을 골라 주세요.";
  if (draft.title.trim().length === 0) return "제목을 입력해 주세요.";
  if (draft.title.length > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지입니다.`;
  if (draft.content.trim().length === 0) return "본문을 입력해 주세요.";
  if (draft.content.length > CONTENT_MAX) return `본문은 ${CONTENT_MAX}자까지입니다.`;
  if (draft.youtubeUrl.trim() && !youtubeVideoId(draft.youtubeUrl)) {
    return "유튜브 영상 또는 Shorts 주소가 아닙니다.";
  }
  return null;
}
