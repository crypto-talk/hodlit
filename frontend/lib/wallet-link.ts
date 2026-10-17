import type { Member } from "@/lib/api";
import { config } from "@/lib/config";
import { ApiError, http } from "@/lib/http";

/**
 * 지갑 연결 (HODL-55).
 *
 * 두 가지 길이 있다.
 *   - `injected`      브라우저 확장 지갑(메타마스크 등). `window.ethereum` 을 그대로 쓴다
 *   - `walletconnect` 확장 없이 QR · 모바일 지갑 앱으로. WalletConnect 에 등록된 지갑이면 된다
 *
 * 어느 쪽이든 서명 순서는 같다: nonce 발급 → `personal_sign` → `POST /me/wallet`.
 * 백엔드는 서명에서 주소를 역산할 뿐 어떻게 서명했는지 모른다. 그래서 백엔드 변경은 없고
 * 지갑 객체(EIP-1193 provider)만 바꿔 끼운다.
 *
 * `lib/session.tsx` 가 부른다. 헤더 · 사이드바(`components/`)가 세션을 써야 해서 `features/`
 * 가 아니라 `lib/` 에 있다(구조 규칙 1). `lib/api.ts` 에 있던 `linkInjectedWallet` 을 옮겨 왔다.
 *
 * ⚠️ EOA 지갑만 된다. 스마트 컨트랙트 지갑(Safe 등)의 서명은 백엔드가 검증하지 못한다(EIP-1271 미지원).
 */

export type WalletMethod = "injected" | "walletconnect";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type WalletConnectProvider = Eip1193Provider & {
  accounts: string[];
  session?: unknown;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
};

/** 백엔드가 지갑 자산을 읽는 체인. 서명에는 체인이 필요 없어 선택(optional)으로만 건다. */
const OPTIONAL_CHAINS: [number, ...number[]] = [1, 137]; // 이더리움 · 폴리곤

const CANCELLED = "지갑에서 연결이나 서명을 취소했습니다. 다시 시도해 주세요.";

/** 브라우저 확장 지갑이 있는지. 브라우저에서만 의미가 있다. */
export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!injectedProvider();
}

/** QR · 모바일 연결을 쓸 수 있는지. projectId 가 없으면 버튼을 막는다. */
export function canUseWalletConnect(): boolean {
  return config.walletConnectProjectId.length > 0;
}

export async function linkWallet(method: WalletMethod): Promise<Member> {
  if (method === "injected") return linkInjected();
  return linkWithWalletConnect();
}

async function linkInjected(): Promise<Member> {
  const provider = injectedProvider();
  if (!provider) {
    throw new Error(
      "브라우저 지갑 확장 프로그램이 없습니다. 'QR · 모바일 지갑'으로 연결해 주세요.",
    );
  }

  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    return await signAndLink(provider, accounts[0]);
  } catch (reason) {
    throw friendlyError(reason);
  }
}

/**
 * QR · 모바일 지갑 연결.
 *
 * 매번 새 세션으로 시작하고, 끝나면(성공이든 실패든) 세션을 끊는다. 이 서비스는 서명 한 번만
 * 필요하고 그 뒤로 지갑에 요청할 일이 없다. 세션을 남겨 두면 "지갑 추가" 때 지난번 지갑이 그대로
 * 다시 붙어 다른 지갑을 고를 수 없다.
 */
async function linkWithWalletConnect(): Promise<Member> {
  const provider = await walletConnectProvider();

  try {
    if (provider.session) await provider.disconnect().catch(() => undefined);
    // QR 모달(모바일에서는 지갑 앱 목록)이 열린다. 사용자가 모달을 닫으면 여기서 거절된다.
    await provider.connect();
    return await signAndLink(provider, provider.accounts[0]);
  } catch (reason) {
    throw friendlyError(reason);
  } finally {
    if (provider.session) await provider.disconnect().catch(() => undefined);
  }
}

async function signAndLink(provider: Eip1193Provider, walletAddress: string | undefined) {
  if (!walletAddress) throw new Error("지갑 계정을 선택해 주세요.");

  const nonce = await http<{ nonceId: string; message: string }>("/api/v1/me/wallet/nonce", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });

  const signature = (await provider.request({
    method: "personal_sign",
    params: [nonce.message, walletAddress],
  })) as string;

  return http<Member>("/api/v1/me/wallet", {
    method: "POST",
    body: JSON.stringify({ walletAddress, nonceId: nonce.nonceId, signature }),
  });
}

function injectedProvider(): Eip1193Provider | undefined {
  return (window as typeof window & { ethereum?: Eip1193Provider }).ethereum;
}

/**
 * WalletConnect 지갑 객체. 처음 누를 때 한 번만 만든다.
 *
 * 패키지를 동적으로 불러온다. 크고(QR 모달 포함) 브라우저에서만 돌아서, 지갑 연결을 누르지
 * 않는 화면의 번들에 넣지 않는다. 만들다 실패하면 다음 클릭에서 다시 만든다.
 */
let walletConnect: Promise<WalletConnectProvider> | null = null;

function walletConnectProvider(): Promise<WalletConnectProvider> {
  if (!canUseWalletConnect()) {
    return Promise.reject(
      new Error("QR · 모바일 지갑 연결이 아직 설정되지 않았습니다. 관리자에게 알려 주세요."),
    );
  }

  walletConnect ??= import("@walletconnect/ethereum-provider")
    .then(({ EthereumProvider }) =>
      EthereumProvider.init({
        projectId: config.walletConnectProjectId,
        optionalChains: OPTIONAL_CHAINS,
        showQrModal: true,
        metadata: {
          name: "Hodlit",
          description: "지갑에 이름표를 붙인 코인 커뮤니티",
          url: window.location.origin,
          icons: [],
        },
      }),
    )
    .then((provider) => provider as unknown as WalletConnectProvider)
    .catch((reason: unknown) => {
      walletConnect = null;
      throw reason instanceof Error
        ? reason
        : new Error("QR · 모바일 지갑 연결을 준비하지 못했습니다. 다시 시도해 주세요.");
    });

  return walletConnect;
}

/**
 * 지갑이 던지는 오류를 화면 문구로.
 *
 * 사용자가 거절하면 EIP-1193 표준 코드 4001 이 온다. WalletConnect 는 QR 모달을 닫으면
 * "Connection request reset" 류의 메시지만 준다. 둘 다 취소로 본다.
 * 서버 오류(`ApiError`)는 서버 문구를 그대로 둔다 — 이미 다른 회원에 붙은 지갑 등.
 */
function friendlyError(reason: unknown): Error {
  if (reason instanceof ApiError) return reason;

  const code = (reason as { code?: unknown } | null)?.code;
  const message = reason instanceof Error ? reason.message : String(reason ?? "");

  if (code === 4001 || /reject|denied|cancel|reset|closed/i.test(message)) {
    return new Error(CANCELLED);
  }
  return reason instanceof Error && message
    ? reason
    : new Error("지갑 연결에 실패했습니다. 다시 시도해 주세요.");
}
