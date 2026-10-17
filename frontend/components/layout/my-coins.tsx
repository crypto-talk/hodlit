import { Button } from "@/components/ui/button";
import type { SidebarWallet } from "./types";

type Props = {
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
};

/**
 * 사이드바 '내 코인' 칸. 지갑 연결 버튼과 연결된 지갑 목록이 여기 있다 (HODL-58).
 *
 * 예전에는 따로 떨어진 지갑 카드가 넓은 화면에선 오른쪽 칸, 좁은 화면에선 사이드바 아래에
 * 있었다. 10-08 회의에서 "내 코인에 지갑 연결 버튼을 넣고 기존 지갑 연결 박스는 비운다"로
 * 정해 여기로 합쳤다. 지갑을 연결해야 내 코인 방이 고정되므로 버튼이 그 설명 바로 아래에 온다.
 *
 * 보유 코인의 방을 실제로 고정하는 것은 아직 없다. `/me/assets` 를 부르면 서버가 잔액을 새로
 * 조회하므로(최대 15초) 셸이 화면마다 부르기엔 무겁다. 마이페이지와 함께 정한다.
 */
export default function MyCoins({ wallets, onConnectWallet }: Props) {
  const connected = wallets.length > 0;

  return (
    <div className="mt-2 rounded-lg border border-border-subtle bg-surface p-4">
      <p className="text-sm text-text-muted">
        {connected
          ? "보유 중인 코인의 방이 여기 고정됩니다"
          : "지갑을 연결하면 보유 중인 코인의 방이 여기 고정됩니다"}
      </p>

      {connected ? (
        <ul aria-label="연결된 지갑" className="mt-4 flex flex-col gap-2">
          {wallets.map((wallet) => (
            <li key={wallet.id} className="flex items-baseline gap-2">
              {/* 주소는 앞뒤만 나온다. 축약은 features/wallet 에서 한다. */}
              <span className="min-w-0 flex-1 truncate text-sm tabular-nums">
                {wallet.shortAddress}
              </span>
              <span className="flex-none text-xs text-text-muted">{wallet.connectedOn}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant={connected ? "secondary" : "primary"}
        className="mt-4 w-full"
        onClick={onConnectWallet}
      >
        {connected ? "지갑 추가" : "지갑 연결"}
      </Button>
      <p className="mt-2 text-center text-xs text-text-muted">
        {connected ? "지갑에서 다른 계정을 고르면 추가됩니다" : "연결 안 해도 읽고 쓸 수 있습니다"}
      </p>
    </div>
  );
}
