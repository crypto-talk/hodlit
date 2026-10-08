/**
 * 보유 표기 등급.
 *
 * - `wallet`   지갑연결 — 연결한 지갑에 그 코인이 있다
 * - `exchange` 거래소연동 — 백엔드에 아직 없어서 지금은 나오지 않는다
 * - `empty`    미보유 — 지갑은 연결했고 잔액 확인도 성공했는데 0개
 * - `none`     미인증 — 연결한 수단이 없거나, 확인이 한 번도 성공하지 못했다
 *
 * `empty` 와 `none` 은 화면에서 같은 무게로 보인다. 플랫폼은 사실만 보여준다.
 */
export type Tier = "wallet" | "exchange" | "empty" | "none";

/**
 * 코인별 보유 인증 지원 여부. 백엔드 `verificationAvailability` 의 값이다.
 *
 * ⚠️ 어떤 코인이 지원되는지는 프론트에 목록으로 두지 않는다. 코인 목록
 * (`GET /coins`)과 글의 스냅샷이 코인마다 이 값을 내려주므로 그걸 따른다.
 * 프론트에 목록을 두면 백엔드가 BTC 인증을 추가해도 프론트를 고치기 전까지
 * 계속 미지원으로 보인다.
 */
export const VERIFICATION_AVAILABILITY = {
  SUPPORTED: "SUPPORTED",
  NOT_SUPPORTED: "NOT_SUPPORTED",
} as const;

/**
 * 발행 시점에 고정된 보유 정보. 백엔드 `HolderSnapshotResponse` 를 그대로 옮긴 것이다 (C-3).
 *
 * 글·댓글 응답의 `holderSnapshot` 필드로 들어온다. 서버가 발행 시 1회 기록하고
 * 이후 UPDATE 하지 않는다. 프론트는 읽기만 한다.
 */
export type HolderSnapshot = {
  /** 그 코인이 보유 인증을 지원하는지. `SUPPORTED` 외에는 인증 자체가 불가능하다. */
  verificationAvailability: string;
  /** `WALLET` | `UNVERIFIED`. 거래소 연동 등급은 백엔드에 아직 없다. */
  verificationLevel: string;
  verifiedHolder: boolean;
  /**
   * ★ 서버가 완성해서 주는 문자열이다. `"10~100 ETH"` 같은 형태이고,
   * 미인증이면 null. 프론트가 수량으로 다시 계산하지 않는다 — 아래 주의 참고.
   */
  quantityBand: string | null;
  /** EVM 인덱서가 붙기 전까지 항상 null. */
  holdingMonths: number | null;
  walletCount: number;
  capturedAt: string;
  blockNumber: number | null;
  syncStatus: string;
};
