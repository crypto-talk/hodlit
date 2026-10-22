"use client";

import { formatShare } from "@/lib/format/number";
import { sliceColor } from "./slice-style";
import type { PortfolioSlice } from "../types";

type Props = {
  slices: PortfolioSlice[];
  /** 가운데 큰 글씨. */
  centerValue: string;
  /** 가리킨 조각. 범례와 같은 값을 쓴다. */
  active: string | null;
  onActive: (key: string | null) => void;
};

const SIZE = 200;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** 조각 사이 흰 틈(px). 이웃한 색이 붙어 보이지 않게 한다. */
const GAP = 2;

/**
 * 원형(도넛) 차트. 라이브러리 없이 원 테두리의 점선 길이로 조각을 그린다.
 *
 * 조각은 12시 방향에서 시계 방향으로, 큰 것부터 놓인다. 숫자는 범례가 들고 있어서
 * 차트에는 글자를 얹지 않는다. 마우스를 올리면 그 조각만 진하게 남는다.
 */
export default function PortfolioDonut({ slices, centerValue, active, onActive }: Props) {
  const single = slices.length === 1;
  // 조각마다 시작 위치 = 앞 조각들의 길이 합.
  const starts = slices.map((_, index) =>
    slices.slice(0, index).reduce((sum, s) => sum + s.share * CIRCUMFERENCE, 0),
  );

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="size-48 flex-none"
      role="img"
      aria-label={`자산 비중: ${slices.map((s) => `${s.label} ${formatShare(s.share)}`).join(", ")}`}
    >
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        {slices.map((slice, index) => {
          const length = slice.share * CIRCUMFERENCE;
          // 아주 작은 조각도 점 하나는 보이게 한다. 조각이 하나면 틈 없이 한 바퀴를 채운다.
          const drawn = single ? CIRCUMFERENCE : Math.max(length - GAP, 1);
          const start = starts[index];
          const dim = active !== null && active !== slice.key;

          return (
            <circle
              key={slice.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={sliceColor(slice.colorSlot)}
              strokeWidth={STROKE}
              strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
              strokeDashoffset={-start}
              className="cursor-default transition-opacity"
              opacity={dim ? 0.3 : 1}
              onMouseEnter={() => onActive(slice.key)}
              onMouseLeave={() => onActive(null)}
            >
              <title>{`${slice.label} ${formatShare(slice.share)}`}</title>
            </circle>
          );
        })}
      </g>
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        className="fill-text-muted"
        style={{ fontSize: 12 }}
      >
        총 평가금액
      </text>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        className="fill-text-primary font-bold tabular-nums"
        style={{ fontSize: 20 }}
      >
        {centerValue}
      </text>
    </svg>
  );
}
