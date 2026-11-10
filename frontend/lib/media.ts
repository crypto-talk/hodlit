import { config } from "@/lib/config";
import { safeExternalUrl } from "@/lib/safe-url";

const MEDIA_PREFIX = "/api/v1/media/";

/**
 * 서버가 준 이미지 주소를 `<img src>` 에 넣을 수 있는 주소로 바꾼다. 쓸 수 없는 모양이면 null.
 *
 * - `/api/v1/media/…` 는 백엔드가 올려 둔 파일이다. 백엔드 주소를 앞에 붙인다
 * - `https://…` 는 바깥 이미지다(뽑기 상품 이미지가 이럴 수 있다). http(s) 만 받는다
 *
 * 그 밖의 값(`javascript:` · 다른 경로)은 버린다. 부르는 쪽은 이미지 없이 그린다.
 */
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(MEDIA_PREFIX)) return `${config.apiUrl}${url}`;
  return safeExternalUrl(url);
}
