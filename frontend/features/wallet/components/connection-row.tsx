"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** 줄 제목. 지갑은 축약 주소, 거래소는 이름. */
  label: string;
  connectedOn: string;
  /** 확인 문구에 들어가는 이름 — "이 지갑 연결" · "업비트 연결". 뒤에 "을 해제할까요?" 가 붙는다. */
  target: string;
  pending: boolean;
  onDisconnect: () => void;
};

/**
 * 지갑 · 거래소 한 줄. "해제"를 누르면 그 줄에 확인이 펼쳐진다.
 *
 * 해제하면 이후 글 · 댓글의 보유 인증이 바로 달라져서 한 번 더 묻는다. 모달 대신 줄 안에서
 * 묻는 것은 어느 줄을 지우는지 눈앞에 보이게 하려는 것이다.
 */
export default function ConnectionRow({
  label,
  connectedOn,
  target,
  pending,
  onDisconnect,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="border-b border-border-subtle py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tabular-nums">{label}</span>
        <span className="flex-none text-xs text-text-muted">{connectedOn} 연결</span>
        {confirming ? null : (
          <button
            type="button"
            className="flex-none cursor-pointer rounded-sm border border-border-subtle px-3 py-1 text-xs font-semibold text-text-primary transition-colors hover:border-danger hover:text-danger"
            onClick={() => setConfirming(true)}
          >
            해제
          </button>
        )}
      </div>

      {confirming ? (
        <div className="mt-3 rounded-md bg-canvas p-3">
          <p className="text-sm">{target}을 해제할까요?</p>
          <p className="mt-1 text-xs text-text-muted">
            이미 쓴 글 · 댓글의 배지는 그대로 남고, 앞으로 쓰는 글부터 보유 인증이 달라집니다.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="primary" disabled={pending} onClick={onDisconnect}>
              {pending ? "해제 중…" : "해제"}
            </Button>
            <Button type="button" disabled={pending} onClick={() => setConfirming(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
