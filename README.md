# Dyne — Student Life OS

> **Created by Manan Sulya (aka. kagewasalive)**
>
> Copyright © 2026 Manan Sulya (aka. kagewasalive). All rights reserved.

Dyne is a unified social, academic, and communication platform that combines academic productivity (tasks, assignments, courses, calendar, exams, notes, goals, habits, study sessions, analytics) with Instagram-class social features (posts, stories, reels, explore, follows, likes, comments) and real-time communication (spaces, channels, DMs, voice/video calling) — all in one coherent application with its own original design language and identity.

> **What problem does Dyne solve?** Students currently manage their lives across disconnected tools — calendars, task managers, note apps, spreadsheets, habit trackers, chat apps, forums, social media. These tools don't understand how a student's responsibilities relate to one another. Dyne does.

---

## ✨ Features

### Academic layer (original Dyne)
- **Dashboard** — Daily briefing: today's tasks, schedule, upcoming assignments, next exam, active goals, course summaries.
- **Tasks** — Full CRUD with priority, status, due date/time, course + assignment linking, tags, estimated duration, grouped views (Overdue / In Progress / To Do / Completed).
- **Assignments** — Course-linked, breakable into sub-tasks. Progress auto-computes from sub-task completion.
- **Courses** — Color + icon picker, course detail dialog with tabs (Overview/Assignments/Exams/Tasks/Notes/Schedule).
- **Calendar** — Day/Week/Month views, recurring events, 6 color-coded event types.
- **Exams** — Date/time/location/topics/preparation-progress slider + study notes.
- **Notes** — Markdown-style text, pinned, tagged, linked to course/assignment/exam.
- **Goals** — Measurable (target/current/unit/deadline), auto-completes when current ≥ target. STUDY_HOURS goals auto-track from study sessions.
- **Habits** — Daily check-ins, last 7 days grid, target/week, streak tracking.
- **Study Sessions** — Built-in HH:MM:SS focus timer, persists across refreshes.
- **Analytics** — Real metrics with custom SVG charts (recharts 2.x has a React 19 bug). Empty states when no data.

### Social layer
- **Community Feed** — Sort by New/Top/Hot, infinite scroll, posts from communities you've joined + people you follow.
- **Communities** — Discover, search, create. Each community has color, description, members, posts.
- **Posts** — Title + content (markdown), image URL, link URL. Create/edit/delete (owner or mod/admin). Real-time broadcast to community subscribers.
- **Comments** — Nested replies with color-coded depth, expand/collapse, edit/delete. Real-time.
- **Reactions** — Upvote/Downvote on posts and comments (DB-enforced unique constraint).
- **Post Likes** — Instagram-style simple like/unlike on posts (separate from voting).
- **Bookmarks** — Save posts for later, dedicated Saved Posts view.
- **Stories** — 24-hour ephemeral stories with image/video, viewer tracking, emoji reactions, auto-expiration.
- **Reels** — Short-form vertical video with likes, comments, view tracking, cursor pagination.
- **Explore** — Trending posts, reels, suggested users, hashtags — all from real database content.
- **Profiles** — Username, bio, avatar URL, karma, posts count, joined communities count.
- **Follow** — Follow other users; their posts appear in your home feed.
- **Block/Mute** — Privacy controls with DB-enforced unique constraints.
- **Public user profile dialog** — View any user by @username, follow or message them.

### Communication layer
- **Spaces** — Real-time servers for study groups, course discussions, friend circles. Create + join (via invite code). Owner + ADMIN/MODERATOR/MEMBER roles. Real-time member presence (online/offline).
- **Channels** — Text channels within spaces (general, announcements, study-group, off-topic). Create/edit/delete (admin/mod only). "general" channel is protected.
- **Real-time channel messages** — Send/edit/delete (soft-delete with "This message has been deleted." placeholder). Cursor-based pagination (10 per batch) with "Load older messages". Date dividers (Today/Yesterday/date). Reply-to (visual quote in composer).
- **Typing indicators** — Live "X is typing…" for both channels and DMs.
- **Direct Messages (DMs)** — 1:1 conversations via get-or-create pattern. Conversation list with last message preview + relative timestamp. Online presence dots on avatars.
- **Member management** — Admins can change member roles or kick members (cannot kick self or owner).
- **Real-time architecture** — Socket.io mini-service on port 3003 (mini-services/realtime/). Next.js API routes broadcast via socket.io-client. Frontend connects via `io("/?XTransformPort=3003")`. Falls back gracefully to polling if socket unavailable.

### Cross-cutting
- **Global search** (⌘K) — Across courses, tasks, assignments, exams, notes, users, communities, spaces, and posts.
- **Notifications** — Real, generated from data: assignment due tomorrow, exam reminder, comment on your post, new DM. Real-time push via socket. Read/unread state. Mark-all-read.
- **Authentication** — Email/password via NextAuth.js (JWT sessions, bcrypt hashing). All user fields cached in JWT for fast session reads (no DB hit per request).
- **User isolation** — Every query scoped by `userId`. Users cannot read or mutate other users' data.
- **Onboarding** — 3-step flow (profile → courses+schedule → goals+habits). Skip-all option.
- **Demo seed** — 6 courses, 9 assignments, 6 exams, 4 habits, 3 goals, 3 communities with posts + comments, 2 spaces with channel messages, study sessions, notifications.
- **Mobile-first** — Hamburger drawer, touch-friendly tap targets, no horizontal overflow.
- **Light + dark themes** — Warm paper-like light, deep ink dark.

---

## 🧱 Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | Modern React server + client model, fast HMR. |
| Language | **TypeScript 5** (strict) | Type safety across server + client. |
| Styling | **Tailwind CSS 4** | Utility-first, theme tokens via CSS variables. |
| UI components | **shadcn/ui** (New York) | Accessible, composable, owned (not a black box). |
| Icons | **lucide-react** | Consistent, modern. |
| Database | **SQLite** (file) via **Prisma ORM** | Zero-config local dev. Relational, typed. |
| Auth | **NextAuth.js v4** (Credentials + JWT) | Mature, simple to self-host. JWT caches user fields (no DB hit per session). |
| Password hashing | **bcryptjs** | Pure-JS, no native deps. |
| Real-time | **Socket.io** mini-service on port 3003 | Decoupled from Next.js, survives Next.js restarts. |
| Server state | **TanStack Query v5** | Caching, optimistic updates, infinite scroll. |
| Client state | **Zustand** | Tiny, ergonomic. |
| Forms | **react-hook-form** + **zod** | Type-safe validation. |
| Toasts | **sonner** | Beautiful, accessible. |
| Charts | **Custom SVG** (built in-house) | Avoids recharts 2.x React 19 rendering bug. |
| Theme | **next-themes** | Light/dark with no flash. |
| Dates | **date-fns v4** | Tree-shakeable, immutable. |

No external services required. No API keys. No SaaS dependencies. Everything runs locally.

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ or Bun 1.1+

### Setup
```bash
# 1. Install dependencies
bun install

# 2. Install realtime mini-service deps
cd mini-services/realtime && bun install && cd ..

# 3. Configure env (DATABASE_URL is already set to a local SQLite file)
cp .env.example .env

# 4. Push the Prisma schema to the database (creates the SQLite file)
bun run db:push

# 5. Start the dev server (Next.js on :3000 + realtime mini-service on :3003)
bun run dev
# OR if running via the project's dev script:
bash .zscripts/dev.sh
```

Open http://localhost:3000. Register a new account → onboard → start using Dyne.

### Generate demo data
From inside the app: **Settings → Demo data → Seed demo data**.

This creates 6 courses, 9 assignments, 6 exams, 4 habits, 3 goals, 3 communities (cs_students, campus_life, math_help) with posts + comments, and 2 spaces (CS 201 Study Group, First Year Friends) with seeded channel messages.

---

## 🗂 Project Structure

```
prisma/
  schema.prisma            # Full data model — User + academic entities + social + communication + NextAuth tables

mini-services/
  realtime/                # Socket.io server on port 3003 (real-time messaging, typing, presence)
    index.ts
    package.json

src/
  app/
    api/
      auth/[...nextauth]   # NextAuth handler (JWT, credentials provider)
      auth/register        # Email/password registration
      analytics            # Aggregated metrics
      assignments/[id]     # Assignment CRUD
      bookmarks            # Saved posts
      channels/[id]        # Channel CRUD
      comments/[id]        # Comment CRUD + vote
      comments/post/[postId] # Comment tree (nested) + create
      communities/[id]     # Community CRUD
      communities/[id]/join # Join/leave community
      communities/search   # Search communities
      conversations/[id]   # DM messages
      courses/[id]         # Course detail
      dashboard            # Daily briefing aggregate
      direct-messages/[id] # DM CRUD
      events/[id]          # Calendar events
      exams/[id]           # Exams
      feed                 # Personalized home feed (communities + following)
      follow/[userId]     # Follow/unfollow
      goals/[id]           # Goals
      habit-logs           # Toggle habit completion
      habits/[id]          # Habits
      me                   # Current user
      messages/[id]        # Channel messages
      notes/[id]           # Notes
      notifications/[id]   # Notifications
      onboarding           # First-run + profile updates
      posts/[id]           # Post CRUD + vote + bookmark
      presence/[userId]    # Online/offline status
      profile/[username]   # Public user profile
      profile/me           # Own profile
      search               # Global search across all entities
      seed                 # Demo seed
      spaces/[id]          # Space CRUD
      spaces/[id]/join     # Join space
      spaces/[id]/members/[memberId] # Role change / kick
      study-sessions/[id]  # Study session CRUD + study-hour goal auto-tracking
      tasks/[id]           # Task CRUD (recomputes parent assignment progress)
    layout.tsx             # Root layout (AppProviders, fonts, Toaster)
    page.tsx               # Entry — routes by auth state + view
    globals.css            # Design tokens (warm light, deep ink dark)
  components/
    providers.tsx          # SessionProvider + ThemeProvider + QueryClientProvider
    dyne/
      app-shell.tsx        # Sidebar + header + Cmd+K search + notifications + presence
      auth-screen.tsx     # Login / register tabs
      onboarding-screen.tsx
      quick-add-dialog.tsx # Cmd+N
      states.tsx           # Loading / Error / Empty states
      chips.tsx            # Priority / Status chips
      simple-charts.tsx    # SVG bar / line / donut charts
      views/               # All 18 main views + detail dialogs
  lib/
    auth.ts                # NextAuth config (JWT caching, update trigger)
    api-client.ts          # Fetch wrapper + TanStack helpers
    constants.ts           # Enums + UI meta + design tokens
    conversation.ts        # get-or-create conversation helper
    dates.ts               # date-fns helpers + expandEventInstances
    db.ts                  # PrismaClient singleton
    password.ts            # bcrypt hash/verify
    realtime-client.ts     # React hooks for socket.io subscriptions
    realtime-server.ts     # Server-side broadcast helpers
    server-auth.ts         # requireUserId + withUserId HOC
  store/
    app-store.ts           # Zustand: current view + open dialogs + space/channel state
  types/
    next-auth.d.ts         # Augment Session with userId + onboarded + username + bio + avatarUrl
```

---

## 🔐 Security

- Passwords hashed with bcrypt (10 rounds).
- Every API route uses `withUserId()` which extracts the user from the JWT session and tags every DB query with `userId`.
- No client-trusted authorization — every mutation is re-checked server-side.
- Input validated with zod on every API endpoint.
- `NEXTAUTH_SECRET` is loaded from env (default is for dev only).
- SQLite file lives outside the web root.
- Community/space membership is verified before allowing posts/messages — users can't post to communities they haven't joined or send messages to spaces they're not members of.
- Comment deletion is restricted to the author, community admin, or community moderator.
- Space channel creation/editing/deletion is restricted to admins and moderators.
- DM access is verified via conversation membership (memberOneId OR memberTwoId).

---

## 🧪 Testing

This codebase uses **agent-browser** for end-to-end verification. Verified user journeys:

1. **Auth performance**: Register new user → land on onboarding in ~5s (was 15-30s+ before JWT optimization)
2. **End-to-end academic**: Register → onboard (skip) → seed demo data → dashboard populates with real, related data → toggle tasks → assignment progress auto-updates
3. **Social**: Open Community Feed → see seeded posts (cs_students, campus_life, math_help) → create new post → upvote → open post detail → add comment → comment count updates
4. **Communication**: Open Spaces → see seeded spaces (CS 201 Study Group, First Year Friends) → open space → see channel sidebar (#general, #announcements, #study-group, #off-topic) → see seeded messages with date dividers → send new message → see it appear in the chat
5. **Mobile**: Hamburger drawer opens, navigation works at 390×844 viewport

Manual test commands:
```bash
bun run lint         # ESLint must pass (0 errors)
bun run db:push      # Schema must apply cleanly
bun run dev          # Server must start
```

---

## 🛠 Development

```bash
bun run dev          # Start dev server (http://localhost:3000)
bun run lint         # ESLint
bun run db:push      # Apply schema changes
bun run db:generate  # Regenerate Prisma client
bun run db:migrate   # Create migration
bun run db:reset     # Reset DB + re-run migrations
bun run build        # Production build
bun run start        # Start production server (after build)
```

### Real-time mini-service
```bash
cd mini-services/realtime
bun install
bun run dev          # Starts on port 3003
```

The dev script (`.zscripts/dev.sh`) automatically starts the realtime mini-service alongside Next.js.

### Environment variables
```bash
DATABASE_URL=file:/home/z/my-project/db/custom.db
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dyne-dev-secret-change-in-production  # change for prod
REALTIME_URL=http://localhost:3003                    # for server-side broadcasts
```

---

## 🏛 Architecture

### Data model
Normalized relational schema with three layers:

1. **Academic** (per-user, isolated): User → Semester → Course → Assignment → Task; Course → Exam, Note, Event, StudySession; Goal, Habit, HabitLog
2. **Social** (multi-user): Community (optionally linked to Course) → CommunityMember (ADMIN/MODERATOR/MEMBER) + Post → Comment (self-referencing for nested replies) + Reaction (userId+postId unique, userId+commentId unique) + Bookmark; Follow (follower → followed)
3. **Communication** (multi-user): Space (optionally linked to Course) → SpaceMember (ADMIN/MODERATOR/MEMBER) + Channel → Message (soft-delete); Conversation (1:1 pair via get-or-create pattern, sorted memberOneId/memberTwoId) → DirectMessage; Call (lifecycle: isAccepted/isRejected/isCanceled/isMissed/isEnded — no real WebRTC, for history only)

### Progress auto-computation
When a Task linked to an Assignment is toggled (status change), `recomputeAssignmentProgress()` runs:
- All tasks COMPLETED → assignment progress = 100%, status = COMPLETED.
- Some COMPLETED → progress = round(done/total × 100), status = IN_PROGRESS.
- Else → progress = 0, status = TODO.

### Study goal auto-tracking
When a StudySession is created, all active STUDY_HOURS goals (within their deadline) get their `current` incremented by `duration / 60` hours. If `current ≥ target`, the goal auto-completes.

### Recurring events
Events with `recurrence = WEEKLY` are expanded into instances client-side (`expandEventInstances()`), so the DB stores one row but the calendar shows every weekly occurrence within the queried range.

### Real-time architecture
- Socket.io server runs as a separate Bun process on port 3003 (mini-services/realtime/index.ts).
- Frontend connects via `io("/?XTransformPort=3003")` — Caddy gateway forwards the request.
- Next.js API routes use a server-side socket.io-client (`src/lib/realtime-server.ts`) to broadcast events after DB writes.
- Frontend hooks (`useChannelRealtime`, `useConversationRealtime`, `useCommunityRealtime`, `useNotificationRealtime`, `useUserPresence`) subscribe to events and update React Query cache optimistically.
- Falls back gracefully: if socket is unavailable, the app still works via React Query's polling/refetch.

### JWT-based session (performance)
- NextAuth `jwt` callback fetches user fields (name, username, bio, avatarUrl, institution, semesterName, onboarded) ONCE at sign-in and caches them in the JWT.
- `session` callback reads from JWT — **no DB hit per session read** (the original Dyne had a DB query on every session read, causing 5-30s registration delays).
- When client calls `useSession().update()` (e.g. after onboarding), the `jwt` callback runs with `trigger: "update"` and re-fetches the latest fields from DB.

### Routing
Dyne is a single-page app — there is one route (`/`). View switching is done in Zustand store + URL search params (`?view=community&contextId=...`). This keeps the entire experience inside the sandbox-visible `/` route while still behaving like a multi-page app with shareable URLs.

---

## ⚠️ Known limitations

- **Voice/video calls**: The `Call` model exists in the schema for future use, but real WebRTC calling is not implemented (LiveKit not available in this sandbox). The schema supports the lifecycle (incoming/accepted/rejected/canceled/missed/ended) for future integration.
- **File uploads**: Image URLs are supported in posts and messages (paste a URL). No actual upload pipeline (UploadThing/S3 not available) — users provide URLs.
- **Single-user testing**: The demo seed creates content authored by the current user (since there's only one user). Multi-user interactions (real DMs, real-time chat between two browsers) require registering multiple accounts.
- **Real-time in production**: The Socket.io mini-service runs in-process. For production, deploy it as a separate service (e.g. on Railway/Render) and set `REALTIME_URL` accordingly.
- **Online presence**: Tracked via socket connection (online when socket connected, offline on disconnect). Doesn't survive page refresh gracefully — there's a brief "offline" window during reload.

---

## 📜 License

MIT License — see [LICENSE](./LICENSE) for details.

Copyright © 2026 Manan Sulya (aka. kagewasalive). All rights reserved.

Dyne is an original product created by Manan Sulya (aka. kagewasalive). All source code, design, architecture, and documentation in this repository are the original work of the creator.
