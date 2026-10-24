import { cn } from "@/lib/utils";

/**
 * 예전 지갑 카드 자리의 빈 박스 (HODL-58).
 *
 * 10-08 회의 확정 요구사항: 지갑 연결은 사이드바 '내 코인'(`my-coins.tsx`)으로 옮기고,
 * 기존 지갑 연결 박스는 지우지 않고 안의 내용만 비운다. 그래서 테두리와 높이만 남긴다.
 * 높이는 예전 지갑 카드(로고 · 제목 · 안내 세 줄 · 버튼)와 비슷하게 맞췄다.
 *
 * 넓은 화면(≥1320px)에서는 셸 레이아웃의 오른쪽 칸에, 그보다 좁으면 사이드바 아래에
 * 그린다. 두 자리 모두 렌더하고 CSS 로 하나만 보인다 — 화면 폭을 JS 로 읽으면 첫
 * 렌더에서 자리가 튄다.
 */
export default function WalletBox({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-72 rounded-lg border border-border-subtle bg-surface", className)}
    />
  );
}
