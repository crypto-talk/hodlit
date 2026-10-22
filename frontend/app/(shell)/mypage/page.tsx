import { redirect } from "next/navigation";
import { MYPAGE_WALLET_HREF } from "@/lib/routes";

/**
 * 첫 탭(지갑)으로 바로 보낸다. 내 자산 탭은 서버가 잔액을 다시 읽어 최대 15초가 걸려서
 * 들어오자마자 기다리게 하지 않으려고 첫 탭으로 두지 않았다.
 */
export default function MypagePage() {
  redirect(MYPAGE_WALLET_HREF);
}
