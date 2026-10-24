import type { KeyboardEvent } from "react";

/**
 * 댓글 입력칸에서 Enter 로 보낼지. Shift+Enter 는 줄바꿈이다.
 *
 * - 한글 조합 중 Enter 는 글자를 확정하는 키라 보내지 않는다. 안 막으면 마지막 글자가 두 번
 *   들어가거나 조합 중에 보내진다. `isComposing` 이 없는 브라우저(예전 Safari)는 `keyCode 229` 로 본다.
 * - 터치 기기(손가락 입력)는 Shift 가 없어 줄바꿈을 할 수 없게 되므로 Enter 를 그대로 줄바꿈으로 둔다.
 *   보내기는 등록 버튼으로 한다.
 */
export function isSubmitEnter(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  if (event.nativeEvent.isComposing || event.keyCode === 229) return false;
  return !isTouchOnly();
}

function isTouchOnly(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}
