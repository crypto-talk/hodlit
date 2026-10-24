/**
 * `?next=` 로 받은 경로를 돌아가도 되는 값으로 좁힌다.
 *
 * ⚠️ 검사 없이 `router.replace(next)` 를 하면 오픈 리다이렉트가 된다.
 * `https://…` 나 `//evil.example` 이 들어오면 로그인 직후 남의 사이트로 보내진다.
 * 그래서 `/` 로 시작하는 **같은 사이트 경로만** 통과시킨다.
 */
export function safeNext(value: string | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  // `//host` 와 `/\host` 는 브라우저가 외부 주소로 읽는다.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
