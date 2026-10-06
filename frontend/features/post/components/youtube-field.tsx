"use client";

import { youtubeVideoId } from "../limits";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

/**
 * 유튜브 링크 한 개. 동영상은 직접 업로드하지 않고 링크 임베드로만 받는다.
 *
 * 미리보기는 썸네일 이미지만 띄운다. iframe 을 넣으면 쓰는 동안 유튜브
 * 스크립트가 통째로 따라 들어온다. 서버도 같은 주소(`i.ytimg.com/.../hqdefault.jpg`)를
 * 썸네일로 저장한다.
 */
export default function YoutubeField({ value, onChange, disabled }: Props) {
  const videoId = youtubeVideoId(value);
  const invalid = value.trim().length > 0 && !videoId;

  return (
    <section aria-label="유튜브 링크" className="mt-4">
      <input
        className="h-10 w-full rounded-sm border border-border-subtle bg-canvas px-3 text-sm text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand aria-invalid:border-danger"
        aria-label="유튜브 링크"
        aria-invalid={invalid}
        placeholder="유튜브 링크 (선택) — youtube.com/watch?v=… · youtu.be/… · Shorts"
        value={value}
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      {invalid ? (
        <p className="mt-1 text-xs text-danger">유튜브 영상 또는 Shorts 주소가 아닙니다.</p>
      ) : null}
      {videoId ? (
        <div className="mt-2 flex items-center gap-3 rounded-sm border border-border-subtle bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 썸네일 한 장, 최적화 대상 아님 */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt="유튜브 썸네일"
            className="h-16 w-28 flex-none rounded-sm object-cover"
          />
          <p className="min-w-0 truncate text-xs text-text-muted">
            영상 {videoId} · 글에 링크로 붙습니다
          </p>
          <div className="flex-1" />
          <button
            type="button"
            className="flex-none text-xs text-text-muted hover:text-text-primary"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            빼기
          </button>
        </div>
      ) : null}
    </section>
  );
}
