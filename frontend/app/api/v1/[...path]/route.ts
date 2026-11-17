import { NextRequest } from "next/server";
import { proxyApi } from "@/lib/api-proxy";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

function handle(request: NextRequest) {
  return proxyApi(request, config.apiUrl, config.secureCookies);
}

export {
  handle as GET,
  handle as HEAD,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
