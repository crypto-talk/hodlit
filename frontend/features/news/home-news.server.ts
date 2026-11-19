import { unstable_cache } from "next/cache";
import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import { isGeneralRoom, isOpenRoom } from "@/lib/room-status";
import { loadRoomNews } from "./api";
import { loadArticleCover } from "./article-cover";
import type { HomeNewsCard } from "./types";

const CARD_LIMIT = 4;
const coverFor = unstable_cache(loadArticleCover, ["article-cover-v1"], { revalidate: 3600 });

export async function publishedHomeNews(): Promise<HomeNewsCard[]> {
  const signal = AbortSignal.timeout(4000);
  const coins = await http<components["schemas"]["CoinResponse"][]>("/api/v1/coins", { signal });
  const rooms = coins.flatMap((coin) =>
    coin.symbol && isOpenRoom(coin) && !isGeneralRoom(coin.symbol) ? [coin.symbol] : [],
  );
  const results = await Promise.allSettled(
    rooms.map(async (symbol) => {
      const { items } = await loadRoomNews(symbol, 1, CARD_LIMIT, signal);
      return items.map((item) => ({ ...item, symbol }));
    }),
  );
  const latest = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
    .slice(0, CARD_LIMIT);
  return Promise.all(
    latest.map(async (item) => ({
      ...item,
      cover: item.sourceUrl ? await coverFor(item.sourceUrl) : null,
    })),
  );
}
