import { config } from "@/lib/config";

/** Cookie authentication through the same-origin BFF. Server calls are public only. */
const REFRESH_PATH = "/api/v1/auth/refresh";
const AUTH_PREFIX = "/api/v1/auth/";
const DEFAULT_MESSAGE = "요청을 처리하지 못했습니다.";

type ApiErrorShape = {
  /** 백엔드와 합의 예정(C-5). 합의 전까지는 `HTTP_<상태코드>` 가 들어간다. */
  code: string;
  message: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, shape: ApiErrorShape) {
    super(shape.message);
    this.name = "ApiError";
    this.status = status;
    this.code = shape.code;
  }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const generation = refreshGeneration;
  const response = await send(path, init);

  if (response.status === 401 && canRefresh(path)) {
    if (await refreshAccessToken(generation)) {
      return unwrap<T>(await send(path, init));
    }
    // 갱신 만료 뒤에는 인증 쿠키 없이 공개 조회를 한 번 더 시도한다.
    const method = init.method?.toUpperCase() ?? "GET";
    if (method === "GET" || method === "HEAD") {
      return unwrap<T>(await send(path, init, "omit"));
    }
  }

  return unwrap<T>(response);
}

async function send(
  path: string,
  init: RequestInit,
  credentials: RequestCredentials = "include",
): Promise<Response> {
  const headers = new Headers(init.headers);

  // FormData 본문은 브라우저가 boundary 를 붙인 Content-Type 을 직접 세운다.
  // 여기서 덮어쓰면 업로드가 깨지므로 문자열 본문에만 세운다.
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.delete("Authorization");
  if (typeof window !== "undefined") headers.set("X-Hodlit-Request", "1");
  const base = typeof window === "undefined" ? config.apiUrl : "";
  return fetch(`${base}${path}`, { ...init, headers, credentials, cache: "no-store" });
}

/**
 * 인증 엔드포인트 자신은 401 을 받아도 갱신하지 않는다. 로그인 실패가
 * refresh 를 부르고 그 refresh 가 다시 401 을 받는 고리를 막는다.
 * 서버에는 refresh 쿠키가 실리지 않으므로 시도할 이유가 없다.
 */
function canRefresh(path: string): boolean {
  return typeof window !== "undefined" && !path.startsWith(AUTH_PREFIX);
}

/**
 * 화면 하나가 401 을 동시에 여러 개 받는 일은 흔하다. 갱신 요청이 하나만
 * 나가도록 진행 중인 약속을 공유하고, 끝나면 비워서 다음 401 이 다시 갱신할 수
 * 있게 한다.
 */
let refreshing: Promise<boolean> | null = null;
let refreshGeneration = 0;

// Session restoration and API retries share the same refresh, including across tabs.
export function refreshAccessToken(generation = refreshGeneration): Promise<boolean> {
  if (generation !== refreshGeneration) return Promise.resolve(true);
  refreshing ??= coordinatedRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks
    ? await navigator.locks.request("hodlit-session", run)
    : run();
}

async function coordinatedRefresh(): Promise<boolean> {
  const run = async () => {
    // Another tab may have refreshed while this tab waited for the lock.
    const probe = await send("/api/v1/me", {});
    if (probe.ok) return true;
    if (probe.status !== 401) return unwrap<boolean>(probe);
    return runRefresh();
  };
  const result = await withSessionLock(
    typeof navigator !== "undefined" && navigator.locks ? run : runRefresh,
  );
  if (result) refreshGeneration += 1;
  return result;
}

async function runRefresh(): Promise<boolean> {
  const response = await send(REFRESH_PATH, { method: "POST" });
  if (response.status === 401) {
    window.dispatchEvent(new Event("hodlit-session-expired"));
    return false;
  }
  // Network errors, 403 and 5xx keep their meaning; they are not a logged-out session.
  await unwrap<unknown>(response);
  return true;
}

async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, await normalizeError(response));
  }
  return (await readBody(response)) as T;
}

/**
 * 백엔드는 삭제처럼 돌려줄 것이 없는 요청에도 204 가 아니라 본문 없는 200 을
 * 준다. `response.json()` 을 바로 부르면 거기서 터진다.
 */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;

  const text = await response.text().catch(() => "");
  if (text.length === 0) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function normalizeError(response: Response): Promise<ApiErrorShape> {
  const body = await readBody(response);

  if (body !== null && typeof body === "object") {
    const record = body as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : `HTTP_${response.status}`,
      message: typeof record.message === "string" ? record.message : DEFAULT_MESSAGE,
    };
  }

  return { code: `HTTP_${response.status}`, message: DEFAULT_MESSAGE };
}
