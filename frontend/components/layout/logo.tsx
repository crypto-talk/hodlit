/**
 * 호들잇 마크 — 눈 두 개와 입. 5초에 한 번 깜빡입니다.
 * 크기만 다르고 모양은 같아서 한 컴포넌트로 씁니다.
 */
type Props = {
  size: number;
  /** CSS 색 값. 토큰을 쓴다 — `var(--brand)` 처럼. */
  background: string;
  foreground: string;
};

export default function Logo({ size, background, foreground }: Props) {
  const eye = Math.max(3, Math.round(size * 0.11));
  const gap = Math.round(size * 0.16);
  const mouthWidth = Math.round(size * 0.29);
  const mouthHeight = Math.round(size * 0.15);

  return (
    <div
      className="hd-logo"
      style={{
        width: size,
        height: size,
        background,
        gap: Math.round(size * 0.1),
      }}
      aria-hidden="true"
    >
      <div className="hd-logo-eyes" style={{ gap }}>
        <div className="hd-logo-eye" style={{ width: eye, height: eye, background: foreground }} />
        <div className="hd-logo-eye" style={{ width: eye, height: eye, background: foreground }} />
      </div>
      <div
        className="hd-logo-mouth"
        style={{ width: mouthWidth, height: mouthHeight, background: foreground }}
      />
    </div>
  );
}
