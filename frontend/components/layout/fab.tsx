import { Button } from "@/components/ui/button";

/**
 * 좁은 화면(<900px)에서만 보이는 글쓰기 버튼.
 * 넓은 화면에서는 헤더의 글쓰기가 같은 자리를 맡는다.
 *
 * 글쓰기 화면은 3단계다. 그때까지는 헤더와 같은 이유로 비활성이다.
 */
export default function Fab() {
  return (
    <div className="fixed right-6 bottom-6 hidden max-shell:block">
      <Button
        type="button"
        variant="primary"
        size="fab"
        className="shadow-[0_4px_16px_rgb(var(--brand-channels)/0.3)]"
        disabled
        title="글쓰기 화면은 아직 준비 중입니다"
      >
        글쓰기
      </Button>
    </div>
  );
}
