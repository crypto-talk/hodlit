import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http";
import { adminPollsHref } from "@/lib/routes";
import { closePoll, createPoll, deletePoll, loadPollForDeletion } from "./api";
import { parsePollNumber, pollDeletionError, refreshPollQueries } from "./poll-deletion";

afterEach(() => vi.unstubAllGlobals());

describe("투표 번호와 선택 주소", () => {
  it("번호는 양의 안전한 정수만 받아 원래 투표를 정확히 지정한다", () => {
    expect(parsePollNumber(" 42 ")).toBe(42);
    for (const value of [undefined, "", "0", "-1", "1.5", "1e2", "12abc", "9007199254740992"]) {
      expect(parsePollNumber(value)).toBeNull();
    }
    expect(adminPollsHref("ETH", 42)).toBe("/admin/polls?room=ETH&poll=42");
    expect(adminPollsHref("ETH")).toBe("/admin/polls?room=ETH");
  });
});

describe("삭제 API와 조회", () => {
  it("204 빈 응답을 처리하며 번호가 맞는 투표에 DELETE 한 번만 보낸다", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(deletePoll(42)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/v1\/polls\/42$/);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("종료된 투표와 방을 보존하며 집계 필드는 전달하지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          id: 42,
          coinSymbol: "ETH",
          active: false,
          question: "지난 투표",
          totalVotes: 900,
          userChoiceId: 1,
          choices: [{ id: 1, label: "상승", voteCount: 900 }],
        }),
      ),
    );
    expect(await loadPollForDeletion(42)).toEqual({
      id: 42,
      coinSymbol: "ETH",
      active: false,
      question: "지난 투표",
      choices: [{ id: 1, label: "상승" }],
    });
  });

  it("대상 방·상태를 확인할 수 없는 응답은 삭제 대상으로 만들지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: 42, question: "불완전" })),
    );
    await expect(loadPollForDeletion(42)).rejects.toThrow("투표 정보를 확인하지 못했습니다");
  });

  it.each([401, 403, 404, 500])("%i 오류를 성공이나 빈 응답으로 삼키지 않는다", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ message: "삭제 실패" }, { status })),
    );
    await expect(deletePoll(42)).rejects.toMatchObject({ status, message: "삭제 실패" });
  });

  it("기존 생성·종료 요청을 보존한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: 43, active: true, question: "새 질문", choices: [] }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await createPoll("ETH", { question: " 새 질문 ", choices: [" 상승 ", " 하락 "] });
    await closePoll(43);
    expect(fetcher.mock.calls[0][0]).toMatch(/\/communities\/ETH\/polls$/);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      question: "새 질문",
      choices: ["상승", "하락"],
    });
    expect(fetcher.mock.calls[1][0]).toMatch(/\/polls\/43\/close$/);
    expect(fetcher.mock.calls[1][1].method).toBe("POST");
  });
});

describe("삭제 이후 상태", () => {
  it("날짜·사용자·쪽이 다른 투표 캐시는 모두 무효화하고 다른 기능은 유지한다", async () => {
    const client = new QueryClient();
    const keys = [
      ["admin", "poll", "ETH"],
      ["admin", "poll-detail", 42],
      ["room-poll", "ETH", "2026-11-17"],
      ["open-polls", "2026-11-17"],
      ["poll-results", "ETH", 2],
      ["my-votes", 7, 3],
    ];
    for (const key of [...keys, ["news", "ETH"]]) client.setQueryData(key, { cached: true });
    await refreshPollQueries(client);
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["news", "ETH"])?.isInvalidated).toBe(false);
    client.clear();
  });

  it("로그인·권한·이미 삭제·일반 실패를 구분한다", () => {
    const error = (status: number) =>
      new ApiError(status, { code: `HTTP_${status}`, message: "서버 설명" });
    expect(pollDeletionError(error(401))).toContain("다시 로그인");
    expect(pollDeletionError(error(403))).toContain("관리자 권한");
    expect(pollDeletionError(error(404))).toContain("이미 삭제");
    expect(pollDeletionError(error(500))).toBe("서버 설명");
    expect(pollDeletionError(new TypeError("Failed to fetch"))).toContain("다시 조회");
  });
});
