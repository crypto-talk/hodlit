"use client";

import { useEffect, useRef, useState } from "react";
import { marketCoinOf } from "@/lib/market-price/coins";

type Props = {
  symbol: string;
  name: string;
};

const WIDGET_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

const EXCHANGE_NAME: Record<string, string> = {
  UPBIT: "업비트",
  BINANCE: "바이낸스",
  OKX: "OKX",
};

/** `UPBIT:BTCKRW` → `업비트 BTC/KRW` */
function marketLabel(tradingView: string): string {
  const [exchange, market] = tradingView.split(":");
  const quote = ["KRW", "USDT"].find((suffix) => market.endsWith(suffix));
  const pair = quote ? `${market.slice(0, -quote.length)}/${quote}` : market;
  return `${EXCHANGE_NAME[exchange] ?? exchange} ${pair}`;
}

/**
 * 방 대문 캔들 차트 (HODL-63).
 *
 * 차트와 데이터 모두 TradingView 위젯이 그린다. 우리 서버 · CoinGecko 를 거치지 않는다.
 * 위젯 스크립트가 자기 내용(JSON 설정)을 읽고 같은 상자 안에 iframe 을 만든다.
 *
 * 기본값: 1시간봉 캔들, 서울 시간, 한국어. 기간 · 간격은 위젯 안에서 바꿀 수 있다.
 * 심볼은 `lib/market-price/coins.ts` 의 표를 따른다(업비트 원화 마켓 우선).
 *
 * 로딩: "불러오는 중" 문구를 위젯 아래에 깔아 둔다. iframe 은 차트를 그리기 전까지 투명이라
 * 그동안 문구가 보이고, 차트가 그려지면 가려진다. 스크립트가 안 오면(차단 · 네트워크)
 * "다시 시도"를 보여 준다. iframe 안쪽 오류(심볼 없음 등)는 위젯이 자기 화면에 알린다.
 *
 * 위 시세 칸도 업비트 원화 현재가라 두 숫자가 맞는다(시세 칸은 30초마다라 잠깐 어긋날 수 있다).
 * 업비트에 없는 BNB · LTC · TON 은 차트가 해외 USDT 마켓, 시세 칸은 CoinGecko 원화 환산이라
 * 값이 다르다. 그래서 아래에 어느 마켓인지 적는다.
 */
export default function RoomChart({ symbol, name }: Props) {
  const tradingView = marketCoinOf(symbol)?.tradingView ?? null;
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!tradingView) return null;

  return (
    <section
      aria-label={`${name} 차트`}
      className="overflow-hidden rounded-lg border border-border-subtle bg-surface"
    >
      <div className="relative h-[400px] max-shell:h-[320px]">
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-text-muted">
          {failed ? (
            <p>
              차트를 불러오지 못했습니다.{" "}
              <button
                type="button"
                className="font-semibold text-brand"
                onClick={() => {
                  setFailed(false);
                  setAttempt((count) => count + 1);
                }}
              >
                다시 시도
              </button>
            </p>
          ) : (
            <p>차트를 불러오는 중…</p>
          )}
        </div>
        {failed ? null : (
          <TradingViewWidget
            key={`${tradingView}:${attempt}`}
            symbol={tradingView}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <p className="border-t border-border-subtle px-4 py-2 text-xs text-text-muted">
        {marketLabel(tradingView)} ·{" "}
        <a
          href={`https://www.tradingview.com/symbols/${tradingView.replace(":", "-")}/`}
          target="_blank"
          rel="noopener nofollow"
          className="font-semibold text-text-muted hover:text-text-primary"
        >
          TradingView
        </a>
      </p>
    </section>
  );
}

type WidgetProps = {
  symbol: string;
  onError: () => void;
};

/**
 * TradingView 임베드 스크립트를 넣는 자리.
 *
 * TradingView 공식 임베드와 같은 모양(바깥 상자 · 안쪽 `__widget` 상자 · 스크립트)을 effect 에서
 * 만든다. 스크립트가 상자 안을 iframe 으로 바꾸므로 상자 안쪽은 React 가 그리지 않고, 정리할 때
 * 통째로 비운다.
 * 다시 그릴 때(심볼 · 다시 시도)는 `key` 로 새로 만든다.
 *
 * 스크립트는 다음 틱에 붙인다. 개발 모드(StrictMode)는 effect 를 한 번 붙였다 떼고 다시 붙이는데,
 * 바로 붙이면 떼어 낸 첫 스크립트가 받아진 뒤 실행되며 부모를 못 찾아 콘솔 오류를 낸다.
 */
function TradingViewWidget({ symbol, onError }: WidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: "60",
      timezone: "Asia/Seoul",
      theme: "light",
      style: "1",
      locale: "kr",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      withdateranges: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    script.onerror = () => onErrorRef.current();

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";

    const timer = window.setTimeout(() => container.replaceChildren(widget, script), 0);

    return () => {
      window.clearTimeout(timer);
      script.onerror = null;
      container.replaceChildren();
    };
  }, [symbol]);

  return <div ref={containerRef} className="tradingview-widget-container relative h-full w-full" />;
}
