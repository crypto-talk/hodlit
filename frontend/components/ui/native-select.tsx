import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * shadcn/ui native-select 를 토큰 값으로 옮겼다. 브라우저 기본 <select> 를 그대로 쓰고
 * 화살표만 lucide 아이콘으로 바꾼다. 모양은 Input 과 같다.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <span data-slot="native-select-wrapper" className={cn("relative inline-flex", className)}>
      <select
        data-slot="native-select"
        className="h-10 w-full min-w-0 cursor-pointer appearance-none rounded-sm border border-border-subtle bg-surface pr-8 pl-3 text-sm text-text-primary outline-none focus:border-text-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60"
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted"
      />
    </span>
  );
}

export { NativeSelect };
