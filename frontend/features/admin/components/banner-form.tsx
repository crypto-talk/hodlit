"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAdminImage } from "../api";
import { adminErrorMessage } from "../error-message";
import { BANNER_MAX, bannerImageProblem, bannerProblems } from "../limits";
import type { AdminBanner, BannerInput } from "../types";
import Field from "./field";

type Props = {
  /** 고칠 때는 지금 배너, 새로 등록할 때는 없다. */
  initial?: AdminBanner;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: BannerInput) => void;
  onCancel: () => void;
};

const EMPTY: BannerInput = { title: "", imageUrl: "", altText: "", linkUrl: "", visible: true };

/**
 * 배너 등록 · 수정 폼 (HODL-92).
 *
 * - 이미지는 고르는 즉시 올리고(`POST /media`), 저장할 때는 받은 주소만 보낸다. 글쓰기와 같은 방식이다
 * - 대체 텍스트는 꼭 적는다. 이미지를 못 보는 사람 · 이미지가 안 뜬 화면에 이 글이 나간다
 * - 링크는 비워도 된다. 비우면 눌러도 아무 데도 가지 않는 배너다
 * - 순서는 여기 없다. 목록에서 위 · 아래로 옮긴다
 */
export default function BannerForm({ initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState<BannerInput>(
    initial
      ? {
          title: initial.title,
          imageUrl: initial.imageUrl,
          altText: initial.altText,
          linkUrl: initial.linkUrl,
          visible: initial.visible,
        }
      : EMPTY,
  );
  /** 화면에 띄울 이미지 주소. 새로 올리면 그 주소로 바뀐다. */
  const [preview, setPreview] = useState(initial?.imageSrc ?? "");
  const [tried, setTried] = useState(false);
  const [fileProblem, setFileProblem] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const problems = tried ? bannerProblems(input) : {};
  const set = (patch: Partial<BannerInput>) => setInput((now) => ({ ...now, ...patch }));

  const upload = useMutation({
    mutationFn: uploadAdminImage,
    onSuccess: (stored) => {
      set({ imageUrl: stored.url });
      setPreview(stored.src);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "이미지를 올리지 못했습니다.")),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = bannerImageProblem(file);
    setFileProblem(problem ?? "");
    if (!problem) upload.mutate(file);
  };

  const waiting = busy || upload.isPending;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (upload.isPending || Object.keys(bannerProblems(input)).length > 0) return;
        onSubmit(input);
      }}
    >
      <Field
        label="관리용 제목"
        hint="관리 화면에서만 보입니다. 사용자에게는 보이지 않습니다."
        problem={problems.title}
      >
        {(props) => (
          <Input
            {...props}
            value={input.title}
            maxLength={BANNER_MAX.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-text-muted">이미지</span>
        <div className="flex flex-wrap items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버의 원본. next/image 원격 설정 전
            <img
              src={preview}
              alt={input.altText || "배너 미리보기"}
              className="h-20 max-w-full rounded-sm border border-border-subtle bg-canvas object-contain"
            />
          ) : (
            <span className="flex h-20 w-48 items-center justify-center rounded-sm border border-dashed border-border-subtle text-xs text-text-subtle">
              이미지 없음
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            aria-label="배너 이미지 파일"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              // 같은 파일을 다시 골라도 change 가 나게 비운다.
              event.target.value = "";
            }}
          />
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={waiting}>
            {upload.isPending ? "올리는 중…" : preview ? "이미지 바꾸기" : "이미지 올리기"}
          </Button>
        </div>
        <p
          role={fileProblem || problems.imageUrl ? "alert" : undefined}
          className={`text-xs ${fileProblem || problems.imageUrl ? "text-danger" : "text-text-subtle"}`}
        >
          {fileProblem ||
            problems.imageUrl ||
            "JPG · PNG · WEBP · GIF, 25MB 까지. 홈에서는 16:5 비율로 보이고 넘치는 부분은 잘립니다."}
        </p>
      </div>

      <Field
        label="대체 텍스트"
        hint="이미지 대신 읽히는 설명입니다. 배너에 적힌 내용을 그대로 적습니다."
        problem={problems.altText}
      >
        {(props) => (
          <Input
            {...props}
            value={input.altText}
            maxLength={BANNER_MAX.altText}
            onChange={(event) => set({ altText: event.target.value })}
          />
        )}
      </Field>

      <Field
        label="이동 링크 (선택)"
        hint="사이트 안은 /subhodl/ETH 처럼, 바깥은 https:// 로 시작합니다. 비우면 링크 없는 배너입니다."
        problem={problems.linkUrl}
      >
        {(props) => (
          <Input
            {...props}
            value={input.linkUrl}
            maxLength={BANNER_MAX.url}
            onChange={(event) => set({ linkUrl: event.target.value })}
          />
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          className="size-4 accent-[var(--brand)]"
          checked={input.visible}
          onChange={(event) => set({ visible: event.target.checked })}
        />
        사용자 화면에 노출
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onCancel} disabled={waiting}>
          취소
        </Button>
        <Button variant="primary" disabled={waiting}>
          {busy ? "저장 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
