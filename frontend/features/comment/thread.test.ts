import { describe, expect, it } from "vitest";
import { toCommentView } from "./api";
import { groupComments } from "./thread";
import type { CommentView } from "./types";

function comment(
  id: number,
  reply?: { parent: number; to?: number | null; nickname?: string },
): CommentView {
  return {
    id,
    memberId: id,
    nickname: `회원${id}`,
    content: `내용${id}`,
    createdAt: "2026-10-23T00:00:00Z",
    edited: false,
    holder: null,
    parentCommentId: reply ? reply.parent : null,
    replyToCommentId: reply ? (reply.to === undefined ? reply.parent : reply.to) : null,
    replyToNickname: reply ? (reply.nickname ?? `회원${reply.parent}`) : null,
  };
}

const ids = (threads: ReturnType<typeof groupComments>) =>
  threads.map((thread) => [thread.root.id, thread.replies.map((reply) => reply.id)]);

describe("groupComments", () => {
  it("답글을 루트 아래로 묶고 서버 순서를 지킨다", () => {
    const list = [
      comment(1),
      comment(2),
      comment(3, { parent: 1 }),
      comment(4, { parent: 2 }),
      // 답글(3)에 답해도 루트(1) 아래 형제로 온다
      comment(5, { parent: 1, to: 3, nickname: "회원3" }),
    ];
    expect(ids(groupComments(list))).toEqual([
      [1, [3, 5]],
      [2, [4]],
    ]);
  });

  it("답글이 없으면 루트만 있다", () => {
    expect(ids(groupComments([comment(1), comment(2)]))).toEqual([
      [1, []],
      [2, []],
    ]);
  });

  it("루트가 목록에 없는 답글은 버리지 않고 루트처럼 그린다", () => {
    expect(ids(groupComments([comment(1), comment(7, { parent: 99 })]))).toEqual([
      [1, []],
      [7, []],
    ]);
  });

  it("대상이 지워져 replyToCommentId 가 null 이어도 같은 루트에 남는다", () => {
    const threads = groupComments([
      comment(1),
      comment(5, { parent: 1, to: null, nickname: "회원3" }),
    ]);
    expect(ids(threads)).toEqual([[1, [5]]]);
    expect(threads[0].replies[0].replyToNickname).toBe("회원3");
  });
});

describe("toCommentView 답글 필드", () => {
  it("예전 댓글처럼 답글 필드가 빠져 오면 루트다", () => {
    const view = toCommentView({ id: 1, content: "a", createdAt: "2026-10-23T00:00:00Z" });
    expect(view.parentCommentId).toBeNull();
    expect(view.replyToCommentId).toBeNull();
    expect(view.replyToNickname).toBeNull();
  });

  it("답글 필드를 그대로 옮긴다", () => {
    const view = toCommentView({
      id: 5,
      content: "b",
      parentCommentId: 1,
      replyToCommentId: 3,
      replyToNickname: "호들러",
    });
    expect(view).toMatchObject({
      parentCommentId: 1,
      replyToCommentId: 3,
      replyToNickname: "호들러",
    });
  });
});
