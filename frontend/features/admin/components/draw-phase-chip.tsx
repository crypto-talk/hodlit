import { PHASE_LABEL, type AdminDrawPhase } from "../draw-events";

/**
 * 상태 칩 모양. 색만으로 읽히지 않게 글자를 늘 같이 둔다.
 * 지금 사용자가 참여할 수 있는 "진행 중" 만 초록 면, 열린 상태는 테두리, 나머지는 회색이다.
 */
const TONE: Record<AdminDrawPhase, string> = {
  draft: "border-border-subtle text-text-muted",
  expired: "border-dashed border-border-subtle text-text-subtle",
  scheduled: "border-brand text-brand",
  live: "border-transparent bg-success-soft text-success",
  paused: "border-danger text-danger",
  ended: "border-transparent bg-surface-muted text-text-muted",
  unknown: "border-dashed border-danger text-danger",
};

/** 뽑기 이벤트 상태 칩. 목록 줄과 펼친 설정이 같이 쓴다. */
export default function DrawPhaseChip({ phase }: { phase: AdminDrawPhase }) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[phase]}`}
    >
      {PHASE_LABEL[phase]}
    </span>
  );
}
