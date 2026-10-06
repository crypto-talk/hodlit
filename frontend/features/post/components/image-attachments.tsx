"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageItem } from "../hooks/use-image-uploads";
import { IMAGE_MAX, IMAGE_TYPES } from "../limits";

type Props = {
  items: ImageItem[];
  notice: string;
  full: boolean;
  disabled: boolean;
  onAdd: (files: Iterable<File>) => void;
  onRemove: (key: string) => void;
};

/**
 * 이미지 첨부 칸. 버튼으로 고르거나 끌어다 놓는다.
 *
 * 본문 안 커서 위치에 끼우는 것은 리치텍스트 에디터(E-2)가 들어온 뒤의 일이다.
 * 지금은 본문 아래에 올린 순서대로 붙는다.
 *
 * 미리보기는 로컬 objectURL 이라 `next/image` 를 쓰지 않는다. 최적화할 원격
 * 이미지가 아니다.
 */
export default function ImageAttachments({
  items,
  notice,
  full,
  disabled,
  onAdd,
  onRemove,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || full;

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (blocked) return;
    onAdd(Array.from(event.dataTransfer.files));
  };

  return (
    <section aria-label="이미지 첨부" className="mt-4">
      <div
        className={cn(
          "rounded-sm border border-dashed border-border-subtle bg-surface p-4",
          dragging && "border-brand bg-brand-soft",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!blocked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm border border-border-subtle bg-canvas px-3 py-2 text-sm font-semibold text-text-primary hover:border-text-muted disabled:cursor-default disabled:opacity-60"
            onClick={() => input.current?.click()}
            disabled={blocked}
          >
            <ImagePlus aria-hidden />
            이미지 추가
          </button>
          <p className="text-xs text-text-muted">
            끌어다 놓아도 됩니다 · JPG·PNG·WEBP·GIF 25MB · 글당 {IMAGE_MAX}장 ({itemsCount(items)}/
            {IMAGE_MAX})
          </p>
          <input
            ref={input}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) onAdd(Array.from(event.target.files));
              // 같은 파일을 다시 고를 수 있도록 비운다.
              event.target.value = "";
            }}
          />
        </div>

        {items.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item) => (
              <li
                key={item.key}
                className="relative overflow-hidden rounded-sm border border-border-subtle bg-canvas"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 objectURL 미리보기 */}
                <img
                  src={item.preview}
                  alt={item.name}
                  className={cn(
                    "aspect-square w-full object-cover",
                    item.status !== "done" && "opacity-50",
                  )}
                />
                {item.status === "uploading" ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-text-primary" aria-label="업로드 중" />
                  </span>
                ) : null}
                {item.status === "error" ? (
                  <p className="absolute inset-x-0 bottom-0 bg-surface/90 p-1 text-xs text-danger">
                    {item.error}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-surface/90 p-1 text-text-primary hover:bg-surface"
                  onClick={() => onRemove(item.key)}
                  aria-label={`${item.name} 빼기`}
                  disabled={disabled}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="mt-2 text-xs text-danger">
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3 rounded-sm border border-border-subtle bg-surface p-3">
          <p className="text-sm font-semibold text-text-primary">
            첨부한 이미지는 인증으로 인정되지 않습니다
          </p>
          <p className="mt-1 text-xs text-text-muted">
            거래소 화면을 캡처해 올려도 배지는 붙지 않습니다. 보유 인증은 지갑 연결로만 이뤄집니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function itemsCount(items: ImageItem[]): number {
  return items.filter((item) => item.status !== "error").length;
}
