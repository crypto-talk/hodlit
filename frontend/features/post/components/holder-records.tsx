import HolderBadge from "@/components/holder/holder-badge";
import type { AttachedHolder } from "@/lib/holder-snapshot/attachments";
import { UNSUPPORTED_LABEL, isHolderTier } from "@/lib/holder-snapshot/label";

/**
 * 글 상세의 "작성 시점 보유" — 코인마다 한 줄 (HODL-106).
 *
 * 서버가 준 순서(방 코인 → 고른 순서) 그대로 그린다. 공개할 수 없는 코인은 서버가 빼서 보낸다.
 * 빈 목록이면 "공개된 기록이 없다" 고만 말한다 — 비공개인지, 붙인 게 없는지 화면이 구별할 수
 * 없고, 구별해 보이면 그것 자체가 정보가 된다.
 *
 * 상태 문구는 다른 화면과 같은 `HolderBadge` 를 쓴다.
 */
export default function HolderRecords({
  records,
  room,
  general,
}: {
  records: AttachedHolder[];
  room: string;
  /** 기타 방이면 방 코인 줄이 없다. */
  general: boolean;
}) {
  return (
    <section
      aria-label="작성 시점 보유 정보"
      className="mt-4 rounded-sm border border-border-subtle bg-canvas p-4"
    >
      {records.length === 0 ? (
        <p className="text-sm text-text-muted">보유 기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((record) => {
            const roomCoin = !general && record.symbol === room;
            return (
              <li key={record.symbol} className="flex flex-wrap items-center gap-2">
                <span className="inline-flex w-14 flex-none flex-col">
                  <b className="text-sm font-semibold text-text-primary">{record.symbol}</b>
                  {roomCoin ? <span className="text-[11px] text-text-subtle">방 코인</span> : null}
                </span>
                {record.verifiable ? (
                  <>
                    <HolderBadge
                      badge={record.badge}
                      tier={record.tier}
                      symbol={record.symbol}
                      holderStatus={record.holderStatus}
                      partial={record.partial}
                      position={roomCoin ? "detail" : "list"}
                    />
                    {/* 방 코인의 동물 배지는 구간을 같이 적는다. 같은 구간을 한 번 더 그리지 않는다. */}
                    {record.amount && !(roomCoin && record.badge?.name) ? (
                      <span className="rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-text-muted tabular-nums">
                        {record.amount}
                      </span>
                    ) : null}
                    {isHolderTier(record.tier) ? (
                      <span className="text-sm text-text-primary">{record.holding}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs text-text-muted">{UNSUPPORTED_LABEL}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
