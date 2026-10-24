import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/http.ts` 의 401 처리와 본문 해석을 검사한다.
 *
 * 이 파일을 테스트하는 이유는 틀렸을 때 화면이 깨지지 않기 때문이다. 토큰이
 * 안 실리면 조용히 로그아웃된 것처럼 보이고, 재시도가 새면 갱신 요청이 무한히
 * 나간다. 둘 다 증상만 보고는 원인을 찾기 어렵다.
 *
 * 모듈 변수(토큰 캐시, 진행 중인 갱신)를 쓰므로 테스트마다 모듈을 새로 읽는다.
 */

const API_URL = "http://localhost:8080";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(status === 204 ? null : "", { status });
}

function fakeSessionStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  };
}

type FetchMock = ReturnType<
  typeof vi.fn<(input: unknown, init?: RequestInit) => Promise<Response>>
>;

let fetchMock: FetchMock;

async function load() {
  const http = await import("@/lib/http");
  const token = await import("@/lib/auth-token");
  return { ...http, ...token };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { sessionStorage: fakeSessionStorage() });
  fetchMock = vi.fn<(input: unknown, init?: RequestInit) => Promise<Response>>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("http", () => {
  it("JSON 본문을 파싱해 돌려준다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { symbol: "ETH" }));

    const { http } = await load();

    await expect(http("/api/v1/coins")).resolves.toEqual({ symbol: "ETH" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/api/v1/coins`);
  });

  it("본문 없는 200 을 undefined 로 돌려준다", async () => {
    fetchMock.mockResolvedValue(emptyResponse(200));

    const { http } = await load();

    await expect(http("/api/v1/posts/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("토큰이 있으면 Authorization 을 싣는다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const { http, setAccessToken } = await load();
    setAccessToken("token-1");
    await http("/api/v1/me");

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("문자열 본문에만 JSON Content-Type 을 세운다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const { http } = await load();
    await http("/api/v1/posts", { method: "POST", body: JSON.stringify({ title: "t" }) });
    await http("/api/v1/media", { method: "POST", body: new FormData() });

    const json = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const form = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(json.get("Content-Type")).toBe("application/json");
    expect(form.get("Content-Type")).toBeNull();
  });

  it("401 이면 토큰을 갱신하고 원래 요청을 한 번 다시 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: "token-2" }))
      .mockResolvedValueOnce(jsonResponse(200, { nickname: "호들러" }));

    const { http, getAccessToken } = await load();

    await expect(http("/api/v1/me")).resolves.toEqual({ nickname: "호들러" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("token-2");
  });

  it("갱신이 실패하면 토큰을 지우고 원래 오류를 던진다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: "TOKEN_EXPIRED", message: "만료됐습니다." }))
      .mockResolvedValueOnce(emptyResponse(401));

    const { http, ApiError, setAccessToken, getAccessToken } = await load();
    setAccessToken("token-old");

    const error = await http("/api/v1/me").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: "TOKEN_EXPIRED",
      message: "만료됐습니다.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBeNull();
  });

  it("인증 엔드포인트의 401 은 갱신하지 않는다", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: "아이디 또는 비밀번호를 확인해 주세요." }),
    );

    const { http } = await load();

    await expect(
      http("/api/v1/auth/login", { method: "POST", body: JSON.stringify({}) }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("동시에 401 이 나도 갱신 요청은 한 번만 나간다", async () => {
    let refreshCalls = 0;
    const attempts = new Map<string, number>();

    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200, { accessToken: "token-3" }));
      }
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      return Promise.resolve(attempt === 1 ? emptyResponse(401) : jsonResponse(200, { url }));
    });

    const { http } = await load();
    const [me, assets] = await Promise.all([
      http<{ url: string }>("/api/v1/me"),
      http<{ url: string }>("/api/v1/me/assets"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(me.url).toBe(`${API_URL}/api/v1/me`);
    expect(assets.url).toBe(`${API_URL}/api/v1/me/assets`);
  });

  it("code 가 없는 오류에는 상태 코드를 채운다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    const { http } = await load();

    await expect(http("/api/v1/coins")).rejects.toMatchObject({
      status: 500,
      code: "HTTP_500",
      message: "요청을 처리하지 못했습니다.",
    });
  });
});
