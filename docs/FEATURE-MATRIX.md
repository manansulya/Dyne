# Dyne — Feature Matrix

Status of every user-facing feature, per layer. Derived from the
[audit](./AUDIT.md) plus the work verified in Phase 0, Phase 1 and the storage phase
(see [docs/STORAGE.md](./STORAGE.md)).

**A feature is not `IMPLEMENTED` because code for it exists.** It is `IMPLEMENTED` only when the
layers it needs are real *and* something automated or manually reproduced proves it works.

| Status | Meaning |
|---|---|
| `IMPLEMENTED` | Every layer the feature needs is real, and it is exercised by a test or reproduced end-to-end |
| `PARTIAL` | Works in part, or works but is missing a layer it needs (persistence, authorization, tests, realtime) |
| `NOT IMPLEMENTED` | No working path exists, even if a schema column, model or UI affordance suggests otherwise |
| `BLOCKED` | Cannot be finished in this environment/repository state without missing infrastructure or credentials |

Column values: `yes` / `partial` / `no` / `n/a`. "Tests" means automated tests in this repository
(`test/` for integration, `e2e/` for Playwright); `manual` means reproduced by hand and recorded in
the audit, with no regression test yet.

---

## Authentication & account

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Register (email/password) | `src/app/api/auth/register/route.ts`, `src/components/dyne/auth-form.tsx` | yes | yes | yes | n/a | n/a | n/a | yes (`test/auth.test.ts`, `e2e/smoke.spec.ts`) | IMPLEMENTED |
| Sign in / wrong password rejection | `src/lib/auth.ts` | yes | yes | yes | n/a | n/a | n/a | yes (`test/auth.test.ts`, `e2e/smoke.spec.ts`) | IMPLEMENTED |
| Sign out | `src/components/dyne/app-shell.tsx` | yes | yes | n/a | n/a | n/a | n/a | yes (`e2e/smoke.spec.ts`) | IMPLEMENTED |
| Session persistence across reloads (JWT) | `src/lib/auth.ts` | yes | yes | yes | n/a | n/a | n/a | yes (`e2e/smoke.spec.ts`) | IMPLEMENTED |
| Unauthenticated lockout on all API routes | `src/lib/server-auth.ts` | n/a | yes | n/a | n/a | n/a | yes | yes (`test/auth.test.ts`) | IMPLEMENTED |
| Onboarding (profile → courses → goals, skip all) | `src/components/dyne/onboarding-screen.tsx`, `src/app/api/onboarding/route.ts` | yes | yes | yes | n/a | n/a | yes | yes (`e2e/smoke.spec.ts`) | IMPLEMENTED |
| Password reset / email verification | — | no | no | no | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| OAuth / social login | — | no | no | partial (NextAuth `Account` model) | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Two-factor authentication | — | no | no | no | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Rate limiting on auth + write paths | `src/lib/rate-limit.ts` | n/a | yes | no (in-memory, per process) | n/a | n/a | n/a | no | PARTIAL |
| CSRF / origin checking on app mutations | — | n/a | no | n/a | n/a | n/a | no | no | NOT IMPLEMENTED |

## Academic

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Courses CRUD + schedule | `src/app/api/courses/`, `src/components/dyne/views/courses.tsx` | yes | yes | yes | n/a | no | yes | yes (`test/academic.test.ts`) | IMPLEMENTED |
| Assignments CRUD | `src/app/api/assignments/`, `views/assignments.tsx` | yes | yes | yes | n/a | no | yes | yes (`test/academic.test.ts`) | IMPLEMENTED |
| Tasks CRUD + assignment progress recompute | `src/app/api/tasks/`, `views/tasks.tsx` | yes | yes | yes | n/a | no | yes | yes (`test/academic.test.ts`, `e2e/smoke.spec.ts`) | IMPLEMENTED |
| Exams CRUD | `src/app/api/exams/`, `views/exams.tsx` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Notes CRUD | `src/app/api/notes/`, `views/notes.tsx` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Goals + study-hour auto-tracking | `src/app/api/goals/`, `src/app/api/study-sessions/` | yes | yes | yes | n/a | no | yes | yes (`test/academic.test.ts`) | IMPLEMENTED |
| Habits + habit logs | `src/app/api/habits/`, `views/habits.tsx` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Calendar events | `src/app/api/events/`, `views/calendar.tsx` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Recurring event instances | `views/calendar.tsx` (`expandEventInstances`) | yes | no | no (expanded client-side only) | n/a | no | n/a | no | PARTIAL |
| Study timer | `views/*` + `localStorage["dyne-study-timer"]` | yes | partial (session row on stop) | no (running state is local) | n/a | no | n/a | no | PARTIAL |
| Dashboard + analytics aggregates | `src/app/api/dashboard/`, `src/app/api/analytics/` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Assignment/exam reminder notifications | — | no | no | no (no generator exists) | n/a | n/a | n/a | no | NOT IMPLEMENTED |

## Social

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Posts (create/edit/delete) | `src/app/api/posts/`, `views/community-feed.tsx` | yes | yes | yes | partial (API accepts real attachments; the post composer still takes a media URL) | yes (community room) | yes | yes (`test/social.test.ts`, `test/authorization.test.ts`) | PARTIAL |
| Nested comments | `src/app/api/comments/`, `views/post-detail.tsx` | yes | yes | yes | n/a | yes | yes | yes (`test/social.test.ts`) | IMPLEMENTED |
| Votes / likes | `src/app/api/posts/[id]/vote/` | yes | yes | yes | n/a | no | yes | yes (`test/social.test.ts`) | IMPLEMENTED |
| Bookmarks / saved posts | `src/app/api/posts/[id]/bookmark/`, `src/lib/api-client.ts` | yes | yes | yes | n/a | no | yes | no (fixed in Phase 0; no regression test yet) | PARTIAL |
| Feed + cursor pagination | `src/app/api/feed/route.ts` | yes | yes | yes | n/a | no | yes | yes (`test/social.test.ts`) | IMPLEMENTED |
| Explore / global search | `src/app/api/explore/`, `src/app/api/search/` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Follow / unfollow | `src/app/api/follow/` | yes | yes | yes | n/a | no | yes | yes (`test/social.test.ts`) | IMPLEMENTED |
| Block | `src/app/api/block/` | yes | yes | yes | n/a | n/a | no (no read/write path consults `Block`) | no | PARTIAL |
| Mute | `src/app/api/block/` (mute rows) | partial | partial | yes | n/a | n/a | no | no | PARTIAL |
| Stories (create/view/react) | `src/app/api/stories/`, `views/stories.tsx` | yes | yes | yes | no (pasted URL) | no | no (any user can view any story) | no | PARTIAL |
| Reels (create/like/comment/view) | `src/app/api/reels/`, `views/reels.tsx` | yes | yes | yes | no (pasted URL) | no | partial | no | PARTIAL |
| Hashtags | `Hashtag`/`PostHashtag` models | no | no | yes (schema only) | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Reporting / moderation queue | `Report` model | no | no | yes (schema only) | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Public profile pages | `src/app/api/profile/[username]/`, `views/profile.tsx` | yes | yes | yes | no | no | partial (no visibility model) | no | PARTIAL |

## Messaging

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Direct conversations (get-or-create) | `src/app/api/conversations/` | yes | yes | yes | n/a | yes | partial (no privacy/block rules) | yes (`test/messaging.test.ts`) | PARTIAL |
| Send / receive DMs | `src/app/api/direct-messages/` | yes | yes | yes | no | yes | yes | yes (`test/messaging.test.ts`, `test/realtime.test.ts`) | IMPLEMENTED |
| Edit / delete own DM | `src/app/api/direct-messages/[id]/route.ts` | yes | yes | yes | n/a | yes | yes (author-only delete, fixed in Phase 0) | yes (`test/messaging.test.ts`) | IMPLEMENTED |
| Channel messages (send/edit/delete) | `src/app/api/messages/`, `views/spaces.tsx` | yes | yes | yes | no | yes | yes (space membership) | yes (`test/messaging.test.ts`) | IMPLEMENTED |
| Typing indicators | `src/lib/realtime-client.ts`, `mini-services/realtime/server.ts` | yes | n/a | n/a | n/a | yes | yes (authenticated + room-scoped as of Phase 1) | yes (`test/realtime.test.ts`) | IMPLEMENTED |
| Read receipts | `mini-services/realtime/server.ts`; `MessageReadReceipt`/`DMReadReceipt` models | no | no | yes (schema only, never written) | n/a | yes (transport only) | yes (room-scoped) | yes (transport only, `test/realtime.test.ts`) | PARTIAL |
| Message reactions | `MessageReaction`/`DMReaction` models | no | no | yes (schema only) | n/a | no | n/a | no | NOT IMPLEMENTED |
| Reply-to context | `Message.replyToId` | partial (composer quote only) | yes | yes | n/a | no | n/a | no | PARTIAL |
| Group conversations | — | no | no | no (`Conversation` is a two-member pair) | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Message / DM attachments (real uploaded files) | `src/app/api/messages/route.ts`, `src/app/api/direct-messages/route.ts`, `src/lib/attachments.ts`, `views/messages.tsx`, `views/spaces.tsx` | yes | yes | yes (`Attachment` rows) | yes | yes (attachments included in the broadcast payload) | yes (owner claims; readers must be conversation/space members) | yes (`test/uploads.test.ts`) | IMPLEMENTED |
| Legacy URL-only media fields (`Message.fileUrl`, `DirectMessage.fileUrl`) | `prisma/schema.prisma` | partial | partial | partial (URL string) | no | n/a | no | no | PARTIAL (superseded by `Attachment`; kept for compatibility, not yet removed) |
| Per-conversation settings (mute, disappearing, receipts opt-out) | — | no | no | no | n/a | n/a | n/a | no | NOT IMPLEMENTED |

## Communities & spaces

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Create community + ADMIN membership | `src/app/api/communities/` | yes | yes | yes | no | yes | yes | yes (`test/social.test.ts`, `test/authorization.test.ts`) | IMPLEMENTED |
| Join / leave community | `src/app/api/communities/[id]/join/` | yes | yes | yes | n/a | no | yes | yes (`test/authorization.test.ts`) | IMPLEMENTED |
| Post to a community you have not joined (must be refused) | `src/app/api/posts/route.ts` | n/a | yes | yes | n/a | n/a | yes | yes (`test/authorization.test.ts`) | IMPLEMENTED |
| Community roles (ADMIN/MODERATOR/MEMBER) | `prisma/schema.prisma`, `src/app/api/communities/` | partial | partial | yes | n/a | no | partial (role checks exist only on some paths) | no | PARTIAL |
| Create space + channels | `src/app/api/spaces/`, `views/spaces.tsx` | yes | yes | yes | no | yes | yes | yes (`test/messaging.test.ts`) | IMPLEMENTED |
| Space membership + join | `src/app/api/spaces/[id]/join/` | yes | yes | yes | n/a | no | yes | yes (`test/messaging.test.ts`) | IMPLEMENTED |
| Space member role change / kick | `src/app/api/spaces/[id]/members/[memberId]/` | yes | yes | yes | n/a | no | yes (admin-only, cannot kick self/owner) | no | PARTIAL |
| Per-channel permissions | — | no | no | no | n/a | n/a | no | no | NOT IMPLEMENTED |
| Invites (revocable, expiring) | `Space.inviteCode` (static) | partial | partial | partial | n/a | n/a | partial | no | PARTIAL |
| Moderation actions (pin, slow mode, ban, delete others' messages) | — | no | no | no | n/a | no | no | no | NOT IMPLEMENTED |
| Community/space banners & icons | `iconUrl` column | partial | partial | partial (URL string) | no | no | n/a | no | NOT IMPLEMENTED |

## Realtime

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Socket authentication (signed short-lived token from the session) | `src/lib/realtime-token.ts`, `src/app/api/realtime/token/route.ts`, `mini-services/realtime/server.ts` | yes | yes | yes (token subject resolved from DB user) | n/a | yes | yes | yes (`test/realtime.test.ts`, `e2e/realtime-token.spec.ts`) | IMPLEMENTED |
| Server→service broadcast channel (app secret only) | `src/lib/realtime-server.ts`, `mini-services/realtime/server.ts` | n/a | yes | n/a | n/a | yes | yes (browser sockets cannot emit `broadcast:*`) | yes (`test/realtime.test.ts`) | IMPLEMENTED |
| Room authorization for DMs / channels / communities / user rooms | `src/lib/realtime-authz.ts`, `src/app/api/internal/realtime/authorize/route.ts` | n/a | yes | yes (membership checked in DB) | n/a | yes | yes | yes (`test/realtime.test.ts`, `scripts/realtime-live-check.ts`) | IMPLEMENTED |
| Channel/DM/community/notification fan-out | `src/lib/realtime-server.ts` | yes | yes | yes | n/a | yes | yes | yes (`test/realtime.test.ts`) | IMPLEMENTED |
| Presence (online/offline) | `src/app/api/presence/[userId]/`, `mini-services/realtime/server.ts` | yes | yes | yes | n/a | yes | yes (own presence only) | yes (`test/realtime.test.ts` — spoofing refused) | PARTIAL |
| Presence reconciliation (stale `isOnline` after crash/refresh) | — | no | no | no (no heartbeat/TTL) | n/a | no | n/a | no | NOT IMPLEMENTED |
| Connection-state UI ("realtime degraded") | `src/lib/realtime-client.ts` | no | n/a | n/a | n/a | partial | n/a | no | NOT IMPLEMENTED |
| Multi-instance realtime (Redis adapter) | — | n/a | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Realtime settings / profile / reaction / story sync | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |

## Calls

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Call lifecycle signaling API (initiate/accept/reject/cancel/end) | `src/app/api/call/signaling/route.ts` | no (no calling UI) | yes | yes (`Call` model) | n/a | partial | yes | no | PARTIAL |
| WebRTC peer connection, audio, video, mute, camera toggle | — | no | no | n/a | n/a | no | n/a | no | NOT IMPLEMENTED |
| ICE / STUN / TURN infrastructure | — | no | no | n/a | n/a | no | n/a | no | BLOCKED (no TURN service available in this environment) |
| Call history | `Call` model | no | yes | yes | n/a | n/a | yes | no | PARTIAL |

## Files & storage

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Storage abstraction (put/get/head/delete/metadata/signed access) | `src/lib/storage/` | n/a | yes | n/a | yes | n/a | n/a | yes (`test/storage-drivers.test.ts`) | IMPLEMENTED |
| Local development storage driver | `src/lib/storage/local-driver.ts` | n/a | yes | n/a | yes (dev/test only — no replication or lifecycle rules) | n/a | yes (root containment) | yes (`test/storage-drivers.test.ts`) | IMPLEMENTED |
| S3 / Cloudflare R2 / MinIO driver | `src/lib/storage/s3-driver.ts` | n/a | yes | n/a | yes (private objects, presigned reads) | n/a | yes | yes (mocked S3 client only, `test/storage-drivers.test.ts`) | PARTIAL (implemented but not yet verified against a real R2/S3 bucket — no credentials provisioned) |
| `Attachment` model (owner, driver, key, type, size, sha256, scan status) | `prisma/schema.prisma`, `prisma/migrations/20260820101504_attachments/` | n/a | yes | yes | yes | n/a | yes | yes (`test/uploads.test.ts`) | IMPLEMENTED |
| Authenticated upload API | `src/app/api/uploads/route.ts`, `src/lib/attachments.ts` | yes | yes | yes | yes | n/a | yes (session required, owner recorded) | yes (`test/uploads.test.ts`) | IMPLEMENTED |
| Real uploads (picker, drag/drop, progress, cancel, retry) | `src/lib/use-uploads.ts`, `src/components/dyne/attachments.tsx`, `views/messages.tsx`, `views/spaces.tsx` | yes | yes | yes | yes | n/a | yes | partial (API covered by `test/uploads.test.ts`; no browser test of the tray yet) | PARTIAL |
| MIME sniffing from bytes, size limits, filename sanitization, safe-type allowlist | `src/lib/storage/file-types.ts` | yes (server-advertised `accept`) | yes | yes | n/a | n/a | n/a | yes (`test/uploads.test.ts`) | IMPLEMENTED |
| Authorized download + non-executable response headers | `src/app/api/attachments/[id]/content/route.ts` | yes | yes | yes | yes | n/a | yes (owner, or members of the message/DM/post's resource) | yes (`test/uploads.test.ts`) | IMPLEMENTED |
| Attachment delete (owner-only, bytes removed, row soft-deleted) | `src/app/api/attachments/[id]/route.ts` | yes | yes | yes | yes | n/a | yes | yes (`test/uploads.test.ts`) | IMPLEMENTED |
| Attachment previews (image/video/audio inline, others download) | `src/components/dyne/attachments.tsx` | yes | yes | yes | yes | n/a | yes | partial (headers tested; rendering not) | PARTIAL |
| Avatars | `src/app/api/profile/me/route.ts` (`avatarUrl`, up to 500 KB string) | yes | yes | yes (URL/base64 string in the row) | no | no | partial | no | PARTIAL |
| Post/story/reel/message media | `mediaUrl` / `videoUrl` / `fileUrl` columns | yes (URL input) | partial (no URL validation) | partial (string) | no | no | no | no | PARTIAL |
| Thumbnails / transcoding | — | no | no | no | no | n/a | n/a | no | NOT IMPLEMENTED |
| Malware scanning | `src/lib/storage/scanner.ts` (interface + no-op) | n/a | partial (abstraction only) | yes (`scanStatus`/`scanner` recorded) | n/a | n/a | n/a | no | NOT IMPLEMENTED (no scanner deployed; every attachment records `SKIPPED`/`none` and nothing claims otherwise) |

## Personalization & preferences

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Light/dark theme | `next-themes` + `localStorage` | yes | no | no | n/a | no | n/a | no | PARTIAL |
| Accent colour | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Custom status / mood / pronouns / profile links | — | no | no | no (no columns) | n/a | no | n/a | no | NOT IMPLEMENTED |
| Profile banner | — | no | no | no | no | no | n/a | no | NOT IMPLEMENTED |
| Notification preferences | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Privacy preferences (who can DM/follow/call/see stories) | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Chat appearance (wallpaper, density, font size, autoplay) | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Profile edit (name, username, bio) | `src/app/api/profile/me/route.ts`, `views/settings.tsx` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Cross-device settings sync | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |

## Notifications

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Server-generated notifications (follow, comment, DM, like, story reaction) | `src/app/api/notifications/`, various write paths | yes | yes | yes | n/a | yes | yes (delivered only to the addressee's room) | yes (`test/messaging.test.ts`, `test/realtime.test.ts`) | IMPLEMENTED |
| Read / unread state + mark all read | `src/app/api/notifications/` | yes | yes | yes | n/a | no | yes | no | PARTIAL |
| Mention notifications | — | no | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Push / email notifications | — | no | no | no | n/a | n/a | n/a | no | NOT IMPLEMENTED |

## Platform & operations

| Feature | Location | Frontend | Backend | Database | Storage | Realtime | Authorization | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Prisma migration baseline + adopt path | `prisma/migrations/0_init/`, `package.json` (`db:deploy`, `db:adopt`) | n/a | yes | yes | n/a | n/a | n/a | yes (applied by `test/global-setup.ts` and `e2e/global-setup.ts`) | IMPLEMENTED |
| Destructive DB scripts removed (`db:push --accept-data-loss`, `db:reset`) | `package.json` | n/a | n/a | yes | n/a | n/a | n/a | n/a | IMPLEMENTED |
| Development fixtures (additive, dev-only) | `src/app/api/dev/fixtures/route.ts`, `src/lib/dev-fixtures.ts` | yes (dev builds only) | yes | yes | n/a | n/a | yes | yes (`test/dev-fixtures.test.ts`) | IMPLEMENTED |
| Typecheck enforced (no `ignoreBuildErrors`) | `next.config.ts`, `package.json` (`typecheck`, `typecheck:realtime`) | n/a | n/a | n/a | n/a | n/a | n/a | yes (CI) | IMPLEMENTED |
| Integration test suite (Vitest) | `test/`, `vitest.config.mts` | n/a | n/a | yes (real SQLite test DB + migrations) | n/a | yes | yes | yes | IMPLEMENTED |
| E2E suite (Playwright) | `e2e/`, `playwright.config.ts` | yes | yes | yes | n/a | partial | yes | yes | PARTIAL |
| CI (lint, typecheck, tests, build, E2E) | `.github/workflows/ci.yml` | n/a | n/a | n/a | n/a | n/a | n/a | yes | IMPLEMENTED |
| PostgreSQL for production | — | n/a | no | no (schema + baseline migration are SQLite-specific) | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Shared rate limiting / Redis | — | n/a | no | no | n/a | no | n/a | no | NOT IMPLEMENTED |
| Security headers + CSP | — | no | no | n/a | n/a | n/a | n/a | no | NOT IMPLEMENTED |
| Backups / monitoring | — | n/a | no | no | n/a | n/a | n/a | no | NOT IMPLEMENTED |
