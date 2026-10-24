import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MYPAGE_WALLET_HREF } from "@/lib/routes";
import type { SidebarWallet } from "./types";

type Props = {
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
  /** 연결이 진행 중이면 true. 그동안 버튼을 잠근다. */
  connecting: boolean;
};

/**
 * 사이드바 '내 코인' 칸. 지갑 연결 버튼과 연결된 지갑 목록이 여기 있다 (HODL-58).
 *
 * 예전에는 따로 떨어진 지갑 카드가 넓은 화면에선 오른쪽 칸, 좁은 화면에선 사이드바 아래에
 * 있었다. 10-08 회의에서 "내 코인에 지갑 연결 버튼을 넣고 기존 지갑 연결 박스는 비운다"로
 * 정해 여기로 합쳤다. 지갑을 연결해야 내 코인 방이 고정되므로 버튼이 그 설명 바로 아래에 온다.
 *
 * 지갑이 없을 때 버튼을 누르면 AppKit 모달이 열린다(HODL-55). 브라우저 확장 지갑과 QR ·
 * 모바일 지갑이 한 목록에 나와서 여기서 따로 고르게 하지 않는다. 지갑이 있으면 버튼이
 * "지갑 관리"로 바뀌어 마이페이지 지갑 탭(`/mypage/wallet`, HODL-74)으로 간다.
 *
 * 보유 코인의 방을 실제로 고정하는 것은 아직 없다. `/me/assets` 를 부르면 서버가 잔액을 새로
 * 조회하므로(최대 15초) 셸이 화면마다 부르기엔 무겁다. 마이페이지와 함께 정한다.
 */
export default function MyCoins({ wallets, onConnectWallet, connecting }: Props) {
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

      {/*
       * 지갑이 있으면 추가 · 해제는 마이페이지 지갑 탭에서 한다. 사이드바에 해제 버튼까지
       * 두면 칸이 길어지고, 잘못 눌러 해제하기 쉽다.
       */}
      {connected ? (
        <Button asChild variant="secondary" className="mt-4 w-full">
          <Link href={MYPAGE_WALLET_HREF}>지갑 관리</Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          className="mt-4 w-full"
          disabled={connecting}
          onClick={onConnectWallet}
        >
          {connecting ? "지갑 확인 중…" : "지갑 연결"}
        </Button>
      )}
      <p className="mt-2 text-center text-xs text-text-muted">
        {connected ? "지갑 추가 · 해제는 마이페이지에서" : "연결 안 해도 읽고 쓸 수 있습니다"}
      </p>
    </div>
  );
}
