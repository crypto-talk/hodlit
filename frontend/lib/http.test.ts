import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/http.ts` 의 401 처리와 본문 해석을 검사한다.
 *
 * 이 파일을 테스트하는 이유는 틀렸을 때 화면이 깨지지 않기 때문이다. 토큰이
 * 안 실리면 조용히 로그아웃된 것처럼 보이고, 재시도가 새면 갱신 요청이 무한히
 * 나간다. 둘 다 증상만 보고는 원인을 찾기 어렵다.
 *
 * 모듈 변수(진행 중인 갱신)를 쓰므로 테스트마다 모듈을 새로 읽는다.
 */

const API_URL = "";

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
  return http;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { sessionStorage: fakeSessionStorage(), dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", {});
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

  it("쿠키를 사용하고 Authorization을 브라우저에서 주입하지 않는다", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { http } = await load();
    await http("/api/v1/me");
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-Hodlit-Request")).toBe("1");
    expect(init).toMatchObject({ credentials: "include", cache: "no-store" });
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
      .mockResolvedValueOnce(jsonResponse(200, { member: { id: 1 } }))
      .mockResolvedValueOnce(jsonResponse(200, { nickname: "호들러" }));

    const { http } = await load();

    await expect(http("/api/v1/me")).resolves.toEqual({ nickname: "호들러" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("변경 요청에서 갱신이 만료되면 세션 만료를 알리고 원래 오류를 던진다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: "TOKEN_EXPIRED", message: "만료됐습니다." }))
      .mockResolvedValueOnce(emptyResponse(401));

    const { http, ApiError } = await load();

    const error = await http("/api/v1/posts", { method: "POST" }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: "TOKEN_EXPIRED",
      message: "만료됐습니다.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("만료된 쿠키로 401이 난 공개 API는 쿠키 없이 다시 조회한다", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 1 }]));

    const { http } = await load();

    await expect(http("/api/v1/banners")).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/banners",
      expect.objectContaining({ credentials: "omit" }),
    );
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
        return Promise.resolve(jsonResponse(200, { member: { id: 1 } }));
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
  it.each([403, 503])("갱신의 %s 오류를 로그아웃으로 바꾸지 않는다", async (status) => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(emptyResponse(status));
    const { http } = await load();
    await expect(http("/api/v1/me")).rejects.toMatchObject({ status });
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("갱신 후 다시 401이어도 두 번째 갱신을 하지 않는다", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(emptyResponse(401));
    const { http } = await load();
    await expect(http("/api/v1/me")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("403은 갱신하지 않는다", async () => {
    fetchMock.mockResolvedValue(emptyResponse(403));
    const { http } = await load();
    await expect(http("/api/v1/me")).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("갱신 네트워크 오류는 세션 만료를 알리지 않는다", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockRejectedValueOnce(new TypeError("offline"));
    const { http } = await load();
    await expect(http("/api/v1/me")).rejects.toThrow("offline");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it("다른 탭이 갱신한 경우 잠금 안에서 재확인하여 refresh를 생략한다", async () => {
    const request = vi.fn(async (_name, run) => run());
    vi.stubGlobal("navigator", { locks: { request } });
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
    const { http } = await load();
    await expect(http("/api/v1/me")).resolves.toEqual({ id: 1 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith("/auth/refresh"))).toBe(
      true,
    );
  });

  it("늦게 도착한 401은 이미 완료된 갱신을 반복하지 않는다", async () => {
    let late!: (value: Response) => void;
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            late = resolve;
          }),
      )
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValue(jsonResponse(200, { id: 1 }));
    const { http } = await load();
    const first = http("/api/v1/me");
    const second = http("/api/v1/me/assets");
    await first;
    late(emptyResponse(401));
    await second;
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh")),
    ).toHaveLength(1);
  });
});
