# Loghmeh — Database Schema Reference

> Single MongoDB database, modeled with Mongoose. Reorganized version of the full database documentation — same technical content, restructured collection-by-collection for easier reference. Prose/philosophy sections were trimmed; fields, embedded objects, virtuals, relationships, indexes, validation rules, business rules, and example documents are kept in full for every collection.

---

## 1. Stack & Core Principles

| Tech | Role |
|---|---|
| MongoDB (Atlas in prod) | Primary database |
| Mongoose | ODM — schemas, validation, population |
| Auth.js | Authentication & sessions |
| Zod | Server-side validation |
| Cloudinary (or equivalent) | Image storage |
| Redis (optional) | Caching |

**Databases:** production `loqmeh`, development `loqmeh_dev`.

**Design principles**
- Each piece of information has exactly one authoritative location (no duplication across collections — e.g. `recipe.authorName` is never stored, only `recipe.authorId`).
- **Reference** (ObjectId) independent entities with their own lifecycle: User, Recipe, Category, Comment, Rating.
- **Embed** tightly-coupled sub-objects that never exist independently: ingredients, cooking steps, nutrition, comment replies, user settings/stats/social links.
- Frequently-read derived values (average ratings, follower/recipe counts) are **stored and kept in sync by application logic**, not recalculated per request.
- Every document has exactly one clear **owner**, used for authorization.
- Write operations are atomic — no partial updates that could leave inconsistent state.
- Content collections (e.g. Comment) may use **soft delete**; others are hard-deleted.

**Naming conventions:** collections = singular PascalCase · fields = camelCase · references = `<entity>Id` (e.g. `userId`) · arrays of references = plural (`recipeIds`) · timestamps: `createdAt`, `updatedAt`, managed automatically by Mongoose wherever possible.

---

## 2. Collections at a Glance

| Collection | Domain | Purpose | Owner |
|---|---|---|---|
| **User** | User | Accounts, profile, auth data, social links, stats | — |
| **Recipe** | Recipe | Published recipes: ingredients, steps, nutrition, stats | User |
| **Category** | Recipe | Recipe classification/filtering (admin-managed) | — |
| **Rating** | Recipe | One user's rating of one recipe (1–5) | User |
| **Bookmark** | Recipe | Saved recipes (many-to-many User↔Recipe) | User |
| **Comment** | Community | Comments + embedded replies on recipes | User |
| **Follow** | Community | Follower/following relationship between users | User (follower) |
| **Notification** | Community | System-generated notifications | User |
| **SupportTicket** | Support | User → platform support requests | User |
| **VerificationCode** | Auth | Short-lived email/password-reset codes | — |
| **Session** *(Auth.js)* | Auth | Fully managed by Auth.js | User |

### Relationship Types Used

| Type | Implementation | Examples |
|---|---|---|
| One-to-One | Embedded (not a separate collection) | User→settings/socialLinks/stats, Recipe→nutrition/stats |
| One-to-Many | Reference (`<entity>Id` field) | User→Recipe, Category→Recipe, Recipe→Comment, User→Notification |
| Many-to-Many | Dedicated junction collection | User↔Recipe via Bookmark, User↔Recipe via Rating, User↔User via Follow |

### High-Level Diagram

```text
                                  User
                                   │
        ┌───────────┬──────────────┼──────────────┬─────────────┐
        │            │              │              │             │
      Recipe      Comment        Rating        Bookmark     Notification
        │            │                                         │
        │            └── replies (embedded)                    │
   ┌────┴────┐                                            SupportTicket
Category  (also referenced by Comment, Rating,
           Bookmark, Notification via recipeId)

User (1) ──── Follow ──── User (1)     [followerId / followingId]
```

---

## 3. Collections — Full Reference

### 3.1 User

**Overview.** Central identity collection, referenced by Recipe, Comment, Rating, Bookmark, Follow, Notification, and SupportTicket. Auth.js handles authentication mechanics; this collection stores profile and app-specific data.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `firstName` | String | ✅ | — | 2–50 chars | First name |
| `lastName` | String | ✅ | — | 2–50 chars | Last name |
| `username` | String | ✅ | — | unique, lowercase, 3–30 chars, `[a-z0-9_]` | Public username |
| `email` | String | ✅ | — | unique, lowercase, valid email | Login email |
| `password` | String | ✅* | — | hashed | *not required for OAuth accounts |
| `avatar` | String | ❌ | default avatar | valid HTTPS image URL | Profile image |
| `bio` | String | ❌ | "" | max 300 chars | Biography |
| `title` | Enum | ✅ | `USER` | see User Titles | Public title (display only, no permission impact) |
| `role` | Enum | ✅ | `USER` | see User Roles | Permission role |
| `socialLinks` | Object | ❌ | {} | valid URLs | See Embedded Objects |
| `stats` | Object | ✅ | auto | system managed | See Embedded Objects |
| `settings` | Object | ✅ | auto | system managed | See Embedded Objects |
| `emailVerified` | Boolean | ✅ | false | — | Email verification status |
| `isActive` | Boolean | ✅ | true | — | Account active flag |
| `createdAt` / `updatedAt` | Date | ✅ | auto | ISO Date | |

**Embedded Objects**

*socialLinks*

| Field | Type | Required | Validation |
|---|---|---|---|
| `instagram` | String | ❌ (null) | valid Instagram URL |
| `telegram` | String | ❌ (null) | valid Telegram URL |
| `x` | String | ❌ (null) | valid X (Twitter) URL |

*stats* (system-managed, never manually edited)

| Field | Type | Default |
|---|---|---|
| `recipeCount` | Number | 0 |
| `followerCount` | Number | 0 |
| `followingCount` | Number | 0 |
| `averageRating` | Number | 0 |

*settings*

| Field | Type | Default |
|---|---|---|
| `profileVisibility` | Enum | `PUBLIC` |
| `allowSearchEngines` | Boolean | true |

**Virtual Fields** (computed, not stored): `fullName` (= firstName + " " + lastName), `recipeUrl`, `profileUrl`, `initials`.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| Recipe | 1→N | One User → Many Recipes |
| Comment | 1→N | One User → Many Comments |
| Rating | 1→N | One User → Many Ratings |
| Bookmark | 1→N | One User → Many Bookmarks |
| Follow | 1→N (×2) | One User → Many Follow docs (as follower and as following) |
| Notification | 1→N | One User → Many Notifications |
| SupportTicket | 1→N | One User → Many Support Tickets |

**Indexes**
- Primary: `_id`
- Unique: `username`, `email`
- Performance: `username`, `stats.averageRating`, `stats.recipeCount`, `createdAt`

**Validation Rules**
- `firstName` / `lastName`: required, trimmed, 2–50 chars.
- `username`: required, unique, lowercase only, 3–30 chars, letters/numbers/underscore only, no spaces.
- `email`: required, unique, lowercase, valid format.
- `password`: min 8 chars, stored only as a secure hash, never returned in API responses.
- `avatar`: HTTPS URL, valid image, uploaded via the app's image service.
- `bio`: max 300 chars.
- `socialLinks`: if provided, must be valid URLs matching the corresponding platform.

**Business Rules**
- Every registered user owns exactly one User document.
- Usernames and emails are unique.
- Email verification is required before the account becomes fully active.
- Passwords are never stored in plain text.
- User titles are public; user roles control permissions.
- Statistics are managed exclusively by the system.
- Social links are optional; empty ones are stored as `null`.
- Only the account owner can update their profile.
- Users cannot modify statistics, role, average rating, recipe count, or follower/following counts.

**Example Document**

```json
{
  "_id": "ObjectId",
  "firstName": "John",
  "lastName": "Doe",
  "username": "john_doe",
  "email": "john@example.com",
  "password": "$2b$12$...",
  "avatar": "https://cdn.loghmeh.com/users/avatar.jpg",
  "bio": "Home cook who loves Italian cuisine.",
  "title": "COOK",
  "role": "USER",
  "socialLinks": {
    "instagram": "https://instagram.com/john_doe",
    "telegram": null,
    "x": "https://x.com/john_doe"
  },
  "stats": {
    "recipeCount": 24,
    "followerCount": 187,
    "followingCount": 63,
    "averageRating": 4.8
  },
  "settings": {
    "profileVisibility": "PUBLIC",
    "allowSearchEngines": true
  },
  "emailVerified": true,
  "isActive": true,
  "createdAt": "2026-07-01T08:30:00Z",
  "updatedAt": "2026-07-29T14:15:00Z"
}
```

---

### 3.2 Recipe

**Overview.** Core content collection. Each recipe belongs to exactly one user and one category, and may receive ratings, comments, and bookmarks (all stored in their own collections).

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `authorId` | ObjectId | ✅ | — | existing User | Recipe owner |
| `categoryId` | ObjectId | ✅ | — | existing Category | Recipe category |
| `title` | String | ✅ | — | 5–120 chars | Recipe title |
| `slug` | String | ✅ | auto | unique | SEO-friendly URL |
| `description` | String | ✅ | — | 30–500 chars | Short description |
| `origin` | String | ❌ | null | max 60 chars | Country/region of origin |
| `difficulty` | Enum | ✅ | `EASY` | see Difficulty Enum | Cooking difficulty |
| `preparationTime` | Number | ✅ | — | ≥1 | Prep time (minutes) |
| `cookingTime` | Number | ❌ | 0 | ≥0 | Cooking time (minutes) |
| `servings` | Number | ✅ | 1 | 1–100 | Number of servings |
| `coverImage` | String | ✅ | — | valid HTTPS image URL | Main image |
| `gallery` | Array\<String\> | ❌ | [] | valid image URLs | Additional images |
| `ingredients` | Array\<Object\> | ✅ | — | min 1 item | See Embedded Objects |
| `steps` | Array\<Object\> | ✅ | — | min 1 item | See Embedded Objects |
| `nutrition` | Object | ❌ | {} | system schema | See Embedded Objects |
| `stats` | Object | ✅ | auto | system managed | See Embedded Objects |
| `isPublished` | Boolean | ✅ | true | — | Publication status |
| `createdAt` / `updatedAt` | Date | ✅ | auto | ISO Date | |

**Embedded Objects**

*ingredients* (array item)

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | ✅ | Ingredient name |
| `quantity` | Number | ✅ | Amount |
| `unit` | String | ✅ | Unit of measurement |

*steps* (array item)

| Field | Type | Required | Description |
|---|---|---|---|
| `order` | Number | ✅ | Step number |
| `title` | String | ❌ | Optional heading |
| `description` | String | ✅ | Instructions |
| `image` | String | ❌ | Optional step image |

*nutrition*

| Field | Type | Default |
|---|---|---|
| `calories` | Number | 0 |
| `protein` | Number | 0 |
| `carbohydrates` | Number | 0 |
| `fat` | Number | 0 |

*stats* (system-managed)

| Field | Type | Default |
|---|---|---|
| `averageRating` | Number | 0 |
| `ratingCount` | Number | 0 |
| `commentCount` | Number | 0 |
| `bookmarkCount` | Number | 0 |
| `viewCount` | Number | 0 |

**Virtual Fields:** `totalTime` (= preparationTime + cookingTime), `recipeUrl`, `estimatedReadingTime`.

**Difficulty Enum:** `EASY`, `MEDIUM`, `HARD`.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Recipes → One User |
| Category | N→1 | Many Recipes → One Category |
| Comment | 1→N | One Recipe → Many Comments |
| Rating | 1→N | One Recipe → Many Ratings |
| Bookmark | 1→N | One Recipe → Many Bookmarks |

**Indexes**
- Primary: `_id`
- Unique: `slug`
- Performance: `authorId`, `categoryId`, `difficulty`, `origin`, `stats.averageRating`, `stats.viewCount`, `createdAt`
- Compound: `categoryId + createdAt`, `categoryId + stats.averageRating`, `authorId + createdAt`

**Validation Rules**
- `title`: required, 5–120 chars, trimmed.
- `slug`: unique, lowercase, hyphen-separated, auto-generated from title (e.g. `classic-margherita-pizza`).
- `description`: required, 30–500 chars.
- `origin`: optional, max 60 chars.
- `difficulty`: must be one of the enum values.
- `preparationTime`: required, min 1 minute. `cookingTime`: min 0.
- `servings`: 1–100.
- `coverImage`: HTTPS, valid image format, uploaded via the app's image service.
- `gallery`: max 10 images, each a valid HTTPS image URL.
- `ingredients`: at least 1 required; names non-empty; quantity > 0.
- `steps`: at least 1 required; order sequential; descriptions non-empty.

**Business Rules**
- Every recipe belongs to exactly one user and exactly one category.
- Recipes may receive unlimited comments and ratings; a user may rate a recipe only once.
- Bookmarks are stored separately, not embedded.
- Statistics are managed exclusively by the system.
- Slugs are unique.
- Recipes are publicly visible only when `isPublished` is `true`.
- Only the recipe owner may edit or delete the recipe.
- Deleting a recipe should cascade (remove/archive) related ratings, bookmarks, and comments per the defined cascade strategy.

**Example Document**

```json
{
  "_id": "ObjectId",
  "authorId": "ObjectId",
  "categoryId": "ObjectId",
  "title": "Classic Margherita Pizza",
  "slug": "classic-margherita-pizza",
  "description": "A traditional Italian pizza made with fresh mozzarella, tomatoes, and basil.",
  "origin": "Italy",
  "difficulty": "MEDIUM",
  "preparationTime": 20,
  "cookingTime": 15,
  "servings": 4,
  "coverImage": "https://cdn.loghmeh.com/recipes/pizza-cover.jpg",
  "gallery": [
    "https://cdn.loghmeh.com/recipes/pizza-1.jpg",
    "https://cdn.loghmeh.com/recipes/pizza-2.jpg"
  ],
  "ingredients": [
    { "name": "Pizza Dough", "quantity": 1, "unit": "piece" },
    { "name": "Mozzarella", "quantity": 200, "unit": "g" }
  ],
  "steps": [
    { "order": 1, "title": "Prepare the Dough", "description": "Roll out the pizza dough.", "image": null },
    { "order": 2, "title": "Bake", "description": "Bake for 15 minutes at 250°C.", "image": null }
  ],
  "nutrition": { "calories": 320, "protein": 14, "carbohydrates": 35, "fat": 12 },
  "stats": { "averageRating": 4.8, "ratingCount": 153, "commentCount": 42, "bookmarkCount": 281, "viewCount": 12437 },
  "isPublished": true,
  "createdAt": "2026-07-15T10:30:00Z",
  "updatedAt": "2026-07-28T18:45:00Z"
}
```

---

### 3.3 Category

**Overview.** Stores recipe categories used for classification, discoverability, and filtering. Managed by administrators via the Admin application. Every recipe belongs to exactly one category.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `name` | String | ✅ | — | unique, 2–50 chars | Category name |
| `slug` | String | ✅ | auto | unique | URL slug |
| `description` | String | ❌ | "" | max 250 chars | Description |
| `image` | String | ❌ | null | HTTPS image URL | Category image |
| `icon` | String | ❌ | null | icon identifier | Category icon |
| `order` | Number | ✅ | 0 | ≥0 | Display order |
| `stats` | Object | ✅ | auto | system managed | See Embedded Objects |
| `isActive` | Boolean | ✅ | true | — | Visibility status |
| `createdAt` / `updatedAt` | Date | ✅ | auto | ISO Date | |

**Embedded Objects**

*stats* (managed automatically)

| Field | Type | Default |
|---|---|---|
| `recipeCount` | Number | 0 |
| `averageRating` | Number | 0 |

**Virtual Fields:** none documented.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| Recipe | 1→N | One Category → Many Recipes |

**Indexes**
- Primary: `_id`
- Unique: `name`, `slug`
- Performance: `order`, `stats.recipeCount`, `isActive`

**Validation Rules**
- `name`: required, unique, 2–50 chars.
- `slug`: unique, auto-generated, lowercase, hyphen-separated.
- `image`: must be a valid HTTPS image URL.

**Business Rules**
- Every recipe belongs to exactly one category.
- Category names are unique.
- Categories can be disabled (`isActive=false`) without deleting them.
- Statistics are managed by the system.
- Categories are managed only through the Admin application.

**Example Document**

```json
{
  "_id": "ObjectId",
  "name": "Main Course",
  "slug": "main-course",
  "description": "Main dishes served as the primary course.",
  "image": "https://cdn.loghmeh.com/categories/main-course.jpg",
  "icon": "chef-hat",
  "order": 1,
  "stats": { "recipeCount": 245, "averageRating": 4.7 },
  "isActive": true,
  "createdAt": "2026-07-10T09:00:00Z",
  "updatedAt": "2026-07-25T18:30:00Z"
}
```

---

### 3.4 Rating

**Overview.** Each document represents one user's rating of one recipe. A user may rate a recipe only once — updating a rating modifies the existing document. Ratings feed into both recipe average rating and (derived) user average rating.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `userId` | ObjectId | ✅ | — | existing User | User who rated |
| `recipeId` | ObjectId | ✅ | — | existing Recipe | Rated recipe |
| `value` | Number | ✅ | — | integer 1–5 | Rating value |
| `createdAt` / `updatedAt` | Date | ✅ | auto | ISO Date | |

**Embedded Objects / Virtual Fields:** none.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Ratings → One User |
| Recipe | N→1 | Many Ratings → One Recipe |

**Indexes**
- Primary: `_id`
- Compound unique: `userId + recipeId` (guarantees one rating per user per recipe)
- Performance: `recipeId`, `userId`, `value`

**Validation Rules**
- `value`: integer only, one of 1–5.
- `userId`: required, must reference an existing User.
- `recipeId`: required, must reference an existing Recipe.

**Business Rules**
- Only authenticated users may rate recipes; guests cannot.
- Users cannot rate their own recipes.
- Each user may rate a recipe only once; users may update their rating.
- Updating a rating recalculates the recipe's average rating, which may in turn change the author's average rating.
- Rating statistics are managed exclusively by the system.

**Example Document**

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "recipeId": "ObjectId",
  "value": 5,
  "createdAt": "2026-07-29T11:20:00Z",
  "updatedAt": "2026-07-29T11:20:00Z"
}
```

---

### 3.5 Bookmark

**Overview.** Stores recipes bookmarked by users; forms a many-to-many relationship between User and Recipe as an independent junction collection (not embedded in either).

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `userId` | ObjectId | ✅ | — | existing User | Bookmark owner |
| `recipeId` | ObjectId | ✅ | — | existing Recipe | Saved recipe |
| `createdAt` | Date | ✅ | auto | ISO Date | Bookmark date |

**Embedded Objects / Virtual Fields:** none.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Bookmarks → One User |
| Recipe | N→1 | Many Bookmarks → One Recipe |

**Indexes**
- Primary: `_id`
- Compound unique: `userId + recipeId`
- Performance: `userId`, `recipeId`, `createdAt`

**Validation Rules**
- User must exist; Recipe must exist.
- Duplicate bookmarks are not allowed.

**Business Rules**
- Users must be authenticated.
- A bookmark is unique per user+recipe pair.
- Users may remove bookmarks at any time.
- Bookmark count on Recipe is updated automatically.

**Example Document**

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "recipeId": "ObjectId",
  "createdAt": "2026-07-29T14:05:00Z"
}
```

---

### 3.6 Comment

**Overview.** Stores comments posted on recipes. Unlike a typical design, **replies are embedded inside the parent comment** rather than stored as separate top-level documents, because only the recipe owner or an admin may reply, and reply chains are intentionally limited to one level.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `recipeId` | ObjectId | ✅ | — | existing Recipe | Related recipe |
| `authorId` | ObjectId | ✅ | — | existing User | Comment author |
| `content` | String | ✅ | — | 1–1000 chars | Comment content |
| `reactions` | Object | ✅ | auto | system managed | See Embedded Objects |
| `replies` | Array\<Reply\> | ✅ | [] | embedded, one level only | Replies to the comment |
| `isEdited` | Boolean | ✅ | false | — | Whether edited |
| `editedAt` | Date | ❌ | null | ISO Date | Edit timestamp |
| `isDeleted` | Boolean | ✅ | false | — | Soft delete flag |
| `createdAt` / `updatedAt` | Date | ✅ | auto | ISO Date | |

**Embedded Objects**

*reactions* (aggregated counts)

| Field | Type | Default |
|---|---|---|
| `likeCount` | Number | 0 |
| `dislikeCount` | Number | 0 |

> Individual per-user like/dislike should be enforced via a separate mechanism (e.g. a `CommentReaction` collection) — `reactions` here stores only aggregate counts.

*Reply* (embedded array item — same shape as a comment, one level deep only)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | ✅ | Reply identifier |
| `authorId` | ObjectId | ✅ | Reply author |
| `content` | String | ✅ | Reply text |
| `reactions` | Object | ✅ | Like/dislike counts |
| `isEdited` | Boolean | ✅ | Edit flag |
| `editedAt` | Date | ❌ | Edit timestamp |
| `isDeleted` | Boolean | ✅ | Soft delete flag |
| `createdAt` / `updatedAt` | Date | ✅ | Timestamps |

Replies do **not** contain a nested `replies` array — only one reply level is supported.

**Virtual Fields:** none documented.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| Recipe | N→1 | Many Comments → One Recipe |
| User | N→1 | Many Comments → One User (author) |

Replies are embedded and therefore create no additional collection-level relationships.

**Indexes**
- Primary: `_id`
- Performance: `recipeId`, `authorId`, `createdAt`
- Compound: `recipeId + createdAt`, `recipeId + isDeleted`

**Validation Rules**
- `content`: required, trimmed, 1–1000 chars.
- `recipeId`: required, must reference an existing Recipe.
- `authorId`: required, must reference an existing User.
- `replies`: unlimited count (business rule); only one nesting level; every reply follows the Reply schema.

**Business Rules**
- Only authenticated users may create comments; guests may read.
- Every comment belongs to exactly one recipe and one user.
- Recipe owners and administrators may reply; ordinary users cannot.
- Replies cannot contain replies.
- Users may edit/delete their own comments; administrators may moderate any comment.
- Like/dislike counts update automatically.
- Deleted comments use soft deletion to preserve discussion history.

**Example Document**

```json
{
  "_id": "ObjectId",
  "recipeId": "ObjectId",
  "authorId": "ObjectId",
  "content": "This recipe turned out amazing!",
  "reactions": { "likeCount": 12, "dislikeCount": 1 },
  "replies": [
    {
      "_id": "ObjectId",
      "authorId": "ObjectId",
      "content": "Thank you! I'm glad you enjoyed it.",
      "reactions": { "likeCount": 5, "dislikeCount": 0 },
      "isEdited": false,
      "editedAt": null,
      "isDeleted": false,
      "createdAt": "2026-07-29T10:30:00Z",
      "updatedAt": "2026-07-29T10:30:00Z"
    }
  ],
  "isEdited": false,
  "editedAt": null,
  "isDeleted": false,
  "createdAt": "2026-07-29T09:45:00Z",
  "updatedAt": "2026-07-29T09:45:00Z"
}
```

---

### 3.7 Follow

**Overview.** Stores following relationships between users; each document represents exactly one directional relationship (Follower → Following). A user can follow many, and be followed by many.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `followerId` | ObjectId | ✅ | — | existing User | User who follows |
| `followingId` | ObjectId | ✅ | — | existing User | User being followed |
| `createdAt` | Date | ✅ | auto | ISO Date | Follow date |

**Embedded Objects / Virtual Fields:** none.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Follow docs → One User (as `followerId`) |
| User | N→1 | Many Follow docs → One User (as `followingId`) |

**Indexes**
- Primary: `_id`
- Compound unique: `followerId + followingId`
- Performance: `followerId`, `followingId`, `createdAt`

**Validation Rules**
- Both referenced users must exist.
- A user cannot follow themselves.
- Duplicate follow relationships are not allowed.

**Business Rules**
- Only authenticated users may follow others.
- Users cannot follow themselves; may unfollow at any time.
- Follower/following counts are updated automatically.
- The Home Feed uses follow relationships to surface recipes from followed users.

**Example Document**

```json
{
  "_id": "ObjectId",
  "followerId": "ObjectId",
  "followingId": "ObjectId",
  "createdAt": "2026-07-29T10:15:00Z"
}
```

---

### 3.8 Notification

**Overview.** Stores system-generated notifications, private to exactly one recipient user. Informs users about events on their account, recipes, comments, tickets, and platform announcements.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `userId` | ObjectId | ✅ | — | existing User | Recipient |
| `type` | Enum | ✅ | — | Notification Types | Notification type |
| `title` | String | ✅ | — | max 100 chars | Title |
| `message` | String | ✅ | — | max 500 chars | Message body |
| `actorId` | ObjectId | ❌ | null | existing User | User who triggered it |
| `recipeId` | ObjectId | ❌ | null | existing Recipe | Related recipe |
| `commentId` | ObjectId | ❌ | null | existing Comment | Related comment |
| `supportTicketId` | ObjectId | ❌ | null | existing SupportTicket | Related ticket |
| `isRead` | Boolean | ✅ | false | — | Read status |
| `readAt` | Date | ❌ | null | ISO Date | Read timestamp |
| `createdAt` | Date | ✅ | auto | ISO Date | Creation date |

**Embedded Objects / Virtual Fields:** none.

**Notification Types:** `RECIPE_RATED`, `RECIPE_COMMENTED`, `COMMENT_REPLIED`, `COMMENT_LIKED`, `COMMENT_DISLIKED`, `SYSTEM_ANNOUNCEMENT`, `SUPPORT_TICKET_UPDATED`. New types can be added without changing the schema.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Notifications → One User |
| Recipe | Optional ref | via `recipeId` |
| Comment | Optional ref | via `commentId` |
| SupportTicket | Optional ref | via `supportTicketId` |

**Indexes**
- Primary: `_id`
- Performance: `userId`, `isRead`, `type`, `createdAt`
- Compound: `userId + isRead`, `userId + createdAt`

**Validation Rules**
- `title`: required, max 100 chars. `message`: required, max 500 chars.
- `type`: must be one of the predefined notification types.

**Business Rules**
- Notifications are generated automatically; users cannot create them manually.
- Each notification belongs to exactly one user.
- Opening a notification marks it as read.
- Users may delete notifications; deletion is permanent.
- The unread badge shows whenever at least one unread notification exists, displaying only a red indicator — not a count.

**Example Document**

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "type": "RECIPE_COMMENTED",
  "title": "New Comment",
  "message": "Sarah commented on your recipe.",
  "actorId": "ObjectId",
  "recipeId": "ObjectId",
  "commentId": "ObjectId",
  "supportTicketId": null,
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-07-29T12:30:00Z"
}
```

---

### 3.9 SupportTicket

**Overview.** Stores support requests submitted by authenticated users; each ticket belongs to exactly one user. Ticket management (status changes, replies) happens in the separate Admin application.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `userId` | ObjectId | ✅ | — | existing User | Ticket owner |
| `subject` | String | ✅ | — | 5–100 chars | Subject |
| `message` | String | ✅ | — | 20–3000 chars | Initial message |
| `status` | Enum | ✅ | `OPEN` | Ticket Status | Current status |
| `adminReply` | String | ❌ | null | max 3000 chars | Latest admin reply |
| `repliedAt` | Date | ❌ | null | ISO Date | Reply timestamp |
| `closedAt` | Date | ❌ | null | ISO Date | Close timestamp |
| `createdAt` / `updatedAt` | Date | ✅ | auto | ISO Date | |

**Embedded Objects / Virtual Fields:** none.

**Ticket Status:** `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Support Tickets → One User |

**Indexes:** `userId`, `status`, `createdAt`.

**Validation Rules**
- `subject`: required, 5–100 chars.
- `message`: required, 20–3000 chars.

**Business Rules**
- Only authenticated users may submit tickets.
- Every ticket belongs to exactly one user.
- Users cannot edit tickets after submission.
- Ticket status is managed only by administrators.
- Admin replies generate notifications.
- Closed tickets become read-only.

**Example Document**

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "subject": "Problem uploading recipe images",
  "message": "I'm unable to upload images larger than 3 MB.",
  "status": "IN_PROGRESS",
  "adminReply": "We're currently investigating the issue.",
  "repliedAt": "2026-07-30T09:10:00Z",
  "closedAt": null,
  "createdAt": "2026-07-29T16:00:00Z",
  "updatedAt": "2026-07-30T09:10:00Z"
}
```

---

### 3.10 VerificationCode

**Overview.** Stores short-lived verification codes used for email verification and password reset. Codes expire automatically.

**Fields**

| Field | Type | Req. | Default | Validation | Description |
|---|---|---|---|---|---|
| `_id` | ObjectId | ✅ | auto | MongoDB ObjectId | Primary key |
| `email` | String | ✅ | — | valid email | Target email |
| `code` | String | ✅ | — | 6-digit numeric | Verification code |
| `purpose` | Enum | ✅ | — | Verification Purposes | Code purpose |
| `expiresAt` | Date | ✅ | — | — | Expiration date |
| `verifiedAt` | Date | ❌ | null | ISO Date | Verification timestamp |
| `createdAt` | Date | ✅ | auto | ISO Date | Creation date |

**Verification Purposes:** `EMAIL_VERIFICATION`, `PASSWORD_RESET`.

**Embedded Objects / Virtual Fields:** none.

**Relationships:** none direct (matched to User by `email`, not by ObjectId reference).

**Indexes:** `email`, `expiresAt`, `purpose`.

**Validation Rules**
- Codes consist of exactly 6 digits.
- Codes expire after a predefined period (recommended: 10 minutes); expired codes are invalid.
- Each new request replaces any previous active code for the same email + purpose.

**Business Rules**
- Codes are generated only by the system.
- Codes may be used only once.
- Expired codes cannot be reused.
- Verified codes become invalid immediately.

**Example Document**

```json
{
  "_id": "ObjectId",
  "email": "john@example.com",
  "code": "482913",
  "purpose": "EMAIL_VERIFICATION",
  "expiresAt": "2026-07-29T15:10:00Z",
  "verifiedAt": null,
  "createdAt": "2026-07-29T15:00:00Z"
}
```

---

### 3.11 Session *(Auth.js — fully managed, do not modify directly)*

**Overview.** Stores authenticated user sessions; entirely owned and maintained by Auth.js. Application code should treat this collection as read-only.

**Main Fields**

| Field | Type | Description |
|---|---|---|
| `sessionToken` | String | Unique session identifier |
| `userId` | ObjectId | Associated user |
| `expires` | Date | Session expiration |

Additional fields may be added automatically depending on the configured Auth.js session strategy.

**Relationships**

| Related Collection | Type | Description |
|---|---|---|
| User | N→1 | Many Sessions → One User |

**Business Rules**
- Sessions are created automatically after successful authentication.
- Sessions expire automatically; logging out removes the active session.
- Application code should not directly modify session documents (Auth.js only).

---

## 4. Population Strategy (Mongoose `populate()`)

| Collection | Populate |
|---|---|
| Recipe | `authorId`, `categoryId` |
| Comment | `authorId` |
| Bookmark | `recipeId` |
| Rating | none (usually aggregated) |
| Notification | `actorId`, `recipeId` |
| SupportTicket | none |

Avoid deep population chains to reduce query complexity.

---

## 5. Appendix — Shared Reference

**Statistics fields** are grouped under a `stats` object and are system-managed only: `recipeCount`, `averageRating`, `followerCount`, `followingCount`, `commentCount`, `bookmarkCount`, `ratingCount`, `viewCount`.

**Common defaults:** `isActive=true`, `isVerified=false`, `isDeleted=false`, `isEdited=false`, `isRead=false`; all counters `=0`.

**Recommended field limits:** username 3–30 · first/last name 2–50 · recipe title 5–120 · recipe description 20–2000 · ingredient name 1–100 · cooking step 1–1000 · comment/reply 1–1000 · support subject 5–100 · support message 20–3000 · notification title 100 · notification message 500.

**Enums**
- User Roles: `USER`, `ADMIN`
- User Titles: `USER`, `COOK`, `HEAD_CHEF`, `BARISTA`, `FOOD_BLOGGER`
- Recipe Difficulty: `EASY`, `MEDIUM`, `HARD`
- Ticket Status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- Notification Types: `RECIPE_RATED`, `RECIPE_COMMENTED`, `COMMENT_REPLIED`, `COMMENT_LIKED`, `COMMENT_DISLIKED`, `SYSTEM_ANNOUNCEMENT`, `SUPPORT_TICKET_UPDATED`

**Reserved / system-only fields** (never client-writable): `User.stats/createdAt/updatedAt` · `Recipe.stats/createdAt/updatedAt` · `Notification.isRead/readAt`.

**Recommended Mongoose models:** `User.ts`, `Recipe.ts`, `Category.ts`, `Comment.ts`, `Rating.ts`, `Bookmark.ts`, `Follow.ts`, `Notification.ts`, `SupportTicket.ts`, `VerificationCode.ts`.

**Recommended Zod schemas:** `user.schema.ts`, `recipe.schema.ts`, `category.schema.ts`, `comment.schema.ts`, `rating.schema.ts`, `bookmark.schema.ts`, `follow.schema.ts`, `notification.schema.ts`, `support-ticket.schema.ts`.

**Potential future collections:** Report, Badge, Achievement, UserActivity, RecipeHistory, AnalyticsEvent, SearchHistory, NotificationPreference, Media, Tag, RecipeView, Device.

---

*Reorganized from the full Loghmeh database documentation — Document Version 1.0, MongoDB + Mongoose, Status: Production Ready, Last Updated July 2026.*
