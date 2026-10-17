import type { SidebarWallet } from "@/components/layout/types";
import type { components } from "@/lib/api-schema";
import { formatDate } from "@/lib/format/time";
import { http } from "@/lib/http";

/**
 * 연결된 지갑 · 거래소 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * 백엔드는 한 회원에 여러 지갑을 붙일 수 있고, 자산은 연결된 지갑과 거래소를 합산해서
 * 계산한다. 그래서 화면도 "연결됨/안 됨" 두 상태가 아니라 목록이어야 한다.
 *
 * 지갑을 새로 연결하는 서명 흐름은 `lib/wallet-link.ts` 에 있다. 셸 헤더 · 사이드바도
 * 세션을 통해 그걸 불러야 해서 `lib/` 에 둔다.
 */

type WalletResponse = components["schemas"]["WalletResponse"];
type ConnectionResponse = components["schemas"]["ConnectionResponse"];

/**
 * 축약 주소만 담는다. 전체 주소는 뷰 모델에 넣지 않는다 — 아래 주의 참고.
 *
 * 모양은 사이드바가 정한다. 셸은 `components/` 에 있어서 `features/` 를 볼 수
 * 없으므로(구조 규칙 1) 타입이 거기 있고 여기가 가져다 쓴다.
 */
export type ConnectedWallet = SidebarWallet;

export type ExchangeCode = NonNullable<ConnectionResponse["exchange"]>;

export type ConnectedExchange = {
  code: ExchangeCode;
  name: string;
  connectedOn: string;
};

const EXCHANGE_NAME: Record<ExchangeCode, string> = {
  UPBIT: "업비트",
  BITHUMB: "빗썸",
  COINONE: "코인원",
};

/**
 * 쿼리 키. 회원 id 가 들어가서 로그아웃 · 다른 계정 로그인 때 이전 목록이 새지 않는다.
 * 무효화는 앞부분(`["wallets"]` · `["exchanges"]`)으로 한다.
 */
export function walletsQueryKey(memberId: number | null) {
  return ["wallets", memberId] as const;
}

export function exchangesQueryKey(memberId: number | null) {
  return ["exchanges", memberId] as const;
}

export async function loadWallets(): Promise<ConnectedWallet[]> {
  const wallets = await http<WalletResponse[]>("/api/v1/me/wallets");

  return wallets.filter(hasId).map((wallet) => ({
    id: wallet.id,
    shortAddress: shortenAddress(wallet.address),
    connectedOn: formatDate(wallet.connectedAt),
  }));
}

/**
 * 지갑 연결 해제. 서버가 내 자산 캐시도 비운다.
 * 이미 쓴 글 · 댓글의 보유 기록은 발행 때 고정된 것이라 그대로 남는다.
 */
export async function disconnectWallet(walletId: number): Promise<void> {
  await http<void>(`/api/v1/me/wallets/${walletId}`, { method: "DELETE" });
}

export async function loadExchanges(): Promise<ConnectedExchange[]> {
  const connections = await http<ConnectionResponse[]>("/api/v1/me/exchanges");

  return connections.filter(hasExchange).map((connection) => ({
    code: connection.exchange,
    name: EXCHANGE_NAME[connection.exchange],
    connectedOn: formatDate(connection.connectedAt),
  }));
}

/**
 * 거래소 연결 해제. 서버가 저장된 암호화 키와 내 자산 캐시를 지운다.
 *
 * 계정 확인값이 없어 "재연결해 주세요" 로만 답하는 예전 연결도 지울 수 있다. 그런
 * 연결이 남아 있으면 모든 코인 조회가 불완전(PARTIAL)으로 남는다(HODL-74).
 */
export async function disconnectExchange(exchange: ExchangeCode): Promise<void> {
  await http<void>(`/api/v1/me/exchanges/${exchange}`, { method: "DELETE" });
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

function hasExchange(
  value: ConnectionResponse,
): value is ConnectionResponse & { exchange: ExchangeCode } {
  return value.exchange !== undefined && value.exchange in EXCHANGE_NAME;
}
