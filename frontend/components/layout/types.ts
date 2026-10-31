/**
 * 셸이 받는 뷰 모델.
 *
 * 셸(헤더·사이드바·푸터·FAB)은 `components/` 에 있어서 `features/` 를 참조할 수
 * 없다(구조 규칙 1). 그래서 필요한 모양을 여기서 정의하고, 데이터를 만드는
 * `features/room/api.ts` 와 `features/wallet/api.ts` 가 이 타입을 가져다 쓴다.
 * 반대 방향(features → components)은 허용된다.
 */

export type SidebarRoom = {
  operationStatus?: "OPEN" | "CLOSE";
  symbol: string;
  name: string;
  /** 지금 보고 있는 방이면 true. 방 게시판에서 쓴다. */
  current?: boolean;
};

export type SidebarWallet = {
  id: number;
  /** 축약 주소. 전체 주소는 셸까지 내려오지 않는다. */
  shortAddress: string;
  connectedOn: string;
};
