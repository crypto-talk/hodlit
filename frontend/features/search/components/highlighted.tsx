import { highlightParts } from "../highlight";

/** 검색어와 같은 부분을 `<mark>` 로 감싼다. 글자는 React 가 이스케이프한다. */
export default function Highlighted({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightParts(text, q).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-xs bg-brand/15 px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
