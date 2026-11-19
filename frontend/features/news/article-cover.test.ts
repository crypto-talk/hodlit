import { describe, expect, it } from "vitest";
import { articleCoverFromHtml, publicAddress } from "./article-cover";

const url = new URL("https://publisher.example/articles/report");

describe("publisher cover", () => {
  it("prefers Open Graph and resolves relative paths and HTML entities", () => {
    const html =
      '<head><meta name="twitter:image" content="/other.jpg"><meta content="../image.jpg?a=1&amp;b=2" property="og:image"></head>';
    expect(articleCoverFromHtml(html, url)).toBe("https://publisher.example/image.jpg?a=1&b=2");
  });

  it("uses the Twitter card when the Open Graph URL is unsuitable", () => {
    const html =
      '<meta property="og:image" content="data:text/plain,hello"><meta name="twitter:image" content="/cover.png">';
    expect(articleCoverFromHtml(html, url)).toBe("https://publisher.example/cover.png");
  });

  it("ignores metadata outside the article head", () => {
    expect(
      articleCoverFromHtml('<body><meta property="og:image" content="/story.png">', url),
    ).toBeNull();
  });

  it("accepts public addresses and excludes internal or reserved destinations", () => {
    expect(publicAddress("8.8.8.8")).toBe(true);
    for (const ip of [
      "127.0.0.1",
      "169.254.169.254",
      "10.0.0.1",
      "::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "ff02::1",
    ]) {
      expect(publicAddress(ip)).toBe(false);
    }
  });
});
