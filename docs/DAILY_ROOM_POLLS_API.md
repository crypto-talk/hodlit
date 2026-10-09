# KST daily room polls (HODL-64)

## Contract

- Public GET `/api/v1/communities/{symbol}/poll`: current active question in one active room; 404 when missing.
- Public GET `/api/v1/polls/{pollId}`: metadata/history of a question. Results are still gated by **today's** participation, not by having voted on any prior day.
- Admin POST `/api/v1/communities/{symbol}/polls`: `{question,choices:["Up","Down"]}`, 201. 2..10 nonblank distinct (case-insensitive trimmed) labels, max 100 characters, question max 200. Creates a new question and closes the previous active question in that room. No daily recreation/deletion.
- Authenticated POST `/api/v1/polls/{pollId}/votes`: `{choiceId}`, positive choice ID belonging to that poll. One vote per member/poll/KST date; repeat/change returns 409, wrong poll choice 400, closed poll 409, missing poll 404.
- Admin POST `/api/v1/polls/{pollId}/close`: 204, disables new participation without deleting history.

Response `{id,coinSymbol,question,active,day,participatedToday,userChoiceId,totalVotes,choices:[{id,label,voteCount}]}`. `day` is YYYY-MM-DD in Asia/Seoul. Before today's participation `userChoiceId`, `totalVotes`, and every choice's `voteCount` are null/omitted under the existing NON_NULL JSON configuration; **no aggregate query is executed** for such a viewer. This applies to anonymous users, other authenticated users and nonparticipating administrators alike. After participation counts cover only that KST date, including zero for unselected choices. No votes or member identities are listed.

The server captures one date after acquiring vote locks and uses it for validation/insertion/response. Midnight changes GET's day and participation status immediately; the same poll persists, previous votes remain in the database, and the same user can choose again on the next date. No cleanup job or daily deletion is needed. A request accepted just before midnight can finish after it, so clients must use response day and refresh at midnight rather than treating a previous-day response as current.

Member locking plus the database unique `(poll_id,member_id,vote_date)` blocks simultaneous duplicate submissions. Poll locks serialize votes with closing/replacement; coin locking prevents competing administrators from leaving multiple active polls in a room. A composite choice FK reinforces choice/poll association. Choices/questions are immutable; create a new question instead of editing options underneath recorded votes.

Admin config matches HODL-62: `ADMIN_MEMBER_IDS` allowlist of persisted members, validated JWT subject, default empty denies all. Identical AdminAccess/config/Compose/example changes are shared, not two separate permission systems. No actual .env/production permissions were modified.

## Frontend handoff

Render the active question and single-choice controls before participation but no result totals/chart. Disable repeat/change after success; on 409 re-fetch, on other errors retain pending choice without claiming success. Only show chart/counts when participatedToday=true and response day equals the current KST day. At KST midnight clear prior result state and re-fetch before showing anything, retaining the same question if still active. Refresh again after voting; do not calculate/obtain other users' results through another endpoint. Administrator creation/close UI must handle server 403. `pnpm gen:api` after deployment.

Migration `011-community-polls.sql`. Backend tests cover KST 23:59:59→00:00:00, same-poll next-day participation, result hiding (including admin), room/choice isolation, permissions, duplicate/concurrent submissions and replacement/close. Frontend integration, admin provisioning and live deployment remain separate.
