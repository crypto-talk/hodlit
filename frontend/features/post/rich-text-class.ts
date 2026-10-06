/**
 * Markdown 본문을 그리는 곳의 서식.
 *
 * Tailwind 의 preflight 가 제목·목록·인용의 기본 모양을 지우므로 다시 입힌다.
 * 에디터와 글 상세 화면이 같은 모양이어야 쓴 대로 보이므로 한 곳에 둔다.
 */
export const RICH_TEXT_CLASS = [
  "text-body text-text-primary break-words",
  "[&_p+*]:mt-2 [&_*+p]:mt-2",
  "[&_h2]:mt-5 [&_h2]:text-h2 [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:text-body [&_h3]:font-semibold",
  "[&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li+li]:mt-1",
  "[&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-text-muted",
  "[&_code]:rounded-sm [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:text-sm",
  "[&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-surface-muted [&_pre]:p-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_a]:text-brand [&_a]:underline",
  "[&_hr]:my-4 [&_hr]:border-border-subtle",
].join(" ");
