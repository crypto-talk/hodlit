"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/*
 * ⚠️ shadcn/ui 원본(`shadcn add sonner`)에서 두 군데만 바꿨다.
 *   1. 테마: 원본은 next-themes 의 `useTheme()` 로 OS 다크모드를 따라간다. 이 서비스는 라이트만
 *      쓰고(D-6) ThemeProvider 도 없어서, 그대로 두면 OS 가 다크일 때 토스트만 검게 뜬다. `light` 로
 *      고정하고 next-themes 는 설치하지 않았다. 다크모드를 붙일 때 되살린다.
 *   2. 색 · 반경 · 글꼴: 원본이 가리키는 `--radius` 는 우리 토큰에 없다. styles/tokens.css 의 토큰을
 *      가리키게 했다. 값은 여기에 적지 않는다.
 *
 * 토스트는 행동 실패(지갑 연결 · 투표 · 발행 등)에만 쓴다(구조 규칙 9). 화면을 막지 않는 알림이다.
 * 띄우는 쪽은 `import { toast } from "sonner"` 로 `toast.error("…")` 처럼 부른다.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          // 오류만 글자색을 바꾼다. 면 · 테두리는 다른 토스트와 같게 둔다.
          error: "text-danger!",
        },
      }}
      style={
        {
          // 토스트 영역이 body 의 Pretendard 를 그대로 쓰게 한다(sonner 기본은 시스템 글꼴).
          fontFamily: "inherit",
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border-subtle)",
          "--border-radius": "var(--corner-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
