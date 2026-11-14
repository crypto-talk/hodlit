/**
 * `<script type="application/ld+json">` 안에 넣을 문자열. 값에 `</script>` 가 들어 있어도
 * 스크립트가 끊기지 않게 `<` 를 이스케이프한다.
 */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
