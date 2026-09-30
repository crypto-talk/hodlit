import type { MarqueeItem } from "../types";

type Props = {
  items: MarqueeItem[];
};

/**
 * 상단 전광판. 문구가 가로로 흐릅니다.
 *
 * 끊김 없이 돌리려고 같은 묶음을 두 번 깔고 -50%까지 이동시킵니다.
 * 두 번째 묶음은 스크린리더가 두 번 읽지 않도록 aria-hidden 처리합니다.
 */
export default function Marquee({ items }: Props) {
  const group = (hidden: boolean) => (
    <div className="hd-marquee-group" aria-hidden={hidden || undefined}>
      {items.map((item, index) => (
        <div key={index}>
          {item.lead ? <span className="font-semibold">{item.lead}</span> : null}
          {item.text}
          {item.value ? <span className="font-semibold tabular-nums">{item.value}</span> : null}
        </div>
      ))}
    </div>
  );

  return (
    <div className="hd-marquee">
      <div className="hd-marquee-chip">지금</div>
      <div className="hd-marquee-viewport">
        <div className="hd-marquee-track">
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}
