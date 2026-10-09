# Edit-post auto drafts (HODL-56)

Authenticated owner-only endpoints:
- `GET /api/v1/posts/{postId}/draft`: resume the single private edit draft; 404 when no draft/original, 403 for another owner's post.
- `PUT /api/v1/posts/{postId}/draft`: create or fully replace that draft, HTTP 200 with DraftResponse. Same SaveDraftRequest as existing `/drafts`; empty title/body allowed. Does not publish, update the original, refresh holdings/prices, or rewrite its verification snapshot.

DraftResponse adds nullable `sourcePostId`. Ordinary drafts have null. The link is server-managed and immutable; client payload cannot reassign a draft to another post. `/drafts` retains the unpaginated recent-save list. Total quota 10 includes both new-post and edit drafts; a full quota rejects creation with 409, never evicts other work. Existing edit drafts remain overwritable at quota. Member-row locking + unique `(member_id,source_post_id)` serialize concurrent upserts.

Published media belonging to that original may be referenced but stay attached to it; new uploads attach to the private draft. Other posts'/owners'/drafts' files are rejected. Deleting a draft never removes original media. Deleting the original keeps recovery payload (a deliberate soft source reference); resume/update-by-post then returns 404, but owner can recover text via `/drafts/{id}` and explicitly create a new-post draft. Deleted original media may no longer exist; do not silently republish it.

Frontend handoff: debounce dirty edits for 1.5 seconds, serialize saves (one in flight, then latest pending payload), indicate saved/error/retrying states, and retain unsaved content on errors/quota conflicts. On re-entry GET the edit draft first; only a true no-draft 404 for an existing owned original should fall back to original content. Resolve other 404/403 without presenting a false save success. Keep original post ID separately from draft ID. On final confirmation use existing PUT `/posts/{postId}`; after success delete `/drafts/{draftId}`. Do not POST a second public post or delete a draft before successful publication. On switching drafts save current dirty content first; use the agreed PC modal/mobile sheet, no draft pagination.

Migration `011-edit-drafts.sql`; no existing changeset modified. Run pnpm gen:api after deployment. Auto-save timing/resume UX are frontend work and not implemented in this backend branch.
