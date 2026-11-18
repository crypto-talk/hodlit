import { useId } from "react";

type Props = {
  label: string;
  /** 칸 아래 작은 안내. 문제가 있으면 그 문구가 대신 나온다. */
  hint?: string;
  problem?: string;
  /** 입력 요소를 그린다. 넘겨받은 속성을 입력 요소에 그대로 펼친다. */
  children: (props: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
};

/**
 * 관리자 폼의 한 칸: 이름 + 입력 + 그 칸의 문제. 문제를 폼 맨 아래에 모으지 않고 칸 바로
 * 아래에 둔다 — 어느 칸을 고쳐야 하는지 찾지 않게 하려는 것이다.
 */
export default function Field({ label, hint, problem, children }: Props) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = problem ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-text-muted">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": problem ? true : undefined,
        "aria-describedby": note ? noteId : undefined,
      })}
      {note ? (
        <p
          id={noteId}
          role={problem ? "alert" : undefined}
          className={`text-xs ${problem ? "text-danger" : "text-text-subtle"}`}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
