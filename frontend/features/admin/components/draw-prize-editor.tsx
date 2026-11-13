"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imageSrc } from "@/lib/media";
import { uploadAdminImage } from "../api";
import { DRAW_PRIZE_MAX, formatOdds, parseWeight, prizeOdds, prizeProblems } from "../draw-events";
import { adminErrorMessage } from "../error-message";
import { bannerImageProblem } from "../limits";
import type { DrawPrizeInput } from "../types";

const TEXTAREA =
  "min-h-16 w-full rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-subtle focus:border-text-muted aria-invalid:border-danger";
const ICON_BUTTON = "size-9 px-0 py-0";
const LABEL = "text-xs font-semibold text-text-muted";

type Props = {
  prizes: DrawPrizeInput[];
  onChange: (next: DrawPrizeInput[]) => void;
  /** 저장된 것과 다른지. 부모가 계산한다 — 열기 버튼도 이 값을 본다. */
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onRevert: () => void;
};

let nextKey = 0;
const newPrize = (): DrawPrizeInput => ({
  key: `new-${nextKey++}`,
  name: "",
  description: "",
  imageUrl: "",
  weight: "1",
});

/**
 * 뽑기 상품 편집 (HODL-94). 추가 · 삭제 · 순서 · 이름 · 설명 · 이미지 · 가중치.
 *
 * - **가중치 옆에 당첨 확률을 바로 보여 준다.** 확률 = 가중치 / 가중치 합(서버와 같은 식). 숫자만
 *   보고 정하면 "1 · 1 · 98" 이 몇 % 인지 머릿속으로 계산해야 한다
 * - 저장은 전체 교체(`PUT …/prizes`)다. 저장한 것과 달라지면 표시하고 되돌릴 수 있다
 *   (`badge-config-form.tsx` 와 같은 방식)
 * - 이미지는 배너 폼과 같은 함수로 올리거나, https 주소를 직접 적는다
 * - 저장하지 않은 변경이 있으면 이벤트를 열 수 없다 — 부모(`draw-event-panel.tsx`)가 막는다
 */
export default function DrawPrizeEditor({
  prizes,
  onChange,
  dirty,
  busy,
  onSave,
  onRevert,
}: Props) {
  const [tried, setTried] = useState(false);
  const problems = prizeProblems(prizes);
  const shown = tried ? problems : { list: null, rows: {} as Record<number, string> };
  const odds = prizeOdds(prizes.map((prize) => parseWeight(prize.weight)));
  const blocked = problems.list !== null || Object.keys(problems.rows).length > 0;

  const update = (index: number, patch: Partial<DrawPrizeInput>) =>
    onChange(prizes.map((prize, i) => (i === index ? { ...prize, ...patch } : prize)));
  const move = (index: number, offset: number) => {
    const next = [...prizes];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (blocked || !dirty) return;
        onSave();
      }}
    >
      {prizes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-text-muted">
          상품이 없습니다. 상품이 하나 이상 있어야 이벤트를 열 수 있습니다.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {prizes.map((prize, index) => (
            <li key={prize.key}>
              <PrizeRow
                prize={prize}
                index={index}
                last={index === prizes.length - 1}
                odds={odds[index]}
                problem={shown.rows[index]}
                disabled={busy}
                onChange={(patch) => update(index, patch)}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                onRemove={() => onChange(prizes.filter((_, i) => i !== index))}
              />
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          disabled={busy || prizes.length >= DRAW_PRIZE_MAX.count}
          onClick={() => onChange([...prizes, newPrize()])}
        >
          <Plus />
          상품 추가
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {dirty ? (
            <>
              <span className="text-xs font-semibold text-text-primary" role="status">
                저장하지 않은 변경이 있습니다
              </span>
              <Button type="button" disabled={busy} onClick={onRevert}>
                되돌리기
              </Button>
            </>
          ) : (
            <span className="text-xs text-text-muted">저장된 상품과 같습니다</span>
          )}
          <Button variant="primary" disabled={busy || !dirty}>
            {busy ? "저장 중…" : "상품 저장"}
          </Button>
        </div>
      </div>
      {shown.list ? (
        <p role="alert" className="text-right text-xs text-danger">
          {shown.list}
        </p>
      ) : null}
    </form>
  );
}

function PrizeRow({
  prize,
  index,
  last,
  odds,
  problem,
  disabled,
  onChange,
  onUp,
  onDown,
  onRemove,
}: {
  prize: DrawPrizeInput;
  index: number;
  last: boolean;
  odds: number | null;
  problem: string | undefined;
  disabled: boolean;
  onChange: (patch: Partial<DrawPrizeInput>) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileProblem, setFileProblem] = useState("");
  const heading = `${index + 1}번 상품`;
  const preview = imageSrc(prize.imageUrl);

  const upload = useMutation({
    mutationFn: uploadAdminImage,
    onSuccess: (stored) => onChange({ imageUrl: stored.url }),
    onError: (error) => toast.error(adminErrorMessage(error, "이미지를 올리지 못했습니다.")),
  });
  const pick = (file: File | undefined) => {
    if (!file) return;
    const found = bannerImageProblem(file);
    setFileProblem(found ?? "");
    if (!found) upload.mutate(file);
  };
  const id = `draw-prize-${prize.key}`;

  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 id={`${id}-title`} className="text-sm font-semibold text-text-primary">
          {heading}
        </h4>
        <div className="flex gap-1">
          <Button
            type="button"
            className={ICON_BUTTON}
            aria-label={`${heading} 위로`}
            disabled={disabled || index === 0}
            onClick={onUp}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            className={ICON_BUTTON}
            aria-label={`${heading} 아래로`}
            disabled={disabled || last}
            onClick={onDown}
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            className={`${ICON_BUTTON} text-danger hover:border-danger`}
            aria-label={`${heading} 삭제`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 min-[600px]:grid-cols-[1fr_12rem]">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>이름</span>
          <Input
            value={prize.name}
            maxLength={DRAW_PRIZE_MAX.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-weight`} className={LABEL}>
            가중치
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={`${id}-weight`}
              value={prize.weight}
              inputMode="numeric"
              aria-describedby={`${id}-odds`}
              className="w-24 tabular-nums"
              onChange={(event) => onChange({ weight: event.target.value })}
            />
            <span id={`${id}-odds`} className="text-sm whitespace-nowrap text-text-muted">
              당첨{" "}
              <b className="font-semibold text-text-primary tabular-nums">{formatOdds(odds)}</b>
            </span>
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>설명 (선택)</span>
        <textarea
          className={TEXTAREA}
          value={prize.description}
          maxLength={DRAW_PRIZE_MAX.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-image`} className={LABEL}>
          이미지
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버 · 바깥 주소의 원본. next/image 원격 설정 전
            <img
              src={preview}
              // 이름이 바로 옆 칸에 있어 장식으로 둔다. 깨진 주소일 때 대체 글이 칸을 넘치지도 않는다.
              alt=""
              className="size-16 flex-none rounded-sm border border-border-subtle bg-canvas object-cover"
            />
          ) : (
            <span className="flex size-16 flex-none items-center justify-center rounded-sm border border-dashed border-border-subtle text-xs text-text-subtle">
              없음
            </span>
          )}
          <Input
            id={`${id}-image`}
            value={prize.imageUrl}
            placeholder="https:// 주소 또는 올리기"
            maxLength={DRAW_PRIZE_MAX.imageUrl}
            className="min-w-48 flex-1"
            onChange={(event) => onChange({ imageUrl: event.target.value })}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            aria-label={`${heading} 이미지 파일`}
            onChange={(event) => {
              pick(event.target.files?.[0]);
              // 같은 파일을 다시 골라도 change 가 나게 비운다.
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={disabled || upload.isPending}
          >
            {upload.isPending ? "올리는 중…" : "올리기"}
          </Button>
        </div>
        {fileProblem ? (
          <p role="alert" className="text-xs text-danger">
            {fileProblem}
          </p>
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
