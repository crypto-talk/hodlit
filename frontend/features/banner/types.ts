import type { SafeLink } from "@/lib/safe-url";

/** 사용자에게 보이는 배너 한 장. 관리용 제목은 공개 응답에 없다. */
export type Banner = {
  id: number;
  /** 화면에 띄울 수 있게 바꾼 이미지 주소. */
  src: string;
  altText: string;
  /** 눌렀을 때 갈 곳. 링크 없는 배너면 null — 누를 수 없는 그림으로 그린다. */
  link: SafeLink | null;
};
