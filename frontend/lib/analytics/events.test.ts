import { describe, expect, it } from "vitest";
import { eventKey, eventProperties, scrub, sourceOf } from "./events";

describe("eventProperties", () => {
  it("명세에 적힌 속성만 만든다", () => {
    expect(eventProperties({ name: "room_viewed", roomSymbol: "eth", source: "home" })).toEqual({
      room_symbol: "ETH",
      source: "home",
    });
    expect(
      eventProperties({ name: "post_viewed", postId: 12, roomSymbol: "ETH", source: "room" }),
    ).toEqual({ post_id: 12, room_symbol: "ETH", source: "room" });
  });

  it("명세에 안 맞는 값이면 보내지 않는다", () => {
    expect(
      eventProperties({ name: "room_viewed", roomSymbol: "../etc", source: "home" }),
    ).toBeNull();
    expect(
      eventProperties({ name: "post_viewed", postId: 0, roomSymbol: "ETH", source: "room" }),
    ).toBeNull();
    expect(
      eventProperties({ name: "room_viewed", roomSymbol: "ETH", source: "evil" as never }),
    ).toBeNull();
  });
});

describe("eventKey", () => {
  it("같은 화면은 같은 키, 다른 글은 다른 키", () => {
    const a = eventKey({ name: "post_viewed", postId: 1, roomSymbol: "ETH", source: "home" });
    const b = eventKey({ name: "post_viewed", postId: 1, roomSymbol: "ETH", source: "room" });
    const c = eventKey({ name: "post_viewed", postId: 2, roomSymbol: "ETH", source: "home" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("sourceOf", () => {
  it("경로를 화면 종류로 줄인다", () => {
    expect(sourceOf(null)).toBe("direct");
    expect(sourceOf("/")).toBe("home");
    expect(sourceOf("/subhodl/ETH")).toBe("room");
    expect(sourceOf("/subhodl/ETH/12")).toBe("post");
    expect(sourceOf("/subhodl/ETH/12/edit")).toBe("write");
    expect(sourceOf("/subhodl/ETH/news")).toBe("room");
    expect(sourceOf("/search?q=secret")).toBe("search");
    expect(sourceOf("/user/3")).toBe("profile");
    expect(sourceOf("/mypage/votes")).toBe("mypage");
    expect(sourceOf("/draw/1")).toBe("other");
  });
});

describe("scrub", () => {
  it("명세에 없는 이벤트는 버린다", () => {
    expect(scrub({ event: "$pageview", properties: {} })).toBeNull();
    expect(scrub({ event: "$autocapture", properties: {} })).toBeNull();
    expect(scrub(null)).toBeNull();
  });

  it("주소 · 유입 경로 · 사람 속성을 지우고 event_id 를 uuid 로 옮긴다", () => {
    const result = scrub({
      uuid: "sdk-made",
      event: "room_viewed",
      properties: {
        room_symbol: "ETH",
        source: "home",
        event_id: "11111111-1111-4111-8111-111111111111",
        $current_url: "https://hodlit.example/search?q=secret",
        $referrer: "https://example.com/?email=a@b.c",
        $referring_domain: "example.com",
        $pathname: "/subhodl/ETH",
        $host: "hodlit.example",
        title: "문서 제목",
        $initial_person_info: { r: "x", u: "y" },
        $session_entry_url: "https://hodlit.example/",
        $lib: "web",
        $set_once: { $initial_current_url: "https://hodlit.example/" },
      },
      $set: { nickname: "호들러" },
      $set_once: { $initial_referrer: "x" },
    });
    expect(result).toEqual({
      uuid: "11111111-1111-4111-8111-111111111111",
      event: "room_viewed",
      properties: {
        room_symbol: "ETH",
        source: "home",
        event_id: "11111111-1111-4111-8111-111111111111",
        $lib: "web",
      },
    });
  });

  it("식별 이벤트는 남긴다", () => {
    expect(scrub({ event: "$identify", properties: { $anon_distinct_id: "a" } })).toEqual({
      event: "$identify",
      properties: { $anon_distinct_id: "a" },
    });
  });
});
