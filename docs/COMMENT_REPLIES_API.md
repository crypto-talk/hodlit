# Single-level comment replies (HODL-60)

`POST /api/v1/posts/{postId}/comments` accepts `{content, replyToCommentId?}`. Omitting/null target creates a root comment. Positive target IDs must name a comment on the same post; missing target returns 404, another post returns 400. Acting member is always from JWT.

Comment response (create/list/update) adds:

- `parentCommentId`: root comment ID, null for a root.
- `replyToCommentId`: actual reply target (may itself be a reply).
- `replyToNickname`: target nickname captured at creation, for the `@닉네임` label.

Replying to any reply appends a sibling under its root, never a third nesting level. Edit changes content only. Nickname is stored as plain text and must be rendered with normal React escaping, never raw HTML. Mention notifications are not implemented.

Deletion policy selected for unspecified behavior: deleting a root deletes its replies; deleting a reply preserves sibling replies and nulls their deleted target IDs. Captured target nickname remains available. Database FKs enforce both behaviors. Migration `011-comment-replies.sql` adds nullable reply fields; old comments remain roots.

Frontend handoff: after deployment run `pnpm gen:api`. Provide reply buttons for roots and replies; send the clicked comment's ID as replyToCommentId. Group by parentCommentId and render at most one indentation level. Show `@${replyToNickname}` on the registered reply, keeping it separate from the editable body. On root delete warn that replies are also removed. A missing target ID after deletion does not prevent showing the captured nickname.

Backend is independently based on origin/develop. HODL-49 also extends CommentResponse holder fields; preserve both additions during integration. The shared SocialApiTest changes should be combined, not replaced wholesale.
