/**
 * 서버가 준 주소를 `href` · `src` 에 넣어도 되는지 검사한다.
 *
 * 서버도 같은 규칙으로 걸러 저장하지만, `javascript:` 같은 주소가 href 에 들어가면 바로
 * 스크립트가 되니 화면 쪽에서도 한 번 더 막는다. 검사를 통과하지 못하면 null 이고, 부르는 쪽은
 * 링크 없이 글자만 그린다.
 */

/** 바깥 사이트 주소. http(s) 만, 주소에 계정 정보(`user:pass@`)가 없어야 한다. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 우리 사이트 안의 경로(`/subhodl/ETH`). `//evil.example` 처럼 다른 사이트로 읽히는 모양,
 * 역슬래시 · 제어 문자가 든 것은 받지 않는다.
 */
export function safeSitePath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export type SafeLink = { href: string; external: boolean };

/** 사이트 안 경로면 안쪽 링크, http(s) 주소면 바깥 링크. 둘 다 아니면 null. */
export function safeLink(value: string | null | undefined): SafeLink | null {
  const inside = safeSitePath(value);
  if (inside) return { href: inside, external: false };
  const outside = safeExternalUrl(value);
  return outside ? { href: outside, external: true } : null;
}
