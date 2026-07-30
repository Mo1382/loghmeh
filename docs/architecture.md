# Loqmeh — System Architecture

This document describes the technical architecture of Loqmeh (لقمه). It is the single reference for how the system is structured, how its layers communicate, and why key decisions were made.

> Scope note: this document covers only the **public-facing web application**. Administration, moderation, and category management live in a separate **Admin Dashboard** project and are out of scope here, though integration points are noted where relevant.

---

## Table of Contents

- [Loqmeh — System Architecture](#loqmeh--system-architecture)
  - [Table of Contents](#table-of-contents)
  - [1. Architectural Overview](#1-architectural-overview)
  - [2. Technology Stack](#2-technology-stack)
    - [Frontend](#frontend)
    - [Backend / Data](#backend--data)
    - [Infrastructure \& Tooling](#infrastructure--tooling)
    - [Planned (post-MVP)](#planned-post-mvp)
  - [3. High-Level System Diagram](#3-high-level-system-diagram)
  - [4. Application Layers](#4-application-layers)
  - [5. Project \& Folder Structure](#5-project--folder-structure)
  - [6. Routing Architecture](#6-routing-architecture)
    - [6.1 Access tiers](#61-access-tiers)
    - [6.2 Route protection via middleware](#62-route-protection-via-middleware)
    - [6.3 Navigation shape](#63-navigation-shape)
  - [7. Authentication \& Authorization Architecture](#7-authentication--authorization-architecture)
    - [7.1 Authentication mechanics](#71-authentication-mechanics)
    - [7.2 Authorization model](#72-authorization-model)
    - [7.3 Authorization principles (SEC-001…005)](#73-authorization-principles-sec-001005)
  - [8. Data Architecture](#8-data-architecture)
    - [8.1 Store \& principles](#81-store--principles)
    - [8.2 Collections](#82-collections)
    - [8.3 Relationship diagram](#83-relationship-diagram)
    - [8.4 Indexing strategy](#84-indexing-strategy)
    - [8.5 Population strategy](#85-population-strategy)
  - [9. Domain / Feature Architecture](#9-domain--feature-architecture)
  - [10. Server Actions \& API Layer](#10-server-actions--api-layer)
  - [11. Validation Architecture](#11-validation-architecture)
  - [12. State Management](#12-state-management)
  - [13. Media \& File Upload Architecture](#13-media--file-upload-architecture)
  - [14. Notification Architecture](#14-notification-architecture)
  - [15. Rendering \& Performance Strategy](#15-rendering--performance-strategy)
  - [16. SEO Architecture](#16-seo-architecture)
  - [17. Security Architecture](#17-security-architecture)
  - [18. Deployment \& Infrastructure](#18-deployment--infrastructure)
  - [19. Relationship to the Admin Dashboard](#19-relationship-to-the-admin-dashboard)
  - [20. Architectural Principles](#20-architectural-principles)
  - [21. Future Architecture (Roadmap)](#21-future-architecture-roadmap)

---

## 1. Architectural Overview

Loqmeh is a **monolithic, server-centric web application** built on **Next.js App Router**. A single Next.js deployment serves both the UI (React Server/Client Components) and the backend logic (Server Actions), talking directly to a single **MongoDB** database via **Mongoose**. There is no separate REST/GraphQL API service for the MVP — Server Actions act as the application's internal API boundary.

**Key architectural characteristics**

| Characteristic   | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| Style            | Monolithic full-stack Next.js app (single deployable unit)               |
| Rendering        | Server-Side Rendering (SSR) by default, with SSG/ISR for cacheable pages |
| API boundary     | Next.js Server Actions (no separate REST API for MVP)                    |
| Data store       | Single MongoDB database, accessed only from the server                   |
| Client state     | Minimal — React Context API for cross-cutting UI state only              |
| Auth             | Session-based, managed by Auth.js                                        |
| Deployment       | Vercel (serverless/edge functions + static assets)                       |
| Companion system | Separate Admin Dashboard application, sharing the same database          |

This shape is deliberate: the project principles favor **simplicity and maintainability over premature complexity** (GEN-001, GEN-007, ARCH-002), so the architecture avoids a dedicated API layer, microservices, or client-heavy state management until the product actually needs them (see [§21](#21-future-architecture-roadmap)).

---

## 2. Technology Stack

### Frontend

| Layer      | Technology           | Role                               |
| ---------- | -------------------- | ---------------------------------- |
| Framework  | Next.js (App Router) | Routing, rendering, Server Actions |
| Language   | JavaScript           | Application code                   |
| UI Library | React                | Component model                    |
| Styling    | Tailwind CSS         | Utility-first styling              |
| Components | shadcn/ui            | Accessible base components         |
| Forms      | React Hook Form      | Form state, submission             |
| State      | Context API          | Global/cross-cutting UI state      |
| Dates      | date-fns             | Date formatting/parsing            |
| Loading UI | react-spinners       | Loading indicators                 |

### Backend / Data

| Layer        | Technology                    | Role                                               |
| ------------ | ----------------------------- | -------------------------------------------------- |
| Database     | MongoDB (Atlas in production) | Primary data store                                 |
| ODM          | Mongoose                      | Schemas, validation, population                    |
| Auth         | Auth.js                       | Sessions, credential/OAuth handling                |
| Validation   | Zod                           | Single source of validation truth, client + server |
| Email        | Resend                        | Transactional email (OTP, notifications)           |
| File Storage | UploadThing                   | Image uploads (avatars, recipe images)             |

### Infrastructure & Tooling

| Category             | Technology       |
| -------------------- | ---------------- |
| Hosting / Deployment | Vercel           |
| Package Manager      | NPM              |
| Version Control      | GitHub           |
| Linting / Formatting | ESLint, Prettier |

### Planned (post-MVP)

| Category         | Technology                                | Introduced at |
| ---------------- | ----------------------------------------- | ------------- |
| Testing          | Vitest, Playwright, React Testing Library | v1.1          |
| Analytics        | PostHog                                   | v1.2          |
| Error Monitoring | Sentry                                    | v1.2          |
| Caching          | Redis                                     | v3.0          |
| Advanced Search  | Algolia                                   | v3.0          |

---

## 3. High-Level System Diagram

```text
                              ┌────────────────────────────┐
                              │        Client (Browser)     │
                              │  React Server + Client       │
                              │  Components · RTL Persian UI │
                              └───────────────┬─────────────┘
                                              │ HTTPS
                                              ▼
                       ┌──────────────────────────────────────────┐
                       │             Vercel Edge / Node             │
                       │  ┌────────────────────────────────────┐  │
                       │  │      Next.js App Router (App)       │  │
                       │  │  ── middleware.ts (route guarding)  │  │
                       │  │  ── Server Components (data reads)  │  │
                       │  │  ── Server Actions (writes/mutations)│ │
                       │  │  ── Auth.js (session/JWT handling)  │  │
                       │  └───────────────┬──────────────────────┘  │
                       └──────────────────┼─────────────────────────┘
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             ▼                            ▼                            ▼
   ┌───────────────────┐      ┌────────────────────┐        ┌────────────────────┐
   │  MongoDB (Atlas)   │      │  UploadThing        │        │  Resend             │
   │  via Mongoose      │      │  (image storage)     │        │  (transactional     │
   │  loqmeh / loqmeh_dev│     │                      │        │   email / OTP)      │
   └───────────────────┘      └────────────────────┘        └────────────────────┘

                       ┌──────────────────────────────────────────┐
                       │        Admin Dashboard (separate app)      │
                       │  Shares the same MongoDB database          │
                       │  Owns: Category CRUD, moderation,          │
                       │        ticket management, announcements    │
                       └──────────────────────────────────────────┘
```

**Request lifecycle (typical read)**

```text
Browser → Next.js Server Component → Mongoose query → MongoDB
                                              │
                                    (populate authorId/categoryId)
                                              ▼
                                     Rendered HTML/RSC payload → Browser
```

**Request lifecycle (typical write)**

```text
Browser (Client Component form) → Server Action
   → Zod validation → Auth.js session check → Ownership check
   → Mongoose write → MongoDB
   → revalidatePath()/revalidateTag() → updated UI
```

---

## 4. Application Layers

Per ARCH-004/ARCH-007 (separate UI, business logic, and data access), the app is organized into four logical layers, even though all four run inside one Next.js codebase:

| Layer                            | Responsibility                                              | Lives in                                                        |
| -------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| **Presentation**                 | Server/Client Components, layouts, pages                    | `app/`, `components/`                                           |
| **Application / Business Logic** | Orchestrates validation, authorization, and data operations | `lib/actions/*`, `lib/services/*`                               |
| **Data Access**                  | Mongoose models, queries, population                        | `lib/models/*`, `lib/db/*`                                      |
| **Cross-Cutting**                | Auth, validation schemas, email, uploads, utilities         | `lib/auth/*`, `lib/validation/*`, `lib/email/*`, `lib/upload/*` |

**Component strategy (ARCH-002/003)**

- **Server Components by default** for all data-fetching pages (recipe lists, profiles, categories) — reduces client JS and improves TTFB.
- **Client Components only where interactive**: forms (`RecipeForm`, `LoginForm`), toggles (`BookmarkButton`, `FollowButton`), carousels (`HorizontalCarousel`), and anything using state/effects.
- Shared UI (`RecipeCard`, `UserCard`, `EmptyState`, `Modal`) is built as small, reusable, presentation-only components (ARCH-006).

---

## 5. Project & Folder Structure

The application follows Next.js App Router conventions with route groups for auth pages:

```text
src/
├── app/
│   ├── layout.tsx                    // Root layout (RTL, fonts, providers)
│   ├── page.tsx                      // Home Feed (/)
│   ├── (auth)/                       // Route group — shared AuthLayout
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── verify-reset-code/page.tsx
│   │   └── reset-password/page.tsx
│   ├── change-password/page.tsx
│   ├── recipes/
│   │   ├── page.tsx                  // /recipes (filters, sort)
│   │   ├── new/page.tsx
│   │   └── [slug]/
│   │       ├── page.tsx
│   │       └── edit/page.tsx
│   ├── categories/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── search/page.tsx
│   ├── community/page.tsx
│   ├── profile/
│   │   ├── page.tsx                  // My Profile
│   │   └── [username]/
│   │       ├── page.tsx
│   │       ├── followers/page.tsx
│   │       └── followings/page.tsx
│   ├── bookmarks/page.tsx
│   ├── notifications/page.tsx
│   ├── support/page.tsx
│   └── not-found.tsx
├── components/                       // Shared, reusable UI
├── lib/
│   ├── actions/                      // Server Actions, grouped per feature
│   ├── models/                       // Mongoose schemas
│   ├── validation/                   // Zod schemas
│   ├── auth/                         // Auth.js config, session helpers
│   ├── db/                           // Mongoose connection singleton
│   ├── email/                        // Resend templates & senders
│   └── upload/                       // UploadThing config
└── middleware.ts                     // Route protection
```

This mirrors ARCH-005 (feature-based organization): each feature's Server Actions, validation schema, and Mongoose model are easy to locate together conceptually even though grouped by technical layer, keeping business logic (`lib/`) out of UI components (`app/`, `components/`).

---

## 6. Routing Architecture

24 routes total, grouped into 8 categories (Authentication, Recipes, Categories, Search, Profile, Community, System, Error). Full detail lives in `routes.md`; the architecturally relevant points:

### 6.1 Access tiers

| Tier                      | Example routes                                                                                                       | Guard                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Public                    | `/`, `/recipes`, `/recipes/[slug]`, `/categories`, `/search`, `/community`, `/profile/[username]`, `/support` (view) | None                      |
| Protected (authenticated) | `/recipes/new`, `/change-password`, `/profile`, `/bookmarks`, `/notifications`, `/support` (submit)                  | Session required          |
| Owner-only                | `/recipes/[slug]/edit`, `/profile/[username]/followers`, `/profile/[username]/followings`                            | Session + ownership check |

### 6.2 Route protection via middleware

A single `middleware.ts` intercepts all non-static, non-API requests and redirects based on session presence:

- Authenticated users hitting auth-only pages (`/login`, `/register`, ...) → redirected to `/`.
- Unauthenticated users hitting protected routes → redirected to `/login?redirect=<original path>`.
- Owner-only routes perform a **second-layer check inside the Server Component/Action itself**, since middleware cannot cheaply verify resource ownership (it would require a DB round trip); middleware only guarantees authentication, and ownership is verified where the resource is loaded.

### 6.3 Navigation shape

```text
Home (/) ── Recipes ── Recipe Detail ── Author → Profile
        │                            └ Category → Category Detail
        ├── Categories ── Category Detail ── Recipe → Recipe Detail
        ├── Search ── Result → Recipe Detail
        ├── Community ── User → Profile
        ├── Profile ── Followers / Followings / Change Password
        ├── Bookmarks ── Recipe → Recipe Detail
        ├── Notifications ── Related Content
        └── Support
```

---

## 7. Authentication & Authorization Architecture

### 7.1 Authentication mechanics

- **Auth.js** manages sessions end-to-end; the `Session` collection is fully owned by Auth.js and never written to directly by application code.
- Registration and password flows use a **VerificationCode** collection (6-digit OTP, 10-minute expiry, single use, purpose-scoped: `EMAIL_VERIFICATION`, `PASSWORD_RESET`).
- Sessions are invalidated on password change (AUTH-022), and codes are rate-limited against abuse (AUTH-015/016).

### 7.2 Authorization model

There is **one database role for the MVP**: `USER`. `ADMIN` exists in the schema/enum but is managed and used exclusively by the separate Admin Dashboard.

```javascript
// User.role — persisted, controls permissions
role: { type: String, enum: ["USER", "ADMIN"], default: "USER" }

// User.title — persisted, display-only, no permission impact
title: { type: String, enum: ["USER", "COOK", "HEAD_CHEF", "BARISTA", "FOOD_BLOGGER"], default: "USER" }
```

Beyond the stored `role`, the app relies on **logical (computed) roles** — not stored, evaluated per request:

| Logical role       | Computed as                             |
| ------------------ | --------------------------------------- |
| Guest              | `!session?.user`                        |
| Authenticated User | `!!session?.user`                       |
| Recipe Owner       | `session.user._id === recipe.authorId`  |
| Comment Author     | `session.user._id === comment.authorId` |

```javascript
// Server-side pattern used throughout Server Actions
const session = await getServerSession(authOptions);
if (!session?.user) throw new UnauthorizedError();

const recipe = await Recipe.findById(id);
const isOwner = recipe.authorId.equals(session.user._id);
if (!isOwner) throw new ForbiddenError();
```

### 7.3 Authorization principles (SEC-001…005)

- Authenticate first, then authorize (identity before permission).
- Every protected/owner route is checked **server-side**; client-side checks (hiding a button) are UX only, never the security boundary.
- Least privilege: authenticated users can only mutate resources they own; nothing implicitly cascades to "any user" permissions.
- Standard authorization error mapping: `401` not authenticated → "Please sign in to continue"; `403` forbidden → "You don't have permission"; `404` used instead of `403` where revealing existence itself would leak information (e.g. private resources).

---

## 8. Data Architecture

### 8.1 Store & principles

Single MongoDB database (`loqmeh` prod / `loqmeh_dev` dev), modeled with Mongoose. Core rules (DATA-001…007):

- One authoritative location per fact — no duplicated denormalized fields like `recipe.authorName` (only `recipe.authorId`, resolved via `populate()`).
- **Reference** independent entities with their own lifecycle (User, Recipe, Category, Comment, Rating).
- **Embed** tightly-coupled sub-objects with no independent lifecycle (ingredients, steps, nutrition, comment replies, user settings/stats/social links).
- Frequently-read derived values (`averageRating`, `followerCount`, etc.) are **stored and kept in sync by application logic**, not recomputed per request — a deliberate read-optimization trade-off given the read-heavy nature of a recipe browsing app.
- Every document has exactly one clear **owner** for authorization purposes.
- Soft delete is used for content collections; hard delete elsewhere.

### 8.2 Collections

| Collection          | Domain        | Owner           | Notes                                                       |
| ------------------- | ------------- | --------------- | ----------------------------------------------------------- |
| User                | Identity      | —               | Central identity; referenced by nearly everything           |
| Recipe              | Content       | User            | Core content entity; embeds ingredients/steps/nutrition     |
| Category            | Content       | —               | Admin-managed, referenced by Recipe                         |
| Rating              | Engagement    | User            | Unique per `userId + recipeId`                              |
| Bookmark            | Engagement    | User            | Many-to-many junction, User ↔ Recipe                        |
| Comment             | Community     | User            | Replies embedded one level deep (not a separate collection) |
| Follow              | Community     | User (follower) | Unique per `followerId + followingId`                       |
| Notification        | Communication | User            | System-generated only                                       |
| SupportTicket       | Support       | User            | Status managed by Admin app                                 |
| VerificationCode    | Auth          | —               | Matched by email, not ObjectId; short-lived                 |
| Session _(Auth.js)_ | Auth          | User            | Fully managed by Auth.js, read-only to app code             |

### 8.3 Relationship diagram

```text
                                   User
                                    │
      ┌────────────┬────────────────┼────────────────┬─────────────┐
      │            │                │                │             │
   Recipe       Comment          Rating           Bookmark    Notification
      │            │                                              │
      │            └── replies (embedded, 1 level)                │
 ┌────┴────┐                                                 SupportTicket
Category  (also referenced by Comment, Rating,
           Bookmark, Notification via recipeId)

User (1) ──── Follow ──── User (1)     [followerId / followingId]
```

| Relationship type | Implementation                 | Examples                                                               |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------- |
| One-to-One        | Embedded sub-document          | User→settings/stats/socialLinks, Recipe→nutrition/stats                |
| One-to-Many       | Reference field (`<entity>Id`) | User→Recipe, Category→Recipe, Recipe→Comment, User→Notification        |
| Many-to-Many      | Dedicated junction collection  | User↔Recipe via Bookmark, User↔Recipe via Rating, User↔User via Follow |

### 8.4 Indexing strategy

Every collection defines a primary index on `_id`, uniqueness constraints where the business rule demands it (`User.username`/`email`, `Recipe.slug`, compound `Rating.userId+recipeId`, `Bookmark.userId+recipeId`, `Follow.followerId+followingId`), and performance indexes on the fields used for sorting/filtering (`Recipe.stats.averageRating`, `Recipe.categoryId`, `Notification.userId+isRead`, etc.). Compound indexes exist specifically to support the Categories and Home Feed sort/filter combinations (`categoryId + createdAt`, `categoryId + stats.averageRating`).

### 8.5 Population strategy

To avoid deep population chains (a stated anti-pattern), each collection populates only what its UI needs:

| Collection    | Populates                                     |
| ------------- | --------------------------------------------- |
| Recipe        | `authorId`, `categoryId`                      |
| Comment       | `authorId`                                    |
| Bookmark      | `recipeId`                                    |
| Notification  | `actorId`, `recipeId`                         |
| Rating        | none (aggregated, not populated per-document) |
| SupportTicket | none                                          |

---

## 9. Domain / Feature Architecture

Each product feature maps to a small, self-contained slice spanning routes → Server Actions → Mongoose models:

| Feature          | Primary Collections            | Primary Routes                                                                                    | Key Server Actions                                                            |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Authentication   | User, VerificationCode         | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/change-password` | `registerUser`, `loginUser`, `verifyEmail`, `resetPassword`, `changePassword` |
| Home Feed        | Recipe, Category, User, Follow | `/`                                                                                               | `getPopularRecipes`, `getPopularCategories`, `getFollowingFeed`               |
| Recipes          | Recipe, Category, User         | `/recipes`, `/recipes/new`, `/recipes/[slug]`, `/recipes/[slug]/edit`                             | `createRecipe`, `updateRecipe`, `publishRecipe`, `getRecipes`                 |
| Categories       | Category, Recipe               | `/categories`, `/categories/[slug]`                                                               | `getCategories`, `getCategoryRecipes`                                         |
| Search           | Recipe, Category               | `/search`                                                                                         | `searchRecipes`, `getSearchSuggestions`                                       |
| Ratings          | Rating, Recipe, User           | (embedded in Recipe Detail)                                                                       | `rateRecipe`                                                                  |
| Comments         | Comment, Recipe, User          | (embedded in Recipe Detail)                                                                       | `createComment`, `likeComment`, `dislikeComment`                              |
| Bookmarks        | Bookmark, Recipe               | `/bookmarks`                                                                                      | `addBookmark`, `removeBookmark`, `getBookmarks`                               |
| User Profile     | User, Recipe, Follow           | `/profile`, `/profile/[username]`                                                                 | `getProfile`, `updateProfile`, `uploadAvatar`                                 |
| Following System | Follow, User                   | `/profile/[username]/followers`, `/profile/[username]/followings`                                 | `followUser`, `unfollowUser`, `getFollowers`                                  |
| Community        | User                           | `/community`                                                                                      | `getUsers`                                                                    |
| Notifications    | Notification, User             | `/notifications`                                                                                  | `getNotifications`, `markNotificationAsRead`                                  |
| Support Tickets  | SupportTicket, User            | `/support`                                                                                        | `createSupportTicket`, `rateSupportExperience`                                |
| Settings         | User                           | `/profile` (settings section), `/change-password`                                                 | `updateProfile`, `updatePrivacySettings`, `changePassword`                    |

This mapping is the practical expression of ARCH-005 (feature-based organization): a developer working on "Bookmarks" only needs to touch the `Bookmark` model, its Server Actions, and the `/bookmarks` route/components.

---

## 10. Server Actions & API Layer

There is no standalone REST/GraphQL API for the MVP. **Next.js Server Actions are the entire write API surface**, and Server Components perform reads directly against Mongoose.

**Standard Server Action shape:**

```javascript
"use server";

export async function createRecipe(input) {
  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError();

  // 2. Validate (Zod — same schema used on the client)
  const data = recipeSchema.parse(input);

  // 3. Authorize / business rules (e.g. required fields already enforced by schema)
  // 4. Persist
  const recipe = await Recipe.create({ ...data, authorId: session.user._id });

  // 5. Revalidate affected paths/tags
  revalidatePath("/recipes");
  revalidatePath("/my-recipes");

  return recipe;
}
```

Rationale for this pattern over a REST layer (DATA-008/009, DEV-012): it removes an entire network hop and serialization boundary for a monolithic app with one frontend consumer, at the cost of coupling the write API to Next.js. If the Admin Dashboard or a future native mobile app (v7.0) needs programmatic access, a versioned REST/GraphQL layer can be introduced later without redesigning the data layer — Server Actions would simply become thin wrappers around the same `lib/services` functions.

---

## 11. Validation Architecture

Zod is the **single source of validation truth** (DATA-014), with the same schema reused on both sides:

```text
┌─────────────────┐        shared Zod schema        ┌──────────────────┐
│  React Hook Form │ ───────────────────────────────▶ │  Server Action    │
│  (client)         │   (immediate UX feedback)        │  (authoritative)  │
└─────────────────┘                                  └──────────────────┘
```

- **Client-side** validation (via React Hook Form + Zod resolvers) exists purely for UX — instant feedback, disabled submit buttons.
- **Server-side** validation is authoritative and non-optional (DATA-015 — never trust client validation alone); every Server Action re-validates input with the same Zod schema before touching the database.
- Representative schemas: `recipeSchema`, `registerSchema`, `loginSchema`, `otpSchema`, `changePasswordSchema`, `profileSchema` — one per feature, colocated in `lib/validation/`.
- Mongoose schema-level constraints (required fields, enums, min/max) act as a **final database-level safety net** beneath Zod, not a replacement for it.

---

## 12. State Management

Given the SSR-first approach, client state is intentionally minimal:

| State type             | Mechanism                                      | Examples                                                         |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Server/page data       | Server Components, no client state needed      | Recipe lists, profiles, categories                               |
| Cross-cutting UI state | React Context API                              | Auth/session context, theme (future), toast/notification context |
| Local component state  | `useState`/`useReducer`                        | Form fields, dropdown open/closed, carousel position             |
| Optimistic UI          | Local state + Server Action + `revalidatePath` | Bookmark toggle, follow/unfollow, comment like/dislike           |

There is no global client-side data-fetching library (e.g. React Query/SWR) in the MVP, since most data is fetched server-side; this is revisited only if client-side interactivity needs grow (DEV-012 — introduce new technology only when it provides clear value).

---

## 13. Media & File Upload Architecture

**UploadThing** handles all image uploads (avatars, recipe cover images/gallery):

```text
Client (ImageUploader) → UploadThing client SDK → UploadThing storage
                                                        │
                                        returns HTTPS URL ──▶ Server Action
                                                                   │
                                                    stored on User.avatar /
                                                    Recipe.coverImage/gallery
```

- Only image files are accepted (JPG, PNG, WebP); maximum size 5 MB (SYS-001/002).
- Uploaded URLs are validated (HTTPS, valid image) before being persisted (SYS-003).
- The database only ever stores the resulting URL string — binary data never touches MongoDB.

---

## 14. Notification Architecture

Notifications are **system-generated only** — there is no user-facing "create notification" action. Triggers:

```text
Rating created  ──────┐
Comment created ──────┼──▶ Notification.create({ userId: recipe.authorId, type, ... })
Comment liked/disliked ┤
Comment replied ───────┘
Admin sends announcement ──▶ broadcast Notification.create() per targeted user
Support ticket updated (Admin app) ──▶ Notification.create({ userId: ticket.userId, type: SUPPORT_TICKET_UPDATED })
```

- The unread badge is a boolean indicator (not a count), recomputed from `Notification.isRead` whenever notifications are created, read, or deleted.
- Notifications reference their subject optionally (`recipeId`, `commentId`, `supportTicketId`) so opening one can deep-link to the right page.
- This is currently **pull-based** (loaded on page visit); real-time push (WebSockets/SSE) and email/push notifications are explicitly future enhancements, not part of the MVP architecture.

---

## 15. Rendering & Performance Strategy

Each route uses the rendering strategy best suited to its data volatility and personalization needs:

| Route type    | Strategy      | Detail                                                    |
| ------------- | ------------- | --------------------------------------------------------- |
| Home          | ISR           | Revalidate every 60s                                      |
| All Recipes   | SSR + caching | Cache 30s                                                 |
| Recipe Detail | SSG + ISR     | Static with on-demand revalidation (e.g. on edit/publish) |
| Categories    | SSG           | Fully static                                              |
| Search        | Client-side   | Debounced, dynamic by nature                              |
| Profile       | SSR           | Personalized per viewer/owner                             |
| Auth pages    | Static        | No dynamic data                                           |

**Pagination**: infinite scroll for content feeds (Recipes, Category Detail, Search, Bookmarks, Notifications — 12–20 items per page) and classic pagination for list-style pages where jumping to a position matters (Profile Recipes, Community, Followers/Followings — 12–24 items per page).

This tiered strategy follows Technical Goal "High Performance" (Critical priority) from the product spec: static/ISR pages minimize server load and TTFB for the highest-traffic, least personalized pages, while SSR is reserved for genuinely personalized views.

---

## 16. SEO Architecture

- Every published recipe has a stable, unique `slug`, generated once and **not changed after publication** (SYS-015/016), which is the backbone of SEO-friendly URLs.
- Dynamic metadata (`generateMetadata`) per recipe/category/profile page, including Open Graph tags (title, description, cover image) for social sharing.
- Static metadata patterns per route type (title/description templates) so every page has meaningful `<title>`/`<meta>` even without recipe-specific data.
- Search-relevant content is server-rendered (SSR/SSG/ISR, not client-only) precisely so crawlers see full content — this is one more reason the app defaults to Server Components.

---

## 17. Security Architecture

| Concern              | Mechanism                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Authentication       | Auth.js sessions; passwords hashed, never returned in API responses                               |
| Authorization        | Server-side session + ownership checks on every mutation (never client-only)                      |
| Input validation     | Zod on every Server Action input, both client and server                                          |
| Content sanitization | User-generated content (bio, comments, recipe text) sanitized to prevent XSS                      |
| Secrets              | Environment variables only; never exposed to the client bundle; never committed to source control |
| Rate limiting        | Applied to verification code requests/attempts to prevent abuse                                   |
| Error handling       | Internal errors never exposed to users; generic messages + server-side logging                    |
| Data protection      | Statistics and system-managed fields (`stats`, `role`, timestamps) are never client-writable      |

Authorization error responses are standardized (`401`/`403`/`404`) as defined in [§7.3](#73-authorization-principles-sec-001005), and all "Critical" and "High" priority business rules from `business-rules.md` (e.g. AUTH-001–007, REC-001/014/015, SEC-001–010) are enforced at the Server Action / Mongoose layer, not merely in the UI.

---

## 18. Deployment & Infrastructure

```text
GitHub (source of truth)
     │  push / PR merge
     ▼
Vercel (CI/CD, automated deploys)
     │
     ├── Serverless Functions ── Server Actions, Server Components (SSR)
     ├── Edge/Static assets ──── SSG pages, static files
     └── Environment Variables ── DB connection string, Auth.js secrets,
                                   Resend API key, UploadThing token
                                          │
                                          ▼
                                MongoDB Atlas (managed, production)
```

- **Environments**: production database `loqmeh`, development database `loqmeh_dev` — fully separate to avoid dev data ever touching production.
- **Configuration** lives entirely in environment variables (DEV-006), never hardcoded or committed (DEV-007).
- **Continuous deployment**: every merge to the main branch triggers an automated Vercel deployment (DEV-008); the app is designed to remain deployable at all times (DEV-005).
- **Git workflow**: feature branches for non-trivial work, small focused commits, merge only reviewed/tested code (DEV-001–004).

---

## 19. Relationship to the Admin Dashboard

Loqmeh's public app and the Admin Dashboard are **two separate deployable applications sharing one MongoDB database**. This is a deliberate architectural boundary, not an oversight:

| Concern                                 | Owned by                   |
| --------------------------------------- | -------------------------- |
| Category CRUD                           | Admin Dashboard            |
| Comment/user moderation                 | Admin Dashboard            |
| Support ticket status & replies         | Admin Dashboard            |
| System-wide announcements               | Admin Dashboard            |
| Recipe/comment/rating/bookmark creation | Public app (this document) |
| End-user authentication & profile       | Public app (this document) |

Because both apps read/write the same collections, the **database schema itself is the integration contract** between them — there is no API between the two apps in the MVP. This keeps the public app simple, at the cost of both codebases needing to stay in sync with schema changes; this trade-off is accepted for the MVP and can be revisited (e.g. via a shared internal package or a thin internal API) if the two codebases start diverging.

---

## 20. Architectural Principles

These are the standing principles that should govern any future architectural decision, from `project-principles.md`:

**Decision framework** — before adding anything, ask: Is it the simplest solution that works? Can it be understood and modified easily? Does it hurt performance? Will it scale? Does it introduce security risk? Is it accessible? Can it be tested?

**Conflict resolution order** — when principles conflict, prioritize in this order:

1. Security — never compromise user security
2. Data integrity — protect user data
3. Performance — ensure a good user experience
4. Maintainability — enable future development
5. Simplicity — keep solutions straightforward

**Core architectural commitments carried through this document:**

- App Router + Server Components by default; Client Components only where interactivity demands it.
- Business logic stays out of UI components; UI, business logic, and data access remain separated.
- MongoDB/Mongoose for flexible document modeling suited to nested recipe content.
- Zod as the single validation source, enforced server-side regardless of client checks.
- Soft deletion preferred over hard deletion for content collections.
- New technology (Redis, Algolia, a REST API, etc.) is introduced only when it provides clear, demonstrated value — not preemptively.

---

## 21. Future Architecture (Roadmap)

The architecture is intentionally left room to evolve without a rewrite:

| Version | Architectural change                                                                           | Why it doesn't exist yet                                          |
| ------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| v1.1    | Add Vitest/Playwright/RTL testing layer                                                        | MVP ships first; tests formalized once core flows stabilize       |
| v1.2    | Add PostHog (analytics) and Sentry (monitoring) as observability layer                         | Avoids premature tooling overhead                                 |
| v2.0    | Theming layer (dark mode) in the presentation layer                                            | Nice-to-have, no architectural dependency                         |
| v3.0    | Redis caching layer in front of MongoDB; Algolia replacing basic Mongo text search             | Current traffic doesn't yet justify the added infrastructure/cost |
| v4.0    | Recommendation engine (likely a separate service/job consuming the same MongoDB data)          | Needs sufficient user/interaction data first                      |
| v5.0    | AI cooking assistant (likely an external LLM API integration)                                  | Requires significant infrastructure; explicitly out of MVP scope  |
| v6.0    | Meal planning domain (new collections: MealPlan, ShoppingList)                                 | Needs product validation before schema commitment                 |
| v7.0    | Native mobile apps — would likely require promoting Server Actions into a versioned public API | Web-first strategy for MVP                                        |
| v8.0    | Multi-language / i18n layer (content + UI direction beyond RTL Persian)                        | Persian-first market focus for MVP                                |

Each of these is additive to the current architecture (new layers/services alongside the existing monolith) rather than a structural replacement, consistent with "keep the architecture flexible" (DEV-010) and "avoid vendor lock-in whenever practical" (DEV-011).

---

_Document Version: 1.0_
_Synthesized from: 01-product.md, 02-features.md, business-rules.md, database.md, project-principles.md, roles.md, routes.md, user-flows.md_
_Last Updated: July 2026_
