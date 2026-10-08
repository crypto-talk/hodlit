/**
 * 글자 수. 본문은 서식 기호를 포함한 Markdown 길이다. 백엔드가 그 길이로 5000자를
 * 센다. 에디터는 입력을 끊지 않으므로 넘으면 빨갛게 보이고 발행 · 저장에서 막힌다.
 *
 * 글쓰기와 수정 화면이 같이 쓴다.
 */
export default function CharCounter({ length, max }: { length: number; max: number }) {
  return (
    <p
      className={`mt-1 text-right text-xs tabular-nums ${length > max ? "text-danger" : "text-text-subtle"}`}
    >
      {length.toLocaleString("ko-KR")} / {max.toLocaleString("ko-KR")}
    </p>
  );
}
