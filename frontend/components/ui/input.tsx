import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * shadcn/ui input 을 토큰 값으로 옮겼다. 관리자 방 검색칸과 같은 모양이다.
 * 색·반경은 styles/tokens.css 의 토큰을 가리킨다.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-sm border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-subtle focus:border-text-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
