import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/*
 * ⚠️ shadcn/ui 원본에서 클래스 문자열만 아트보드 값으로 바꿨다. 구조(cva · asChild ·
 * data-slot)는 원본 그대로라 upstream 변경을 따라갈 때 읽어 볼 수 있다.
 *
 * 색·크기·반경은 styles/tokens.css 의 토큰을 가리킨다. 값은 여기에 적지 않는다.
 * 원본의 focus-visible 링은 남겼다 — 예전 .hd-btn 에는 없던 것이고, 키보드로
 * 다닐 때만 보인다.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm border text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 기본. 흰 면에 옅은 테두리, hover 에 테두리만 진해진다. */
        secondary: "border-border-subtle bg-surface text-text-primary hover:border-text-muted",
        /** 강조. 브랜드 면. */
        primary: "border-transparent bg-brand text-text-inverse hover:bg-brand-hover",
      },
      size: {
        default: "px-4 py-2.5",
        /** 떠 있는 글쓰기 버튼. 손가락으로 누르는 크기다. */
        fab: "px-6 py-4",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "secondary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
