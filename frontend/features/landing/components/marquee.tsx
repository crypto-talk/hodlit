import type { MarqueeItem } from "../types";

type Props = {
  items: MarqueeItem[];
};

/**
 * 상단 전광판. 문구가 가로로 흐른다.
 *
 * 끊김 없이 돌리려고 같은 묶음을 두 번 깔고 -50%까지 이동시킨다.
 * 두 번째 묶음은 스크린리더가 두 번 읽지 않도록 aria-hidden 처리한다.
 */
export default function Marquee({ items }: Props) {
  const group = (hidden: boolean) => (
    <div
      className="flex items-center gap-8 pr-8 text-body whitespace-nowrap"
      aria-hidden={hidden || undefined}
    >
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
    <div className="flex items-center gap-4 overflow-hidden bg-brand-soft px-6 py-4">
      <div className="flex-none rounded-sm bg-brand px-2 py-0.5 text-xs font-semibold text-text-inverse">
        지금
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex w-max animate-marquee motion-reduce:animate-none">
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}
