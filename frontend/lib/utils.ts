import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 조건부 클래스 조합 (D-3).
 *
 * clsx 가 조건을 풀고 tailwind-merge 가 충돌을 정리한다.
 * `cn("p-2", isWide && "p-4")` 는 `p-4` 하나만 남는다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
