# Dyne — Implementation Plan (dependency-ordered)

Derived from [AUDIT.md](./AUDIT.md) and the product brief. Ordered so that nothing is built on
top of something that does not exist yet: **infrastructure → APIs/business logic → UI →
realtime → security hardening → E2E**.

## Ground rules for every phase

- The working academic/social/communication backend is **not** rewritten. New capabilities are
  added alongside it.
- Every schema change ships as an **additive Prisma migration**: new tables, new nullable
  columns, new indexes. No column drops, no type narrowing, no `db push --accept-data-loss`, no
  `migrate reset` in any documented workflow.
- No feature is called done on "it compiles" or "the page renders". Each phase ends with tests
  that hit the real database/storage, run with two real accounts where multi-user semantics
  matter, and are recorded in the phase's test list.
- No fake data, ever. Empty database → real empty state.

## Phase 0 — Foundations that everything else needs (blocking)

Small, low-risk, and required before anything can be trusted.

1. `prisma/migrations/0_baseline` generated from the current schema via
   `prisma migrate diff --from-empty` + `migrate resolve --applied`, so existing SQLite databases
   adopt migration history **without being reset**. `db:push`/`db:reset` removed from the
   documented workflow.
2. Turn on real type checking: remove `typescript.ignoreBuildErrors`, add `bun run typecheck`,
   fix the 19 existing errors — including the two live bugs (`api.put` → bookmarking is broken;
   missing `useCallback` import in `realtime-client.ts`).
3. Test infrastructure: `vitest` (unit + integration against a throwaway SQLite file),
   `@playwright/test` (E2E, two browser contexts = two accounts), a `test/` harness that
   registers accounts through the real API, and a CI workflow running
   `lint + typecheck + unit + integration`.
4. Regression tests for what already works (auth, task/assignment progress recompute, feed
   pagination, cross-account IDOR probes) so later phases cannot silently break them.

**Gate:** CI green; the two masked bugs demonstrated fixed by test.

## Phase 1 — Storage infrastructure

Depends on Phase 0.

1. Storage abstraction `src/lib/storage/` with one interface (`put`, `get`, `delete`,
   `signedUrl`) and two drivers: local-disk (dev/self-host, files written outside the web root)
   and S3-compatible (R2/S3/MinIO) selected by env. **Decision needed** — see [Open decisions](#open-decisions).
2. Migration: `File` model (id, ownerId, originalName, sanitizedName, mime, size, checksum,
   storageKey, driver, kind, width/height/duration, scanStatus, visibility, deletedAt,
   createdAt) + indexes on `ownerId`, `checksum`, `scanStatus`, `createdAt`.
3. Attachment associations as additive join tables (`MessageAttachment`, `DirectMessageAttachment`,
   `PostAttachment`, `CommentAttachment`, `StoryFile`, `ReelFile`, `SpaceFile`, `CommunityFile`)
   plus new **nullable** `avatarFileId` / `bannerFileId` columns. Existing `mediaUrl`/`fileUrl`
   columns stay and keep rendering — legacy content is not migrated away.
4. Upload API: `POST /api/files` (streaming, per-type size caps, magic-byte MIME sniffing that
   ignores the browser's `Content-Type`, extension/MIME agreement check, filename sanitization,
   path-traversal-proof key generation, `quarantined → clean` scan gate, executable and
   inline-HTML/SVG rejection or forced-download), `GET /api/files/[id]` (authorization on every
   read, `Content-Disposition: attachment` for non-inline kinds, no-sniff headers, signed/expiring
   URL or authorized proxy), `DELETE /api/files/[id]` (soft delete + storage cleanup),
   `GET /api/files/[id]/thumb` (sharp for images; video poster or explicit "no preview").
5. Malware scanning hook behind an interface, with a no-op driver documented as such (never
   reported as "scanning enabled" when it is not).

**Tests before moving on:** the full file matrix from the brief (small/large image, video, audio,
PDF, DOC(X), XLS(X), PPT(X), TXT, CSV, ZIP, unsupported type, oversized, renamed-malicious
`.exe`-as-`.png`, duplicate filename, deleted attachment, cross-account fetch → 403), storage
driver contract tests, and a scan-gate test.

## Phase 2 — Personalization & settings persistence (APIs/business logic)

Depends on Phase 1 (avatar/banner need files).

1. Additive migrations: `UserProfile` extensions (displayName, pronouns, links, accentColor,
   secondaryAccent, profileTheme, bannerFileId, avatarFileId, profileVisibility),
   `UserStatus` (presence enum ONLINE/IDLE/DND/INVISIBLE, custom status text + emoji + expiresAt
   + visibility), `UserMood`, `UserAppearance` (theme, chat wallpaper file, font size, density,
   autoplay, link previews, reduced motion), `NotificationPreference`
   (scope: global/community/channel/conversation × level: all/mentions/muted/custom),
   `PrivacySetting` (message/follow/mention/tag/activity/status/story/profile/call/shared-communities
   audiences), `ConversationSetting` (mute, wallpaper, disappearing-message TTL, read receipts).
2. APIs: `GET/PATCH /api/settings/{profile,appearance,privacy,notifications,status,mood}` and
   `PATCH /api/conversations/[id]/settings`, all zod-validated, with colour values validated
   against a safe palette/format (no raw CSS injection) and status/mood expiry enforced
   server-side.
3. A single server-side **authorization helper** (`canMessage`, `canFollow`, `canMention`,
   `canSeeStory`, `canSeeProfile`, `canCall`) that consults `PrivacySetting` **and `Block`**, and
   wire it into the existing conversation/follow/story/comment/call routes — closing audit
   findings A2, A3, A6.
4. Server-rendered theme bootstrap so the DB-stored theme applies on first paint (no flash, no
   `localStorage` as the source of truth; `localStorage` becomes a cache only).

**Tests before moving on:** per-setting integration tests for change → refetch → new session →
second account visibility; authorization matrix tests (blocked user cannot DM/follow/comment/see
stories; DM-privacy respected server-side even when the UI is bypassed with curl).

## Phase 3 — Attachment-aware content APIs

Depends on Phases 1–2.

1. Accept `fileIds[]` on message, DM, post, comment, story and reel creation; validate ownership
   of each file, enforce per-surface count/size limits, and bind attachments transactionally.
2. Serve attachments through authorized reads that inherit the container's visibility
   (community membership, space/channel membership, conversation membership, story audience).
3. Activate the schema-only features that make attachments usable and are already modelled:
   `MessageReaction`, `MessageReadReceipt`, `DMReaction`, `DMReadReceipt`, `PostMedia`,
   `Hashtag`/`PostHashtag`, `Report` — or explicitly drop them from the schema rather than
   leaving them as decoration.
4. Community/space/channel customization: banner + icon files, description, accent, channel
   topic/icon/slow-mode/pinned messages, invite management — all permission-checked server-side.

**Tests before moving on:** attachment authorization inheritance (non-member of a private space
cannot fetch a file posted in its channel), reaction/read-receipt integration tests, moderation
permission tests.

## Phase 4 — UI

Depends on Phase 3. Existing views are extended, **not** redesigned.

1. Reusable uploader: file picker + drag & drop + per-file progress + cancel + retry + remove,
   with real error states (upload failed, too large, rejected type, scan failed, expired).
   Wired into DMs, channels, posts, comments, stories, reels, profile avatar/banner, community
   and space assets.
2. Previews: image lightbox with zoom, video player, audio player, PDF preview where supported,
   generic file card (name/type/size/download) for everything else — and an honest
   "no preview available" instead of pretending.
3. Settings surfaces: Appearance (theme presets + custom accent with contrast validation and
   live preview before save), Chat, Notifications, Privacy — all reading/writing Phase 2 APIs.
4. Profile: banner upload with crop/reposition, accent, status + mood editors, pinned content,
   visibility controls.
5. Cross-cutting: keyboard navigation, focus states, accessible dialogs and upload controls,
   labels, contrast, reduced-motion support; touch targets and layouts verified at mobile,
   tablet and desktop widths.

**Tests before moving on:** Playwright flows for upload (including cancel and retry), preview,
each settings surface, and mobile-viewport runs.

## Phase 5 — Realtime integration

Depends on Phase 4.

1. Replace the trusted-`userId` handshake with a short-lived signed socket token minted by
   Next.js; the service verifies it and **derives** the user id. Server→service broadcasts move
   to a shared-secret channel so browsers can no longer emit `broadcast:*`.
2. Server-side room authorization on `join:channel` / `join:conversation` / `join:community`
   (membership checked before the join is accepted). CORS restricted to the app origin.
3. New realtime events: profile/avatar/banner/status/presence/mood updates, settings sync across a
   user's own devices, read receipts, reactions, member/role changes.
4. Presence reconciliation: heartbeat + TTL so a crashed tab cannot leave a user "online"
   forever; DB `isOnline` becomes derived rather than authoritative.
5. Visible connection state with automatic recovery (and no silent degradation to nothing).
6. Calls — **scope decision needed**: either implement real WebRTC (fix the dead relay, add
   `getUserMedia`, peer connections, call UI, and STUN/TURN) or remove the calling claims from
   the README and UI. No half-state.

**Tests before moving on:** two-browser realtime tests (message, avatar change, status change,
presence, typing); negative socket tests (forged token rejected, unauthorized room join refused,
client-emitted `broadcast:*` ignored).

## Phase 6 — Security hardening

1. Origin/CSRF checks on all state-changing routes; security headers incl. a CSP; user files
   served from an isolated origin or strictly as downloads.
2. Shared rate limiting (Redis or DB-backed) replacing the per-process map, applied to uploads,
   auth, messaging and social writes.
3. URL validation for legacy/user-supplied media URLs (scheme allowlist, no `javascript:`, no
   `data:` blobs into the DB) and an SSRF-safe fetch policy for any server-side URL access.
4. Make the destructive seed safe: move it behind a dev-only flag (or require explicit typed
   confirmation and stop deleting content the user did not create), and stop presenting a
   20-table `deleteMany` as an ordinary settings action.
5. Audit sweep for `mock`/`fake`/`demo`/`sample`/`placeholder`/`dummy`/`hardcoded`/`random`/
   `TODO`/`FIXME`, classifying each hit and removing anything fake in a production path.
6. Performance pass: cursor pagination everywhere, lazy media loading, thumbnails, and the
   indexes listed in the brief.

**Tests:** security suite — IDOR across every new route, malicious upload set, oversized uploads,
privilege escalation attempts, WebSocket abuse, rate-limit enforcement.

## Phase 7 — Full E2E & honest reporting

1. Multi-account, multi-browser E2E covering the brief's golden paths, plus the persistence
   matrix (change → save → refresh → logout → login → second client) for every personalization
   setting.
2. A final report stating, per feature: IMPLEMENTED yes/no/partial, REAL DATA, DATABASE VERIFIED,
   MULTI-USER VERIFIED, PERSISTENCE VERIFIED, SECURITY VERIFIED — marked from executed tests
   only, with known limitations and remaining work listed rather than glossed.

---

## Open decisions

These change the work materially, so they are worth settling before Phase 1 starts:

1. **Storage backend** — S3-compatible (needs credentials/bucket) vs local disk volume
   (self-hosted, no credentials, no CDN). A driver interface is built either way; only the
   default and the deployment story differ.
2. **Database** — stay on SQLite (simple, single-writer, single-instance) or move to Postgres
   (concurrency, realtime + upload load, multi-instance). Either way the migration is additive;
   a provider switch is a bigger, separate change.
3. **Calls** — implement real WebRTC (needs STUN/TURN, and TURN needs hosting) or drop the claim.
4. **Malware scanning** — provision ClamAV/an API, or ship the interface with a documented no-op
   and say so plainly.

## Sequencing note

Phase 0 is a prerequisite for everything and is short. Phase 1 is the single largest block of
net-new work; Phases 2–3 are broad but mechanical; Phase 4 is the widest UI surface; Phase 5's
security fixes (signed socket tokens, room authorization) are the most urgent items in the whole
plan and can be pulled forward independently of the file work if desired.
