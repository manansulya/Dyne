# Dyne — Repository & Architecture Audit

Audit of the baseline commit (`Import Dyne baseline`). No product code was changed to produce
this document.

**How this was verified** (not from reading the README — the README overstates several things):

- `bun install`, `bun run db:push`, `bun run lint` → all succeed.
- `npx tsc --noEmit` → **19 type errors** (hidden in normal builds, see [T1](#t1)).
- Dev server + realtime mini-service started; two real accounts registered
  (`audit1@example.com`, `audit2@example.com`) via `POST /api/auth/register`, logged in over the
  real NextAuth credentials flow, and endpoints exercised with cookies.
- Read paths checked for genuine empty states (they are genuine — see
  [What works](#1-what-genuinely-works)).
- Write paths exercised: courses, tasks, communities, posts, stories, reels, spaces.
- Cross-account authorization probed with account B against account A's objects (IDOR checks).

---

## Stack summary

| Concern | Implementation |
|---|---|
| App | Next.js 16 App Router, single route `/`, view switching in Zustand + `?view=` params |
| Language | TypeScript 5 (strict) — but `next.config.ts` sets `typescript.ignoreBuildErrors: true` |
| DB | SQLite via Prisma 6, 44 models, **schema pushed with `prisma db push --accept-data-loss`; `prisma/migrations/` does not exist** |
| Auth | NextAuth v4 credentials + JWT, bcrypt hashes, user fields cached in the JWT |
| API | 74 route files under `src/app/api/**`, all wrapped in `withUserId()` |
| Realtime | standalone socket.io service `mini-services/realtime/index.ts` on :3003, reached through Caddy `?XTransformPort=3003` |
| Storage | **none** — no object storage, no upload endpoint, no `/api/files` |
| Tests | **none** — no test runner, no test files, no CI config |

---

## 1. What genuinely works

Verified end-to-end against a real database with real accounts.

| Area | Evidence |
|---|---|
| Registration + login + session | `POST /api/auth/register` → 200 + userId; NextAuth credentials callback → 200; `GET /api/me` returns the persisted user |
| Unauthenticated lockout | every probed endpoint returns 401 `You must be signed in to do this.` without a cookie |
| Academic CRUD (courses, tasks, assignments, exams, events, notes, goals, habits, habit logs, study sessions) | real Prisma models, `userId`-scoped queries, zod validation on input; `POST /api/courses`, `POST /api/tasks` verified persisting |
| Assignment progress auto-compute | `recomputeAssignmentProgress()` in `src/app/api/tasks/route.ts` recalculates from child task statuses on every task write |
| Study-hours goal auto-tracking | study session creation increments matching `STUDY_HOURS` goals and auto-completes them |
| Dashboard / analytics aggregates | computed from DB rows; return real zeros on an empty account (no invented numbers) |
| Communities + membership roles | `POST /api/communities` creates the community and an ADMIN `CommunityMember` |
| Posts, comments (nested), votes, likes | real tables with unique constraints (`userId+postId`, `userId+commentId`) |
| Feed & explore | real cursor pagination, sorted from DB; empty account returns `{"posts":[],"nextCursor":null}` and `{"posts":[],"reels":[],"users":[],"hashtags":[]}` |
| Spaces, channels, channel messages, DMs | real models; DM conversations use a sorted-pair get-or-create; soft-delete on messages; cursor pagination |
| Follow / block / mute | real tables with unique constraints |
| Global search | real multi-entity DB search |
| Server-side authorization on the paths that have it | account B could **not** patch A's task (404), delete A's post (403), write A's presence (403), or post to a community it had not joined (403) |
| Realtime channel/DM/community/notification fan-out | socket.io service runs, rooms are joined per channel/conversation/community, API routes broadcast after DB writes; UI degrades to refetch when the socket is down |
| Rate limiting (in-memory) | `src/lib/rate-limit.ts` with per-endpoint limiters |

## 2. What is partially implemented

| # | Item | Detail |
|---|---|---|
| P1 | **Notifications** | Real rows, created on follow / comment / DM / like / story reaction. But: no notification for channel mentions, no per-user notification preferences, and `POST /api/notifications` does not exist (server-generated only, which is correct, but there is no "assignment due tomorrow / exam reminder" generator anywhere in the code despite the README claiming it) |
| P2 | **Presence** | `User.isOnline` / `lastSeen` are written by `PATCH /api/presence/[userId]`, and the socket service tracks sockets per user in memory. The two sources are never reconciled: a hard refresh or a crashed process leaves `isOnline = true` in the DB forever |
| P3 | **Calls** | `Call` model + `/api/call/signaling` (initiate/accept/reject/cancel/end) are real and authorized. There is **no WebRTC anywhere** — no `RTCPeerConnection`, no `getUserMedia`, and no calling UI. The signaling relay in the socket service is dead code ([S1](#s1)) |
| P4 | **Media on posts/stories/reels/messages** | Columns exist (`Post.mediaUrl`, `Story.mediaUrl`, `Reel.videoUrl`, `Message.fileUrl`, `DirectMessage.fileUrl`) and render, but they are user-pasted URL strings, never validated, and there is no upload path ([F1](#f1)) |
| P5 | **Themes** | Light/dark works via `next-themes`, stored in `localStorage` only. Not in the DB, not per-account, does not sync across devices |
| P6 | **Profile editing** | name / username / bio / `avatarUrl` persist via `PATCH /api/profile/me`. `avatarUrl` is validated as `z.string().max(500_000)` — i.e. it is designed to accept a ~500 KB base64 `data:` URL stored in the relational DB |
| P7 | **Community/space customization** | name, description, color, `iconUrl` exist. No banner, no roles beyond the fixed ADMIN/MODERATOR/MEMBER enum, no per-channel permissions, no invite management beyond a single static `inviteCode`, no slow mode, no pinned messages |
| P8 | **Rate limiting** | Real, but per-process in-memory — resets on deploy and does not work across instances |

## 3. What is fake / mock / demo functionality

| # | Item | Detail |
|---|---|---|
| D1 | **Demo seed** (`src/app/api/seed/route.ts`, 600+ lines) | Ships hardcoded courses, assignments, exams, communities with authored post/comment text, spaces with channel messages, and `Math.random()`-generated study sessions. It is user-invokable production functionality from Settings, and it **destroys real data**: 20+ `deleteMany()` calls wipe the caller's courses, assignments, tasks, exams, notes, goals, habits, communities, spaces, posts, comments, conversations and DMs before seeding |
| D2 | **"Reset all data"** in Settings | Same endpoint; irreversible wipe presented as a normal settings action |
| D3 | **README claims** | "voice/video calling", "assignment due tomorrow / exam reminder notifications", "agent-browser end-to-end verification" — none of these exist in the codebase |
| D4 | **Unused schema surface** | `MessageReaction`, `MessageReadReceipt`, `DMReaction`, `DMReadReceipt`, `PostMedia`, `Hashtag`, `PostHashtag`, `Report` have **zero API and zero UI references** — schema-only features that look implemented from the schema |
| D5 | `src/components/ui/sidebar.tsx` random skeleton widths | Cosmetic only (shadcn stock code); legitimate |
| D6 | `Math.random()` colour pickers in `courses`/`habits` routes | Legitimate default-colour selection, not fake data |

## 4. What is frontend-only (no server truth)

| # | Item | Detail |
|---|---|---|
| FE1 | Theme selection | `next-themes` → `localStorage` |
| FE2 | Study timer state | `localStorage["dyne-study-timer"]` is the only home for a running timer; a session row is written only when the timer is stopped, so a crash mid-session loses it |
| FE3 | Recurring calendar events | `WEEKLY` recurrence is expanded client-side in `expandEventInstances()`; the server has no concept of instances, so no server-side reminders/queries can ever see them |
| FE4 | Reply-to in composers | `replyToId` is stored on `Message`/`DirectMessage` but the UI only renders a local quote in the composer; replied-to context is not resolved or displayed on sent messages |
| FE5 | Typing indicators | Pure socket events, no server validation of room membership ([S1](#s1)) |

## 5. What lacks database persistence

- Theme / accent / any appearance preference (FE1).
- Custom status, mood, pronouns, profile links, profile banner, profile accent — **no columns exist at all**.
- Notification preferences (global, per-community, per-channel, per-conversation) — no models.
- Privacy settings (who can message / follow / mention / tag / call / see stories / see activity) — no models.
- Chat appearance (wallpaper, font size, density, autoplay, media auto-download) — no models.
- Per-conversation settings (mute, disappearing messages, read-receipt opt-out) — no models.
- Running study timer (FE2).
- Recurring event instances (FE3).

## 6. What lacks storage infrastructure

<a id="f1"></a>**F1 — there is no file storage layer at all.**

- No upload endpoint, no object-storage client, no local blob directory, no signed URLs, no
  `File`/`Attachment` model, no checksum/size/MIME metadata anywhere.
- The only "media" mechanism is a text URL field the user types in
  (`stories.tsx` → `placeholder="https://…/image.jpg"`, `reels.tsx` → `https://…/video.mp4`,
  profile → `avatarUrl` input).
- Verified: `POST /api/stories` with `{"mediaUrl":"javascript:alert(1)"}` → **200, persisted**;
  `POST /api/reels` with `{"videoUrl":"not-a-url"}` → **200, persisted**.
- `avatarUrl` accepting 500 KB means avatars are intended to be base64 blobs inside SQLite —
  every row read carries the image bytes.
- Consequences: no size limits, no MIME sniffing, no extension checks, no filename sanitization,
  no ownership, no access control, no delete/cleanup, no thumbnails, no progress/cancel/retry, no
  previews for documents/audio, no drag & drop.

## 7. What lacks authorization

| # | Gap | Detail |
|---|---|---|
| A1 | **Realtime service is unauthenticated** ([S1](#s1)) | The socket `auth` handshake trusts a client-supplied `userId` with no token check. Any browser can (a) claim to be any user and flip their presence, (b) `join:channel` / `join:conversation` / `join:community` for **any** id and read all messages in real time, and (c) emit `broadcast:channel-message`, `broadcast:dm`, `broadcast:notification` — i.e. inject arbitrary messages and notifications into other users' clients. This is the single most serious finding |
| A2 | Story visibility | `GET /api/stories` and `POST /api/stories/[id]/view` are open to any authenticated user; account B could view account A's story with no follow/privacy relationship (verified 200). There is no visibility model to enforce |
| A3 | No privacy enforcement surface | Because §5's privacy models don't exist, "who can DM me / follow me / call me / see my profile" is unenforceable — `POST /api/conversations` will create a DM with any user id |
| A4 | Media/attachment access control | N/A today, but any file system added must not inherit the current "public URL = access" model |
| A5 | Channel-level permissions | Only space-level ADMIN/MODERATOR checks exist; per-channel read/write permission has no model |
| A6 | Blocks are not enforced | `Block` rows exist and the UI references them, but no API path consults them: a blocked user can still DM, follow, comment and view content |
| A7 | CSRF on mutations | NextAuth protects its own routes; app mutations are cookie-authenticated `POST/PATCH/DELETE` JSON endpoints with no origin/CSRF check |

## 8. What lacks realtime support

Present: channel messages, DMs, community posts/comments, notifications, typing, presence pings.

Missing: profile/avatar/banner/status/mood updates, theme & settings sync across devices,
read receipts, reaction updates, story/reel events, member join/leave & role changes, community
and channel mutations, call signaling (relay is dead — [S1](#s1)), and any connection-state UI
(the client silently resolves the socket to `null` after a 3 s timeout and never tells the user
it is degraded).

## 9. What lacks tests

**Everything.** There is no test runner in `package.json`, no `vitest`/`jest`/`playwright` config,
no test file anywhere, and no CI workflow. The only quality gates are `eslint` (passes) and a
build that is configured to ignore type errors.

<a id="t1"></a>**T1 — `npx tsc --noEmit` reports 19 errors that `next build` hides**
(`typescript.ignoreBuildErrors: true`). Two are real, user-visible runtime bugs:

1. `src/lib/api-client.ts` exports no `put`, but `community-feed.tsx:262` and
   `post-detail.tsx:205` call `api.put(...)` to add a bookmark — while the server implements
   bookmarking as `PUT /api/posts/[id]/bookmark`. **Bookmarking a post throws
   `api.put is not a function`.** A README-listed feature is broken.
2. `src/lib/realtime-client.ts` uses `useCallback` without importing it → `useCallSignaling()`
   throws `useCallback is not defined` the moment anything renders it.

Others: unsound Prisma `orderBy`/`where` objects cast away in feed/posts/events, `never`-typed
chart state, `CommentNode.postId` accessed but not declared.

## 10. What will need new infrastructure

| Need | Why |
|---|---|
| **Object/blob storage + signed access** | §6. Requires a decision: S3-compatible (AWS S3 / R2 / MinIO) vs local disk volume. Everything in the file-upload brief depends on this |
| **`File` metadata model + attachment join tables** | ownership, MIME, size, checksum, storage key, visibility, soft delete, per-surface association |
| **Streaming upload endpoint** | multipart/direct-to-storage, size caps, magic-byte MIME sniffing, cancel/retry, quarantine-then-publish |
| **Thumbnail/transcode worker** | `sharp` is already a dependency for images; video posters need ffmpeg or a "no poster" fallback |
| **Malware scanning hook** | ClamAV sidecar or an external API; needs a scan-status column and a gate before publish |
| **Prisma migrations** | `prisma/migrations/` must be created (baseline from the current schema) so future changes are non-destructive and reviewable. `db:push --accept-data-loss` and `db:reset` must leave the normal workflow |
| **Postgres (recommended) or accepted SQLite limits** | SQLite has a single writer; realtime chat + uploads + presence writes will contend. Also blocks any multi-instance deploy |
| **Authenticated realtime** | short-lived signed socket token issued by Next.js, server-side room authorization, and a private channel for server→service broadcasts (today any client can emit them) |
| **Redis (or equivalent)** | shared rate limiting, socket.io adapter for >1 instance, presence TTL heartbeats |
| **WebRTC infrastructure** | STUN/TURN + authenticated signaling if real calls are in scope; without TURN, calls fail on many networks |
| **Test infrastructure** | vitest (unit/integration) + Playwright (E2E, multi-browser/multi-account) + a seeded ephemeral test DB + CI workflow |
| **CSRF/origin checking + security headers** | including a `Content-Security-Policy` and a separate origin (or strict `Content-Disposition`) for served user files |

<a id="s1"></a>**S1 — realtime service detail.** `mini-services/realtime/index.ts` gates its WebRTC
relay handlers on `user?.authenticated`, a property that is **never set** on the stored object
(and is a type error, see T1) — so `webrtc:offer` / `answer` / `ice-candidate` / `call:end` are
always dropped. Every other handler (`auth`, `join:*`, `typing:*`, `broadcast:*`) has no auth
check whatsoever, and CORS is `origin: "*"`.

---

## Summary judgement

The academic/social/communication **backend is real** — real Prisma models, real
`userId`-scoped queries, zod validation, real empty states, and correct authorization on the
CRUD paths that were probed. That layer should not be rewritten.

The gap between the product brief and reality is concentrated in exactly four places:

1. **No file storage** (§6) — the largest chunk of net-new work.
2. **No personalization persistence** (§5) — needs new columns/models, not new UI.
3. **An unauthenticated realtime service** (§7 A1) — a critical security hole today.
4. **No tests, and a build configured to hide type errors** (§9) — plus two real broken features
   that this configuration is currently masking.
