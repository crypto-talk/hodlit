import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 좁은 화면(<900px)에서만 보이는 글쓰기 버튼.
 * 넓은 화면에서는 헤더의 글쓰기가 같은 자리를 맡는다.
 *
 * `href` 는 셸 레이아웃이 정한다. 방 안이면 그 방을 미리 고른 글쓰기다.
 */
export default function Fab({ href = "/write" }: { href?: string }) {
  return (
    <div className="fixed right-6 bottom-6 hidden max-shell:block">
      <Button
        asChild
        variant="primary"
        size="fab"
        className="shadow-[0_4px_16px_rgb(var(--brand-channels)/0.3)]"
      >
        <Link href={href}>글쓰기</Link>
      </Button>
    </div>
  );
}
