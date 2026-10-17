import type { Member } from "@/lib/api";
import { config } from "@/lib/config";
import { ApiError, http } from "@/lib/http";

/**
 * 지갑 연결 — Reown AppKit 버전 (HODL-55).
 *
 * AppKit 모달 하나가 브라우저 확장 지갑(EIP-6963)과 WalletConnect 지갑(QR · 모바일 앱)을 함께
 * 보여준다. 사용자가 고르고 연결하면 그 지갑의 EIP-1193 provider 로 서명한다.
 *
 * 서명 순서는 예전과 같다: nonce 발급 → `personal_sign` → `POST /me/wallet`. 백엔드는 서명에서
 * 주소를 역산할 뿐 어떻게 서명했는지 모르므로 백엔드 변경은 없다.
 *
 * `lib/session.tsx` 가 부른다. 헤더 · 사이드바(`components/`)가 세션을 써야 해서 `features/`
 * 가 아니라 `lib/` 에 있다(구조 규칙 1). `lib/api.ts` 에 있던 `linkInjectedWallet` 을 옮겨 왔다.
 *
 * ⚠️ EOA 지갑만 된다. 백엔드는 스마트 컨트랙트 지갑 서명(EIP-1271)을 검증하지 못한다. 그래서
 *   - AppKit 의 이메일 · 소셜 로그인(내장 지갑)을 끈다
 *   - 코인베이스는 일반 지갑(EOA)만 고르게 한다(`coinbasePreference: "eoaOnly"`)
 */

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

/** `@reown/appkit` 의 `AppKit` 에서 이 파일이 쓰는 것만. 패키지를 동적으로 불러와서 타입만 여기 둔다. */
type AppKitLike = {
  open(): Promise<unknown>;
  close(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(): string | undefined;
  getIsConnectedState(): boolean;
  getWalletProvider(): unknown;
  subscribeAccount(
    callback: (state: { address?: string; isConnected: boolean }) => void,
  ): () => void;
  subscribeState(callback: (state: { open: boolean }) => void): () => void;
};

/**
 * 사용자가 모달을 닫거나 지갑에서 거절한 경우. 오류가 아니라서 셸이 일반 토스트로 띄운다.
 */
export class WalletLinkCancelled extends Error {
  constructor() {
    super("지갑에서 연결이나 서명을 취소했습니다. 다시 시도해 주세요.");
    this.name = "WalletLinkCancelled";
  }
}

/** 모달이 닫힌 뒤 연결 결과를 기다리는 시간. 연결 직후 모달이 닫히는 것과 순서가 엇갈릴 수 있다. */
const CLOSE_GRACE_MS = 500;

export async function linkWallet(): Promise<Member> {
  // projectId 가 없으면(로컬에서 아직 안 넣은 경우) 예전처럼 확장 지갑으로만 연결한다.
  if (!config.walletConnectProjectId) return linkInjected();

  const appKit = await loadAppKit();

  try {
    // 지난 연결이 남아 있으면 끊고 시작한다. 남겨 두면 "지갑 추가" 때 같은 지갑이 다시 붙는다.
    if (appKit.getIsConnectedState()) await appKit.disconnect().catch(() => undefined);
    const address = await waitForConnection(appKit);
    await appKit.close().catch(() => undefined);

    const provider = appKit.getWalletProvider() as Eip1193Provider | undefined;
    if (!provider) throw new Error("연결한 지갑을 찾지 못했습니다. 다시 시도해 주세요.");
    return await signAndLink(provider, address);
  } catch (reason) {
    throw friendlyError(reason);
  } finally {
    // 서명 한 번만 필요하다. 연결을 남기지 않는다.
    if (appKit.getIsConnectedState()) await appKit.disconnect().catch(() => undefined);
  }
}

/**
 * 모달을 열고, 지갑이 연결되면 주소를 돌려준다. 연결 없이 모달이 닫히면 취소로 본다.
 */
function waitForConnection(appKit: AppKitLike): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      stopAccount();
      stopState();
      run();
    };

    const stopAccount = appKit.subscribeAccount((account) => {
      if (account.isConnected && account.address) {
        const address = account.address;
        finish(() => resolve(address));
      }
    });

    // 모달이 한 번 열린 뒤에 닫힌 것만 본다. 열리기 전 상태 알림을 닫힘으로 오해하지 않게.
    let opened = false;
    const stopState = appKit.subscribeState((state) => {
      if (state.open) {
        opened = true;
        return;
      }
      if (!opened) return;
      // 연결 직후에도 모달이 닫힌다. 계정 상태가 늦게 올 수 있어 잠깐 기다렸다가 판단한다.
      window.setTimeout(() => {
        const address = appKit.getAddress();
        if (appKit.getIsConnectedState() && address) finish(() => resolve(address));
        else finish(() => reject(new WalletLinkCancelled()));
      }, CLOSE_GRACE_MS);
    });

    appKit.open().catch((reason: unknown) => finish(() => reject(reason)));
  });
}

async function linkInjected(): Promise<Member> {
  const provider = (window as typeof window & { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) throw new Error("EVM 지갑 확장 프로그램을 설치해 주세요.");

  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    return await signAndLink(provider, accounts[0]);
  } catch (reason) {
    throw friendlyError(reason);
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

/**
 * AppKit. 처음 누를 때 한 번만 만든다.
 *
 * 패키지를 동적으로 불러온다. 크고(모달 · ethers 포함) 브라우저에서만 돌아서, 지갑 연결을 누르지
 * 않는 화면의 번들에 넣지 않는다. 만들다 실패하면 다음 클릭에서 다시 만든다.
 */
let appKitPromise: Promise<AppKitLike> | null = null;

function loadAppKit(): Promise<AppKitLike> {
  appKitPromise ??= Promise.all([
    import("@reown/appkit"),
    import("@reown/appkit/networks"),
    import("@reown/appkit-adapter-ethers"),
  ])
    .then(([{ createAppKit }, { mainnet, polygon }, { EthersAdapter }]) => {
      const tokens = getComputedStyle(document.documentElement);
      const appKit = createAppKit({
        adapters: [new EthersAdapter()],
        // 백엔드가 지갑 자산을 읽는 체인. 서명 자체는 체인과 무관하다.
        networks: [mainnet, polygon],
        projectId: config.walletConnectProjectId,
        metadata: {
          name: "Hodlit",
          description: "지갑에 이름표를 붙인 코인 커뮤니티",
          url: window.location.origin,
          icons: [],
        },
        // 서명 한 번만 쓰므로 지갑 기능(송금 · 스왑 · 내역 등)과 내장 지갑은 전부 끈다.
        features: {
          email: false,
          socials: false,
          swaps: false,
          onramp: false,
          send: false,
          history: false,
          analytics: false,
        },
        coinbasePreference: "eoaOnly",
        themeMode: "light",
        themeVariables: {
          // 우리 토큰 값을 그대로 넘긴다. 색을 바꾸려면 styles/tokens.css 를 고친다.
          "--w3m-accent": tokens.getPropertyValue("--brand").trim() || "#6e56f0",
          "--w3m-font-family": getComputedStyle(document.body).fontFamily,
        },
      });
      return appKit as unknown as AppKitLike;
    })
    .catch((reason: unknown) => {
      appKitPromise = null;
      throw reason instanceof Error
        ? reason
        : new Error("지갑 연결 창을 준비하지 못했습니다. 다시 시도해 주세요.");
    });

  return appKitPromise;
}

/**
 * 지갑이 던지는 오류를 화면 문구로.
 *
 * 사용자가 거절하면 EIP-1193 표준 코드 4001 이 온다. 모달을 닫으면 위에서 WalletLinkCancelled 로 바꿔
 * 던진다. 서버 오류(`ApiError`)는 서버 문구를 그대로 둔다 — 이미 다른 회원에 붙은 지갑 등.
 */
function friendlyError(reason: unknown): Error {
  if (reason instanceof ApiError) return reason;

  const code = (reason as { code?: unknown } | null)?.code;
  const message = reason instanceof Error ? reason.message : String(reason ?? "");

  if (code === 4001 || /reject|denied|cancel/i.test(message)) return new WalletLinkCancelled();
  return reason instanceof Error && message
    ? reason
    : new Error("지갑 연결에 실패했습니다. 다시 시도해 주세요.");
}
