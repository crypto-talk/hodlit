import type { components } from "@/lib/api-schema";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-token";
import { config } from "@/lib/config";

/**
 * 백엔드 요청 래퍼 (C-4). 백엔드로 나가는 요청은 전부 여기를 지난다.
 *
 * 하는 일
 *   1. baseURL 을 붙이고, 문자열 본문에는 JSON Content-Type 을 세운다
 *   2. 액세스 토큰을 싣고, refresh 쿠키를 위해 `credentials: "include"` 를 건다
 *   3. 401 이면 토큰을 한 번 갱신하고 원래 요청을 딱 한 번 다시 보낸다
 *   4. 실패 응답을 `{ code, message }` 로 정규화한다
 *
 * 아직 하지 않는 것과 그 이유
 *   - 에러 `code` 로 분기하기: 백엔드와 코드 목록을 합의하기 전이다(C-5).
 *     지금은 서버가 code 를 주면 그대로 싣고, 없으면 `HTTP_401` 처럼 채운다.
 *     화면에서는 code 가 아니라 `ApiError.status` 로 분기한다.
 *   - 서버 컴포넌트에서 쿠키를 헤더로 넘기기: access 가 쿠키로 옮겨진 뒤에(B-3)
 *     붙는다. 그때까지 서버 컴포넌트는 로그인 상태가 필요 없는 공개 데이터만
 *     가져온다.
 *
 * 경로는 `/api/v1` 까지 포함해서 넘긴다. `lib/api-schema.ts` 의 키와 같은
 * 문자열이라, 나중에 경로로 응답 타입을 좁힐 때 그대로 쓸 수 있다.
 */

type AuthResponse = components["schemas"]["AuthResponse"];

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
  const response = await send(path, init);

  if (response.status === 401 && canRefresh(path) && (await refreshAccessToken())) {
    return unwrap<T>(await send(path, init));
  }

  return unwrap<T>(response);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);

  // FormData 본문은 브라우저가 boundary 를 붙인 Content-Type 을 직접 세운다.
  // 여기서 덮어쓰면 업로드가 깨지므로 문자열 본문에만 세운다.
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${config.apiUrl}${path}`, { ...init, headers, credentials: "include" });
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

function refreshAccessToken(): Promise<boolean> {
  refreshing ??= runRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function runRefresh(): Promise<boolean> {
  try {
    // 갱신 자체는 http() 를 타지 않는다. 재시도 규칙이 자기 자신에게 걸린다.
    const response = await fetch(`${config.apiUrl}${REFRESH_PATH}`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      clearAccessToken();
      return false;
    }

    const body = (await readBody(response)) as AuthResponse | undefined;
    if (!body?.accessToken) {
      clearAccessToken();
      return false;
    }

    setAccessToken(body.accessToken);
    return true;
  } catch {
    clearAccessToken();
    return false;
  }
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
