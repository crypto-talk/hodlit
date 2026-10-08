import { ApiError } from "@/lib/http";

/** 댓글 작성 · 수정 · 삭제가 실패했을 때 화면에 보일 문구. */
export function commentErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    if (error.status === 403) return "본인이 쓴 댓글만 고치거나 지울 수 있습니다.";
    if (error.status === 404) return "글이나 댓글이 이미 삭제됐습니다. 새로고침해 주세요.";
    return error.message;
  }
  return "처리하지 못했습니다. 네트워크 상태를 확인해 주세요.";
}
