import type { SidebarWallet } from "@/components/layout/types";
import type { components } from "@/lib/api-schema";
import { formatDate } from "@/lib/format/time";
import { http } from "@/lib/http";

/**
 * 연결된 지갑 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * 백엔드는 한 회원에 여러 지갑을 붙일 수 있고, 자산은 연결된 지갑을 합산해서
 * 계산한다. 그래서 화면도 "연결됨/안 됨" 두 상태가 아니라 목록이어야 한다.
 */

type WalletResponse = components["schemas"]["WalletResponse"];

/**
 * 축약 주소만 담는다. 전체 주소는 뷰 모델에 넣지 않는다 — 아래 주의 참고.
 *
 * 모양은 사이드바가 정한다. 셸은 `components/` 에 있어서 `features/` 를 볼 수
 * 없으므로(구조 규칙 1) 타입이 거기 있고 여기가 가져다 쓴다.
 */
export type ConnectedWallet = SidebarWallet;

export async function loadWallets(): Promise<ConnectedWallet[]> {
  const wallets = await http<WalletResponse[]>("/api/v1/me/wallets");

  return wallets.filter(hasId).map((wallet) => ({
    id: wallet.id,
    shortAddress: shortenAddress(wallet.address),
    connectedOn: formatDate(wallet.connectedAt),
  }));
}

/**
 * 주소는 앞뒤만 보여준다.
 *
 * ⚠️ 본인 화면이라 전체를 보여줘도 될 것 같지만, 전체 주소가 늘 떠 있으면
 * 스크린샷이나 화면 공유 한 번으로 지갑이 특정된다. 온체인 데이터와 맞춰보면
 * 그 사람의 잔액·거래 내역이 전부 열린다. 지갑 특정 방지가 이 제품의 전제라
 * 내 화면에서도 같은 기준을 지킨다.
 */
function shortenAddress(address: string | undefined): string {
  if (!address) return "";
  return address.length <= 13 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function hasId<T extends { id?: number }>(value: T): value is T & { id: number } {
  return typeof value.id === "number";
}
