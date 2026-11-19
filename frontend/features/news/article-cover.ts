import { lookup } from "node:dns";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { isIP } from "node:net";
import { Parser } from "htmlparser2";
import ipaddr from "ipaddr.js";
import { safeExternalUrl } from "@/lib/safe-url";

const MAX_HEAD_BYTES = 256 * 1024;

export function publicAddress(address: string): boolean {
  const ip = ipaddr.process(address);
  if (ip.range() !== "unicast") return false;
  return ip.kind() === "ipv4" || (ip.toByteArray()[0] & 0xe0) === 0x20;
}

function publisherUrl(value: string, base?: URL): URL | null {
  try {
    const url = new URL(value, base);
    if (!safeExternalUrl(url.href) || url.port || !url.hostname.includes(".")) return null;
    if (
      isIP(url.hostname) ||
      url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".localhost")
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function articleCoverFromHtml(html: string, url: URL): string | null {
  let og: string | null = null;
  let twitter: string | null = null;
  let inHead = true;
  new Parser({
    onopentag(name, attrs) {
      if (name === "body") inHead = false;
      if (!inHead || name !== "meta" || !attrs.content?.trim()) return;
      const property = (attrs.property || attrs.name || "").toLowerCase();
      if (property === "og:image" || property === "og:image:url") {
        og ??= publisherUrl(attrs.content, url)?.href ?? null;
      } else if (property === "twitter:image" || property === "twitter:image:src") {
        twitter ??= publisherUrl(attrs.content, url)?.href ?? null;
      }
    },
    onclosetag(name) {
      if (name === "head") inHead = false;
    },
  }).end(html);
  return og ?? twitter;
}

/** The caller supplies only source URLs from published news. Check each redirect
 * and use the validated DNS result for the actual connection, including retries. */
export async function loadArticleCover(source: string): Promise<string | null> {
  let url = publisherUrl(source);
  const signal = AbortSignal.timeout(3000);
  try {
    for (let hop = 0; url && hop <= 3; hop++) {
      const get = url.protocol === "https:" ? httpsGet : httpGet;
      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        get(
          url!,
          {
            signal,
            agent: false,
            headers: { Accept: "text/html", "Accept-Encoding": "identity" },
            lookup(host, options, callback) {
              lookup(host, { all: true, verbatim: false }, (error, addresses) => {
                if (
                  error ||
                  !addresses?.length ||
                  addresses.some(({ address }) => !publicAddress(address))
                ) {
                  callback(error ?? new Error("Unavailable publisher address"), "", 0);
                  return;
                }
                const first = addresses[0];
                if (options.all) callback(null, addresses);
                else callback(null, first.address, first.family);
              });
            },
          },
          resolve,
        ).on("error", reject);
      });
      try {
        if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
          url = response.headers.location ? publisherUrl(response.headers.location, url) : null;
          continue;
        }
        if (
          response.statusCode !== 200 ||
          !response.headers["content-type"]?.toLowerCase().includes("text/html")
        )
          return null;
        const chunks: Buffer[] = [];
        let size = 0;
        let tail = "";
        for await (const chunk of response) {
          const part = Buffer.from(chunk).subarray(0, MAX_HEAD_BYTES - size);
          chunks.push(part);
          size += part.length;
          const scan = tail + part.toString("latin1");
          if (size === MAX_HEAD_BYTES || /<\/head\s*>/i.test(scan)) break;
          tail = scan.slice(-16);
        }
        return articleCoverFromHtml(Buffer.concat(chunks).toString("utf8"), url);
      } finally {
        response.destroy();
      }
    }
  } catch {
    // An unavailable publisher must not hide the registered title and summary.
  }
  return null;
}
