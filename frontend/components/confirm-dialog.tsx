"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  /** 제목 아래 설명. 문장 여러 개면 `<p>` 를 여러 개 넘긴다. */
  children?: React.ReactNode;
  confirmLabel: string;
  /** 처리 중 버튼 문구. 없으면 `confirmLabel` 에 "…" 를 붙인다. */
  busyLabel?: string;
  /** 되돌리기 어려운 동작은 빨강(danger), 아니면 브랜드(primary). */
  tone?: "danger" | "primary";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 확인 창. 화면 전체를 흐리게 덮는다. 브라우저 `confirm()` 대신 쓴다.
 *
 * - 열리면 "취소" 에 포커스를 둔다. 실수로 Enter 를 눌러도 실행되지 않게.
 * - Esc · 바깥을 누르면 취소다. 처리 중에는 닫히지 않는다.
 *
 * 방 닫기(관리자 방 관리)에서 쓰던 모양을 옮겼다. 글 삭제는 글 카드만 덮어서 따로 있다.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  tone = "danger",
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-surface/60 px-4 pt-32 backdrop-blur-sm"
      onClick={() => (busy ? undefined : onCancel())}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? descId : undefined}
        className="w-full max-w-sm rounded-lg border border-border-subtle bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-h2 font-semibold break-words text-text-primary">
          {title}
        </h2>
        {children ? (
          <div id={descId} className="mt-2 flex flex-col gap-1 text-sm text-text-muted">
            {children}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelButton} type="button" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            className={tone === "danger" ? "bg-danger hover:bg-danger/90" : ""}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (busyLabel ?? `${confirmLabel} 중…`) : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
