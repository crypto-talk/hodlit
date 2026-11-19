import { publishedHomeNews } from "@/features/news/home-news.server";

export async function GET() {
  try {
    const news = await publishedHomeNews();
    return Response.json(news, { headers: { "Cache-Control": "public, s-maxage=60" } });
  } catch {
    return Response.json([], { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
