import { afterEach, beforeEach, expect, it, vi } from "vitest";

const member = {
  id: 1,
  nickname: "호들러",
  avatarColor: "#000",
  walletAddress: null,
  assetVisibility: "PRIVATE",
};
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.resetModules();
  const entries = new Map([["cryptalk_access", "saved-access"]]);
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    },
    dispatchEvent: vi.fn(),
  });
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("새로고침은 저장된 access로 먼저 /me를 확인하며 refresh 쿠키에 의존하지 않는다", async () => {
  fetchMock.mockResolvedValue(json(200, member));
  const { refreshSession } = await import("./api");
  await expect(refreshSession()).resolves.toEqual(member);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/me");
  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe(
    "Bearer saved-access",
  );
  expect(fetchMock.mock.calls[0][1]?.credentials).toBe("include");
});

it("만료된 access는 갱신 후 /me를 재조회한다", async () => {
  fetchMock
    .mockResolvedValueOnce(json(401, {}))
    .mockResolvedValueOnce(json(200, { accessToken: "renewed" }))
    .mockResolvedValueOnce(json(200, member));
  const { refreshSession } = await import("./api");
  await expect(refreshSession()).resolves.toEqual(member);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization")).toBe(
    "Bearer renewed",
  );
});

it("실제 세션 만료는 null을 반환하고 저장된 토큰을 제거한다", async () => {
  fetchMock.mockResolvedValue(json(401, {}));
  const { refreshSession } = await import("./api");
  const { getAccessToken } = await import("./auth-token");
  await expect(refreshSession()).resolves.toBeNull();
  expect(getAccessToken()).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).has("Authorization")).toBe(false);
});

it.each([403, 503])("/me의 %s 오류는 로그아웃으로 바꾸지 않는다", async (status) => {
  fetchMock.mockResolvedValue(json(status, {}));
  const { refreshSession } = await import("./api");
  const { getAccessToken } = await import("./auth-token");
  await expect(refreshSession()).rejects.toMatchObject({ status });
  expect(getAccessToken()).toBe("saved-access");
});

it("갱신의 일시적 실패는 토큰을 유지하고 재시도하면 복원된다", async () => {
  fetchMock
    .mockResolvedValueOnce(json(401, {}))
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(json(200, member));
  const { refreshSession } = await import("./api");
  const { getAccessToken } = await import("./auth-token");
  await expect(refreshSession()).rejects.toThrow("offline");
  expect(getAccessToken()).toBe("saved-access");
  await expect(refreshSession()).resolves.toEqual(member);
});

it("중복 복원과 일반 요청의 401은 갱신을 한 번만 보낸다", async () => {
  let refreshed = false;
  fetchMock.mockImplementation(async (input, init) => {
    if (String(input).endsWith("/auth/refresh")) {
      refreshed = true;
      return json(200, { accessToken: "renewed" });
    }
    const auth = new Headers(init?.headers).get("Authorization");
    return json(refreshed && auth === "Bearer renewed" ? 200 : 401, member);
  });
  const { refreshSession } = await import("./api");
  const { http } = await import("./http");
  const results = await Promise.all([
    refreshSession(),
    refreshSession(),
    http("/api/v1/me/assets"),
  ]);
  expect(results).toEqual([member, member, member]);
  expect(
    fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/auth/refresh")),
  ).toHaveLength(1);
});

it("로그아웃 후 늦게 도착한 갱신은 토큰을 되살리지 않는다", async () => {
  let finish!: (response: Response) => void;
  fetchMock
    .mockResolvedValueOnce(json(401, {}))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(json(401, {}));
  const { refreshSession } = await import("./api");
  const { clearAccessToken, getAccessToken } = await import("./auth-token");
  const restoring = refreshSession();
  await vi.waitFor(() => expect(finish).toBeDefined());
  clearAccessToken();
  finish(json(200, { accessToken: "late" }));
  await expect(restoring).resolves.toBeNull();
  expect(getAccessToken()).toBeNull();
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).has("Authorization")).toBe(false);
});

it.each([403, 503])("refresh의 %s 오류도 세션 만료와 구분한다", async (status) => {
  fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(status, {}));
  const { refreshSession } = await import("./api");
  const { getAccessToken } = await import("./auth-token");
  await expect(refreshSession()).rejects.toMatchObject({ status });
  expect(getAccessToken()).toBe("saved-access");
});

it("이미 갱신된 토큰의 이전 요청이 늦게 401을 받아도 재갱신하지 않는다", async () => {
  let finish!: (response: Response) => void;
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(json(200, member));
  const { refreshSession } = await import("./api");
  const { setAccessToken } = await import("./auth-token");
  const restoring = refreshSession();
  await vi.waitFor(() => expect(finish).toBeDefined());
  setAccessToken("new-access");
  finish(json(401, {}));
  await expect(restoring).resolves.toEqual(member);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization")).toBe(
    "Bearer new-access",
  );
});
