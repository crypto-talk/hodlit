import { redirect } from "next/navigation";
import { MYPAGE_WALLET_HREF } from "@/lib/routes";

/** 탭이 지갑 하나뿐이라 바로 보낸다. 탭이 늘면 첫 탭이나 요약 화면으로 바꾼다. */
export default function MypagePage() {
  redirect(MYPAGE_WALLET_HREF);
}
