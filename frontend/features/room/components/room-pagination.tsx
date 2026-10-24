import PageLinks from "@/components/page-links";
import { roomHref } from "@/lib/routes";

type Props = {
  symbol: string;
  tab: "all" | "verified";
  /** 지금 쪽. 1부터. */
  page: number;
  totalPages: number;
};

/**
 * 방 게시판 쪽 번호 (HODL-66). 모양은 공용 `components/page-links.tsx`.
 *
 * 쪽은 주소의 `?page=` 다(구조 규칙 8). 누르면 목록 머리(`#room-posts`)로 올라간다 —
 * 맨 아래 번호를 누르고 새 쪽의 끝을 보고 있게 되지 않도록.
 */
export default function RoomPagination({ symbol, tab, page, totalPages }: Props) {
  const tabParam = tab === "verified" ? "verified" : undefined;
  return (
    <PageLinks
      page={page}
      totalPages={totalPages}
      hrefFor={(target) => `${roomHref(symbol, tabParam, target)}#room-posts`}
    />
  );
}
