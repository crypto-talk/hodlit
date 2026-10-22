/**
 * 하루 단위로 섞기 (랜딩 "오늘의 투표").
 *
 * 한국 날짜를 시드로 쓰니 같은 날에는 새로고침해도 순서가 같고, 날짜가 바뀌면 달라진다.
 * 투표하려던 칸이 새로고침 한 번에 사라지지 않게 하려고 매번 섞지 않는다.
 * 같은 날이면 모든 사람에게 같은 순서다.
 */
export function orderForDay<T>(items: readonly T[], day: string): T[] {
  const random = mulberry32(fnv1a(day));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 문자열 → 32비트 정수 (FNV-1a). */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 시드가 같으면 같은 수열을 내는 작은 난수기. 0 이상 1 미만. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
