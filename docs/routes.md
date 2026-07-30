# Routes Documentation

> **Loghmeh Application** - Complete Routes & Pages Reference

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Quick Reference](#2-quick-reference)
- [3. Permission Matrix](#3-permission-matrix)
- [4. Authentication Routes](#4-authentication-routes)
- [5. Recipe Routes](#5-recipe-routes)
- [6. Category & Search Routes](#6-category--search-routes)
- [7. Profile & Social Routes](#7-profile--social-routes)
- [8. System Routes](#8-system-routes)
- [9. Error Routes](#9-error-routes)
- [10. Technical Reference](#10-technical-reference)

---

## 1. Overview

### 1.1 Purpose

This document defines all application routes, pages, their paths, access levels, and relationships for the Loghmeh application. It serves as the definitive reference for route implementation, navigation flows, and access control.

### 1.2 Technology Stack

| Technology  | Purpose                         |
| ----------- | ------------------------------- |
| Next.js 14+ | App Router (file-based routing) |
| Auth.js     | Authentication & session mgmt   |
| TypeScript  | Type-safe routing constants     |
| React       | Page components & UI            |

### 1.3 Route Categories

| Category       | Route Count | Description                        |
| -------------- | ----------- | ---------------------------------- |
| Authentication | 7           | Sign in, register, password mgmt   |
| Recipes        | 5           | Browse, create, edit, view recipes |
| Categories     | 2           | Category listing and filtering     |
| Search         | 1           | Recipe search functionality        |
| Profile        | 4           | User profiles and social features  |
| Community      | 1           | Browse all users                   |
| System         | 3           | Bookmarks, notifications, support  |
| Error          | 1           | 404 error handling                 |
| **Total**      | **24**      | All application routes             |

---

## 2. Quick Reference

### 2.1 All Routes Summary

| #   | Route Name      | Path                             | Auth | Role Access | Feature   | Method |
| --- | --------------- | -------------------------------- | :--: | ----------- | --------- | :----: |
| 1   | Home            | `/`                              |  No  | Guest, User | Home Feed |  GET   |
| 2   | All Recipes     | `/recipes`                       |  No  | Guest, User | Recipes   |  GET   |
| 3   | Recipe Detail   | `/recipes/[slug]`                |  No  | Guest, User | Recipes   |  GET   |
| 4   | New Recipe      | `/recipes/new`                   | Yes  | User        | Recipes   |  GET   |
| 5   | Edit Recipe     | `/recipes/[slug]/edit`           | Yes  | Owner       | Recipes   |  GET   |
| 6   | All Categories  | `/categories`                    |  No  | Guest, User | Categories|  GET   |
| 7   | Category Detail | `/categories/[slug]`             |  No  | Guest, User | Categories|  GET   |
| 8   | Search          | `/search`                        |  No  | Guest, User | Search    |  GET   |
| 9   | Login           | `/login`                         |  No  | Guest       | Auth      |  GET   |
| 10  | Register        | `/register`                      |  No  | Guest       | Auth      |  GET   |
| 11  | Verify Email    | `/verify-email`                  |  No  | Guest       | Auth      |  GET   |
| 12  | Forgot Password | `/forgot-password`               |  No  | Guest       | Auth      |  GET   |
| 13  | Verify Reset    | `/verify-reset-code`             |  No  | Guest       | Auth      |  GET   |
| 14  | Reset Password  | `/reset-password`                |  No  | Guest       | Auth      |  GET   |
| 15  | Change Password | `/change-password`               | Yes  | User        | Auth      |  GET   |
| 16  | My Profile      | `/profile`                       | Yes  | User        | Profile   |  GET   |
| 17  | User Profile    | `/profile/[username]`            |  No  | Guest, User | Profile   |  GET   |
| 18  | Followers       | `/profile/[username]/followers`  | Yes  | Owner       | Social    |  GET   |
| 19  | Followings      | `/profile/[username]/followings` | Yes  | Owner       | Social    |  GET   |
| 20  | Community       | `/community`                     |  No  | Guest, User | Community |  GET   |
| 21  | Bookmarks       | `/bookmarks`                     | Yes  | User        | System    |  GET   |
| 22  | Notifications   | `/notifications`                 | Yes  | User        | System    |  GET   |
| 23  | Support         | `/support`                       | No\* | User        | System    |  GET   |
| 24  | Not Found       | `*`                              |  No  | All         | Error     |  GET   |

\* Support page viewable by guests but submission requires authentication.

### 2.2 Routes by Feature

**Authentication (7)**

- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/verify-reset-code`, `/reset-password`, `/change-password`

**Recipes (5)**

- `/` (Home), `/recipes`, `/recipes/[slug]`, `/recipes/new`, `/recipes/[slug]/edit`

**Categories (2)**

- `/categories`, `/categories/[slug]`

**Search (1)**

- `/search`

**Profile & Social (4)**

- `/profile`, `/profile/[username]`, `/profile/[username]/followers`, `/profile/[username]/followings`

**Community (1)**

- `/community`

**System (3)**

- `/bookmarks`, `/notifications`, `/support`

**Error (1)**

- 404 Not Found (dynamic)

### 2.3 Routes by Access Level

**Public (No Auth Required) - 14 routes**

- Home, All Recipes, Recipe Detail, All Categories, Category Detail, Search, Community, Login, Register, Verify Email, Forgot Password flow (3), User Profile, Support (view only), 404

**Protected (Auth Required) - 8 routes**

- New Recipe, Change Password, My Profile, Followers/Followings (own only), Bookmarks, Notifications, Support (submit)

**Owner Only - 2 routes**

- Edit Recipe (recipe owner), Followers/Followings pages (profile owner)

---

## 3. Permission Matrix

### 3.1 By Route and Role

| Route                             | Guest | User | Recipe Owner | Admin\* |
| --------------------------------- | :---: | :--: | :----------: | :-----: |
| `/`                               |  ✅   |  ✅  |      ✅      |   ✅    |
| `/recipes`                        |  ✅   |  ✅  |      ✅      |   ✅    |
| `/recipes/[slug]`                 |  ✅   |  ✅  |      ✅      |   ✅    |
| `/recipes/new`                    |  ❌   |  ✅  |      ✅      |   ✅    |
| `/recipes/[slug]/edit`            |  ❌   |  ❌  |      ✅      |   ✅    |
| `/categories`                     |  ✅   |  ✅  |      ✅      |   ✅    |
| `/categories/[slug]`              |  ✅   |  ✅  |      ✅      |   ✅    |
| `/search`                         |  ✅   |  ✅  |      ✅      |   ✅    |
| `/community`                      |  ✅   |  ✅  |      ✅      |   ✅    |
| `/login`                          |  ✅   | ❌†  |     ❌†      |   ❌†   |
| `/register`                       |  ✅   | ❌†  |     ❌†      |   ❌†   |
| `/verify-email`                   |  ✅   | ❌†  |     ❌†      |   ❌†   |
| `/forgot-password`                |  ✅   | ❌†  |     ❌†      |   ❌†   |
| `/verify-reset-code`              |  ✅   | ❌†  |     ❌†      |   ❌†   |
| `/reset-password`                 |  ✅   | ❌†  |     ❌†      |   ❌†   |
| `/change-password`                |  ❌   |  ✅  |      ✅      |   ✅    |
| `/profile`                        |  ❌   |  ✅  |      ✅      |   ✅    |
| `/profile/[username]`             |  ✅   |  ✅  |      ✅      |   ✅    |
| `/profile/[username]/followers`   |  ❌   | ✅‡  |     ✅‡      |   ✅    |
| `/profile/[username]/followings`  |  ❌   | ✅‡  |     ✅‡      |   ✅    |
| `/bookmarks`                      |  ❌   |  ✅  |      ✅      |   ✅    |
| `/notifications`                  |  ❌   |  ✅  |      ✅      |   ✅    |
| `/support`                        |  ✅§  |  ✅  |      ✅      |   ✅    |
| `404`                             |  ✅   |  ✅  |      ✅      |   ✅    |

\* Admin access managed in separate application  
† Redirects to home if authenticated  
‡ Own profile only  
§ View only; submission requires auth

### 3.2 By Feature Area

| Feature                |    Guest    |      User       |       Owner        | Admin\* |
| ---------------------- | :---------: | :-------------: | :----------------: | :-----: |
| **Browse & Discovery** |    Full     |      Full       |        Full        |  Full   |
| **Recipe Creation**    |     ❌      |       ✅        |         ✅         |   ✅    |
| **Recipe Editing**     |     ❌      |       ❌        |      ✅ (own)      |   ✅    |
| **Comments**           |    View     |   Post/React    | Reply (own recipe) |  Full   |
| **Ratings**            |    View     |     Submit      |  Submit (not own)  |  Full   |
| **Bookmarks**          |     ❌      |       ✅        |         ✅         |   ✅    |
| **Following**          | View counts | Follow/Unfollow |        Full        |  Full   |
| **Profile Edit**       |     ❌      |    ✅ (own)     |      ✅ (own)      |   ✅    |
| **Notifications**      |     ❌      |       ✅        |         ✅         |   ✅    |
| **Support**            |    View     |     Submit      |       Submit       | Manage  |

\* Admin functionality in separate application

---

## 4. Authentication Routes

### 4.1 Overview

Authentication routes handle user account lifecycle: registration, email verification, sign in/out, and password management.

**Flow:** Register → Verify Email → Login → (Change Password if needed)  
**Layout:** All auth routes use `AuthLayout` (centered, minimal)  
**Redirect:** Authenticated users redirected to home from guest-only auth pages

### 4.2 Login

**Path:** `/login`  
**Auth Required:** No (redirects to `/` if authenticated)  
**Role Access:** Guest  
**HTTP Method:** GET  
**Layout:** AuthLayout

#### Purpose

User sign-in page. Users authenticate using email/username and password.

#### Entry Points

- Header "Sign In" button
- Registration success redirect
- Password reset success redirect
- Protected route authentication prompt

#### Exit Points

- Success → Home page (`/`)
- "Forgot Password?" → `/forgot-password`
- "Create Account" → `/register`

#### Components

- `LoginForm` - Authentication form
- `PasswordInput` - Secure password field
- `AuthLayout` - Auth pages layout

#### Validation & Error States

| Field          | Validation | Error              | Resolution               |
| -------------- | ---------- | ------------------ | ------------------------ |
| email/username | Required   | User not found     | Check email/username     |
| password       | Required   | Wrong password     | Check password or reset  |
| -              | -          | Email not verified | Redirect to verify email |
| -              | -          | Session expired    | Re-authenticate          |

---

### 4.3 Register

**Path:** `/register`  
**Auth Required:** No (redirects if authenticated)  
**Role Access:** Guest  
**HTTP Method:** GET  
**Layout:** AuthLayout

#### Purpose

New user registration page. Creates account and sends verification code to email.

#### Entry Points

- Header "Sign Up" button
- Login page "Create Account" link

#### Exit Points

- Success → `/verify-email`
- "Already have account?" → `/login`

#### Components

- `RegisterForm` - Registration form
- `PasswordInput` - Secure password field
- `AuthLayout` - Auth pages layout

#### Validation & Error States

| Field    | Validation                                              | Error          | Resolution                     |
| -------- | ------------------------------------------------------- | -------------- | ------------------------------ |
| username | Required, 3-30 chars, unique, alphanumeric + underscore | Username taken | Choose different username      |
| email    | Required, valid format, unique                          | Email taken    | Use different email or sign in |
| email    | -                                                       | Invalid format | Enter valid email              |
| password | Required, min 8 chars                                   | Weak password  | Enter stronger password        |

---

### 4.4 Verify Email

**Path:** `/verify-email`  
**Auth Required:** No (registration flow)  
**Role Access:** Guest  
**HTTP Method:** GET  
**Layout:** AuthLayout

#### Purpose

Email verification with 6-digit OTP sent during registration. Code expires after 10 minutes.

#### Entry Points

- Registration success redirect

#### Exit Points

- Success → Home page (auto signed in)
- Code expired → Resend OTP

#### Components

- `EmailVerificationForm` - Verification interface
- `OTPInput` - 6-digit code input
- `CountdownTimer` - Expiration timer
- `ResendCodeButton` - Resend code action

#### Validation & Error States

| Field | Validation                  | Error       | Resolution    |
| ----- | --------------------------- | ----------- | ------------- |
| code  | Required, numeric, 6 digits | Invalid OTP | Re-enter code |
| code  | -                           | OTP expired | Resend OTP    |

---

### 4.5 Password Reset Flow

Three-step password reset process for users who forgot their password.

#### Step 1: Forgot Password

**Path:** `/forgot-password`  
**Purpose:** Request password reset  
**Entry:** Login page "Forgot Password?" link  
**Exit:** `/verify-reset-code`

**Validation:**

- Email: Required, valid format

#### Step 2: Verify Reset Code

**Path:** `/verify-reset-code`  
**Purpose:** Verify identity with OTP  
**Entry:** Forgot password form submission  
**Exit:** `/reset-password`

**Validation:**

- Code: Required, numeric, 6 digits

**Error States:**

- Invalid OTP → Re-enter code
- OTP expired → Resend OTP

#### Step 3: Reset Password

**Path:** `/reset-password`  
**Purpose:** Set new password  
**Entry:** Successful OTP verification  
**Exit:** `/login` (redirect)

**Validation:**

- New password: Required, min 8 characters

**Components (shared across flow):**

- `ForgotPasswordForm` - Email input
- `OTPInput` - 6-digit code
- `ResetPasswordForm` - New password
- `PasswordInput` - Secure field
- `CountdownTimer` - Code expiration
- `ResendCodeButton` - Resend action

---

### 4.6 Change Password

**Path:** `/change-password`  
**Auth Required:** Yes  
**Role Access:** User  
**HTTP Method:** GET  
**Layout:** Default App Layout

#### Purpose

Password change for authenticated users. Requires current password and email OTP verification.

#### Entry Points

- My Profile page "Change Password" action

#### Exit Points

- Success → `/profile` (redirect)

#### Components

- `ChangePasswordForm` - Password update form
- `PasswordInput` - Secure field
- `OTPInput` - Verification code
- `CountdownTimer` - Code expiration
- `ResendCodeButton` - Resend action

#### Validation & Error States

| Field             | Validation                                    | Error                    | Resolution        |
| ----------------- | --------------------------------------------- | ------------------------ | ----------------- |
| current password  | Required                                      | Invalid current password | Re-enter password |
| new password      | Required, min 8 chars, different from current | Weak password            | Stronger password |
| verification code | Required, numeric, 6 digits                   | Invalid OTP              | Re-enter code     |
| verification code | -                                             | OTP expired              | Resend OTP        |

---

## 5. Recipe Routes

### 5.1 Overview

Recipe routes enable recipe discovery, creation, management, and interaction.

**Guest Access:** Browse, view, search recipes  
**User Access:** All guest features + create, edit (own), bookmark, rate, comment  
**Layout:** Default App Layout (with header/footer)

### 5.2 Home Feed

**Path:** `/`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

#### Purpose

Main discovery page with curated sections. Authenticated users see additional "Following Feed" section.

#### Entry Points

- Application root URL
- Logo click in header
- Sign in/out redirects

#### Exit Points

- Category card → `/categories/[slug]`
- Recipe card → `/recipes/[slug]`
- User card → `/profile/[username]`
- "See More" categories → `/categories`
- "See More" recipes → `/recipes`
- "See More" chefs → `/community`

#### Feed Sections

| Section              | Visibility  | Description                                |
| -------------------- | :---------: | ------------------------------------------ |
| Popular Categories   | Guest, User | Featured categories carousel               |
| Popular Recipes      | Guest, User | Top recipes carousel                       |
| Following Feed       |  User Only  | Recipes from followed users (newest first) |
| Popular Chefs        | Guest, User | Top-rated creators carousel                |
| Popular Light Meals  | Guest, User | Top light meal recipes                     |
| Popular Main Courses | Guest, User | Top main course recipes                    |
| Popular Desserts     | Guest, User | Top dessert recipes                        |

#### Components

- `HomeFeed` - Feed container
- `SectionHeader` - Section titles
- `HorizontalCarousel` - Scrollable content
- `RecipeCard` - Recipe preview
- `CategoryCard` - Category preview
- `UserCard` - User preview
- `SeeMoreButton` - Navigation to full page

#### Empty States

- Following Feed: "Follow your favorite cooks to see their latest recipes here."
- Popular Categories: "No categories available."
- Popular Recipes: "No recipes available."
- Popular Chefs: "No creators available."

---

### 5.3 All Recipes

**Path:** `/recipes`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

#### Purpose

Browse all published recipes with filtering and sorting.

#### Entry Points

- Home page "See More" on recipe sections
- Header navigation link
- Direct URL navigation

#### Exit Points

- Recipe card → `/recipes/[slug]`

#### Filters & Sorting (stored in URL query params)

Filter and sort values are persisted in the URL so links are shareable and browser back/forward restores state.

**Example:** `/recipes?category=desserts&difficulty=EASY&ingredient=flour&prepTime=30&cuisine=iranian&sort=newest`

| Query Param  | Type   | Multiple | Description                          |
| ------------ | ------ | :------: | ------------------------------------ |
| `category`   | String |   Yes    | Category slug(s)                     |
| `ingredient` | String |   Yes    | Main ingredient                      |
| `difficulty` | Enum   |   Yes    | `EASY`, `MEDIUM`, `HARD`             |
| `prepTime`   | Number |    No    | Max preparation time (minutes)       |
| `cuisine`    | String |   Yes    | Cuisine type                         |
| `sort`       | Enum   |    No    | Sort option (single selection)       |

**Available Sorting** (`sort` values):

| Value          | Description                    |
| -------------- | ------------------------------ |
| `popular`      | Most Popular (by view count)   |
| `highestRated` | Highest Rated (avg rating)     |
| `newest`       | Newest (by creation date)      |
| `oldest`       | Oldest (by creation date)      |

#### Components

- `RecipeGrid` - Grid layout
- `RecipeCard` - Recipe preview
- `RecipeSearchBar` - Search input
- `RecipeFilters` - Filter controls (sync to URL)
- `RecipeSorting` - Sort controls (sync to URL)
- `EmptyRecipeState` - No results display

#### Empty State

"No recipes found." — Displayed when filters/search return no results.

---

### 5.4 Recipe Detail

**Path:** `/recipes/[slug]`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

**Dynamic Parameter:** `slug` (String) - URL-friendly unique recipe identifier

#### Purpose

Full recipe detail page with all information, ingredients, steps, and community features.

#### Entry Points

- Recipe card (any context)
- Search suggestion click
- Direct URL navigation

#### Exit Points

- Author username → `/profile/[username]`
- Category link → `/categories/[categorySlug]`
- Edit button (owner only) → `/recipes/[slug]/edit`
- Comment reply → In-page

#### Recipe Detail Sections

| Section           | Content                                  |
| ----------------- | ---------------------------------------- |
| Header            | Cover image, title, author, rating       |
| Information       | Prep time, servings, difficulty, cuisine |
| Actions           | Bookmark, rate, share                    |
| Ingredients       | Ingredient list with quantities          |
| Preparation Steps | Step-by-step instructions                |
| Comments          | User comments and replies                |

#### Components

- `RecipeHeader` - Title and metadata
- `RecipeInformation` - Details display
- `RecipeActions` - Action buttons
- `RecipeAuthor` - Author info
- `IngredientList` / `IngredientItem` - Ingredients
- `PreparationSteps` / `StepItem` - Cooking steps
- `RecipeRating` - Rating display/submit
- `RecipeBookmarkButton` - Bookmark toggle
- `CommentSection` / `CommentList` / `CommentCard` / `CommentForm` - Comments

#### Error States

- Recipe not found → 404 page
- Unpublished recipe (draft) → 404 page

---

### 5.5 New Recipe

**Path:** `/recipes/new`  
**Auth Required:** Yes  
**Role Access:** User  
**HTTP Method:** GET

#### Purpose

Create and publish new recipe. Can publish immediately or save as draft.

#### Entry Points

- Header "Add Recipe" button
- Profile page "Create Recipe" button

#### Exit Points

- Published → `/recipes/[slug]`
- Saved as draft → `/profile` (user's own profile)

#### Recipe Form Validation

**Required Fields:**
| Field | Validation |
|-------|------------|
| Title | Required, generates unique slug |
| Cover Image | Required, image file (JPG/PNG/WebP), max 5MB |
| Category | Required |
| Difficulty | Required (EASY, MEDIUM, HARD) |
| Preparation Time | Required, > 0 minutes |
| Servings | Required, > 0 |
| Ingredients | At least 1 required (name, quantity, unit) |
| Steps | At least 1 required (max 1000 chars per step) |

**Optional Fields:**

- Description
- Cuisine

#### Components

- `RecipeForm` - Creation/edit form
- `RecipeImageUploader` - Cover image upload
- `AuthGuard` - Authentication check

#### Error States

- Not authenticated → Redirect to login
- Validation error → Field-level errors
- Upload failed → Retry image upload

---

### 5.6 Edit Recipe

**Path:** `/recipes/[slug]/edit`  
**Auth Required:** Yes (Recipe Owner only)  
**Role Access:** Recipe Owner  
**HTTP Method:** GET

**Dynamic Parameter:** `slug` (String) - Recipe identifier

#### Purpose

Edit existing recipe. Only recipe owner can access. Form pre-filled with current data.

#### Entry Points

- Recipe detail page "Edit" button (owner only)
- Own profile recipes section "Edit" button

#### Exit Points

- Save → `/recipes/[slug]` (updated recipe)
- Cancel → `/recipes/[slug]`

#### Components

- `RecipeForm` - Pre-filled form
- `RecipeImageUploader` - Replace cover image
- `AuthGuard` - Auth + ownership check

#### Validation

Same as New Recipe (see section 5.5)

#### Error States

- Not authenticated → Redirect to login
- Not recipe owner → Redirect to recipe detail (403)
- Recipe not found → 404 page

---

## 6. Category & Search Routes

### 6.1 All Categories

**Path:** `/categories`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

#### Purpose

Browse all available recipe categories. Categories displayed alphabetically by default.

#### Entry Points

- Home page "See More" on categories
- Header navigation link
- Direct URL navigation

#### Exit Points

- Category card → `/categories/[slug]`

#### Category Card Display

- Cover Image
- Name
- Recipe Count (published recipes)

#### Components

- `CategoriesGrid` - Grid layout
- `CategoryCard` - Category preview

#### Empty State

"No categories available."

---

### 6.2 Category Detail

**Path:** `/categories/[slug]`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

**Dynamic Parameter:** `slug` (String) - Category identifier

#### Purpose

View all recipes within specific category with filtering and sorting.

#### Entry Points

- Category card from `/categories` or Home
- Recipe detail category link
- Direct URL navigation

#### Exit Points

- Recipe card → `/recipes/[slug]`

#### Filters & Sorting (stored in URL query params)

Filter and sort values are persisted in the URL (same pattern as `/recipes`). Category is implied by the path, so `category` is not used here.

**Example:** `/categories/desserts?difficulty=EASY&ingredient=flour&prepTime=30&cuisine=iranian&sort=highestRated`

| Query Param  | Type   | Multiple | Description                    |
| ------------ | ------ | :------: | ------------------------------ |
| `ingredient` | String |   Yes    | Main ingredient                |
| `difficulty` | Enum   |   Yes    | `EASY`, `MEDIUM`, `HARD`       |
| `prepTime`   | Number |    No    | Max preparation time (minutes) |
| `cuisine`    | String |   Yes    | Cuisine type                   |
| `sort`       | Enum   |    No    | Sort option (single selection) |

**Available Sorting** (`sort` values):

| Value          | Description                  |
| -------------- | ---------------------------- |
| `popular`      | Most Viewed (view count)     |
| `highestRated` | Highest Rated (avg rating)   |
| `newest`       | Newest (creation date)       |
| `oldest`       | Oldest (creation date)       |

#### Components

- `CategoryHeader` - Title and info
- `CategoryRecipeGrid` - Recipe grid
- `RecipeCard` - Recipe preview
- `FilterBar` - Filter controls (sync to URL)
- `SortDropdown` - Sort selection (sync to URL)
- `CategoryEmptyState` - No recipes
- `CategoryLoading` - Loading state

#### Empty State

"No recipes are available in this category yet."

#### Error States

- Category not found → 404 page

---

### 6.3 Search Results

**Path:** `/search?q=...`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

**Query Parameter:** `q` (String, optional) - Search query (max 100 characters)

#### Purpose

Full search results page. Search performed on recipe titles. Results ordered by relevance.

#### Entry Points

- Header search bar "View All Results"
- Enter key in search bar
- Direct URL (e.g., `/search?q=pasta`)

#### Exit Points

- Recipe card → `/recipes/[slug]`
- Modify query → In-page search input

#### Search Behavior

| Aspect           | Behavior                  |
| ---------------- | ------------------------- |
| Trigger          | After 3+ characters typed |
| Scope            | Recipe title only (v1.0)  |
| Case Sensitivity | Case-insensitive          |
| Persian Support  | Full Persian text support |
| Draft Recipes    | Excluded from results     |
| Suggestions      | Max 5 in dropdown         |
| Results Order    | By relevance (default)    |

#### Components

- `SearchInput` - Text input field
- `ClearSearchButton` - Clear query
- `SearchResultsGrid` - Grid layout
- `SearchResultCard` - Result preview
- `SearchEmptyState` - No results
- `SearchLoading` - Loading state

#### Empty State

"No recipes were found for your search."

---

## 7. Profile & Social Routes

### 7.1 Overview

Profile routes enable users to manage their identity, showcase recipes, and build social connections.

**Guest Access:** View public profiles, browse community  
**User Access:** Manage own profile (including settings actions), follow users, view own followers/followings  
**Profile Editing:** Inline on profile page (no separate edit or settings route)

### 7.2 My Profile

**Path:** `/profile`  
**Auth Required:** Yes  
**Role Access:** User  
**HTTP Method:** GET

#### Purpose

Current user's profile page with inline editing and account settings. Shows personal info, stats, own recipes (published and drafts), privacy controls, and social links.

#### Entry Points

- Header profile avatar/name click
- Draft save redirect from new recipe
- Direct URL navigation

#### Exit Points

- Followers count → `/profile/[username]/followers`
- Followings count → `/profile/[username]/followings`
- Recipe card → `/recipes/[slug]`
- Edit recipe → `/recipes/[slug]/edit`
- Create recipe → `/recipes/new`
- Change password → `/change-password`
- Logout → Home page (guest state)

#### Profile Sections

| Section      | Content                                              |
| ------------ | ---------------------------------------------------- |
| Header       | Avatar, username, full name, title                   |
| Statistics   | Recipe count, followers, followings, rating          |
| Bio          | User biography                                       |
| Social Links | Instagram, Telegram, X (Twitter)                     |
| Actions      | Edit Profile (inline), Change Password, Logout       |
| Privacy      | Bio visibility, social links visibility              |
| Recipes      | Own recipes grid (published + drafts; edit/delete)   |

#### Components

- `ProfileHeader` - Top section
- `ProfileAvatar` - Avatar display
- `ProfileInformation` - User details
- `ProfileStatistics` - Counts
- `ProfileSocialLinks` - Social media
- `ProfileActions` - Action buttons
- `EditProfileForm` - Inline editing form
- `AvatarUploader` - Upload/replace/remove
- `PrivacySettings` - Privacy controls
- `LogoutButton` - Sign out action
- `RecipeGrid` - User's recipes
- `DeleteConfirmModal` - Recipe deletion confirmation
- `EmptyRecipeState` - No recipes

#### Editable Fields

| Field       | Validation                         |
| ----------- | ---------------------------------- |
| Full Name   | Optional                           |
| Bio         | Optional, max 500 characters       |
| Avatar      | Image only (JPG/PNG/WebP), max 5MB |
| Instagram   | Optional, valid username or URL    |
| Telegram    | Optional, valid username or URL    |
| X (Twitter) | Optional, valid username or URL    |

#### Empty State (Recipes)

"You haven't created any recipes yet."

---

### 7.3 User Profile

**Path:** `/profile/[username]`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

**Dynamic Parameter:** `username` (String) - Unique username

#### Purpose

Public profile page of another user. Authenticated users can follow/unfollow from this page. Shows published recipes only.

#### Entry Points

- Recipe card author click
- Comment username click
- Followers/Followings list click
- Community page user card click
- Direct URL navigation

#### Exit Points

- Recipe card → `/recipes/[slug]`
- Follow/Unfollow → In-page action
- Followers count → `/profile/[username]/followers` (own profile only)
- Followings count → `/profile/[username]/followings` (own profile only)

#### Profile Sections

| Section      | Content                                    |
| ------------ | ------------------------------------------ |
| Header       | Avatar, username, full name, title         |
| Statistics   | Recipe count, followers, followings, rating|
| Bio          | User biography (if visible)                |
| Social Links | Instagram, Telegram, X (if visible)        |
| Actions      | Follow/Unfollow button (auth users only)   |
| Recipes      | Published recipes grid                     |

#### Components

- `ProfileHeader` - Top section
- `ProfileAvatar` - Avatar
- `ProfileInformation` - Details
- `ProfileStatistics` - Counts
- `ProfileSocialLinks` - Social media
- `ProfileActions` - Follow/Unfollow
- `FollowButton` - Toggle action
- `RecipeGrid` - Recipes
- `EmptyRecipeState` - No recipes

#### Error States

- User not found → 404 page

---

### 7.4 Followers

**Path:** `/profile/[username]/followers`  
**Auth Required:** Yes (Own profile only)  
**Role Access:** User (Own)  
**HTTP Method:** GET

**Dynamic Parameter:** `username` (String) - Profile owner username

#### Purpose

View list of users who follow the profile owner. Only accessible by profile owner.

#### Entry Points

- My Profile page followers count click
- Direct URL navigation

#### Exit Points

- User card → `/profile/[username]`

#### List Display

| Element       | Description               |
| ------------- | ------------------------- |
| Avatar        | User profile picture      |
| Username      | User's username           |
| Title         | User's title (Chef, etc.) |
| Rating        | User's average rating     |
| Recipe Count  | Published recipes count   |
| Follow Button | Follow/unfollow action    |

#### Components

- `FollowersList` - Followers display
- `UserCard` - User preview
- `FollowButton` - Toggle action

#### Empty State

"You don't have any followers yet."

#### Error States

- Not profile owner → Redirect with 403
- User not found → 404 page

---

### 7.5 Followings

**Path:** `/profile/[username]/followings`  
**Auth Required:** Yes (Own profile only)  
**Role Access:** User (Own)  
**HTTP Method:** GET

**Dynamic Parameter:** `username` (String) - Profile owner username

#### Purpose

View list of users that the profile owner follows. Only accessible by profile owner.

#### Entry Points

- My Profile page followings count click
- Direct URL navigation

#### Exit Points

- User card → `/profile/[username]`

#### List Display

Same as Followers (see section 7.4)

#### Components

- `FollowingsList` - Followings display
- `UserCard` - User preview
- `FollowButton` - Toggle action

#### Empty State

"You're not following anyone yet."

#### Error States

- Not profile owner → Redirect with 403
- User not found → 404 page

---

### 7.6 Community

**Path:** `/community`  
**Auth Required:** No  
**Role Access:** Guest, User  
**HTTP Method:** GET

#### Purpose

Browse all users registered in the application. Serves as the people directory for discovering cooks and creators.

#### Entry Points

- Header navigation "Community" link
- Home page "See More" on Popular Chefs
- Direct URL navigation

#### Exit Points

- User card → `/profile/[username]`
- Follow/Unfollow → In-page action (authenticated users)

#### List Display

| Element       | Description               |
| ------------- | ------------------------- |
| Avatar        | User profile picture      |
| Username      | User's username           |
| Title         | User's title (Chef, etc.) |
| Rating        | User's average rating     |
| Recipe Count  | Published recipes count   |
| Follow Button | Follow/unfollow (auth)    |

#### Components

- `CommunityList` - Users directory
- `UserCard` - User preview
- `FollowButton` - Toggle action (auth users)

#### Empty State

"No users found."

---

## 8. System Routes

### 8.1 Overview

System routes provide user-specific features: bookmarks, notifications, and support.

**Auth Required:** Bookmarks and notifications require authentication; support is viewable by guests  
**Privacy:** Bookmarks and notifications are private to each user

### 8.2 Bookmarks

**Path:** `/bookmarks`  
**Auth Required:** Yes  
**Role Access:** User  
**HTTP Method:** GET

#### Purpose

View all recipes bookmarked by current user. Bookmarks are private and visible only to owner.

#### Entry Points

- Header "Bookmarks" navigation link
- Direct URL navigation

#### Exit Points

- Recipe card → `/recipes/[slug]`
- Remove bookmark → In-page action

#### Components

- `BookmarksGrid` - Grid layout
- `BookmarkButton` - Bookmark toggle
- `BookmarkCard` - Recipe preview
- `BookmarkEmptyState` - No bookmarks
- `RecipeCard` - Recipe preview

#### Empty State

"You haven't bookmarked any recipes yet."

---

### 8.3 Notifications

**Path:** `/notifications`  
**Auth Required:** Yes  
**Role Access:** User  
**HTTP Method:** GET

#### Purpose

View all activity notifications. Notifications generated automatically for specific events.

#### Notification Types

| Type                | Icon | Description                          |
| ------------------- | :--: | ------------------------------------ |
| Recipe Rating       |  ⭐  | Someone rated your recipe            |
| Recipe Comment      |  💬  | Someone commented on your recipe     |
| Comment Like        |  👍  | Someone liked your comment           |
| Comment Dislike     |  👎  | Someone disliked your comment        |
| Comment Reply       |  ↩️  | Recipe owner replied to your comment |
| System Announcement |  📢  | Platform-wide announcements          |

#### Entry Points

- Header notification bell icon
- Direct URL navigation

#### Exit Points

- Notification click → Related content (recipe, comment)
- Delete notification → In-page action

#### Components

- `NotificationsList` - List container
- `NotificationItem` - Single notification
- `UnreadBadge` - Unread indicator

#### Empty State

"You don't have any notifications yet."

---

### 8.4 Support

**Path:** `/support`  
**Auth Required:** No\* (View only; submission requires auth)  
**Role Access:** Guest (view), User (submit)  
**HTTP Method:** GET

#### Purpose

Support page where authenticated users submit support tickets. Guests can view but not submit.

#### Entry Points

- Header "Support" link
- Footer navigation link
- Direct URL navigation

#### Exit Points

- Ticket submitted → In-page success message

#### Ticket Statuses

| Status      | Description                   |
| ----------- | ----------------------------- |
| Open        | New ticket, not yet addressed |
| In Progress | Support team working on it    |
| Resolved    | Issue resolved                |
| Closed      | Ticket closed                 |

#### Components

- `SupportForm` - Ticket submission form
- `SupportMessageInput` - Message text input
- `SubmitButton` - Submit action

#### Empty State

"Need help? Send us a message and our support team will get back to you."

---

## 9. Error Routes

### 9.1 Not Found (404)

**Path:** (dynamic)  
**Auth Required:** No  
**Role Access:** All Users  
**HTTP Method:** GET

#### Purpose

Generic 404 error page for non-existent routes or resources.

#### Triggers

| Trigger                    | Example                             |
| -------------------------- | ----------------------------------- |
| Invalid route              | `/invalid-page`                     |
| Invalid recipe slug        | `/recipes/non-existent-recipe`      |
| Invalid username           | `/profile/non-existent-user`        |
| Invalid category slug      | `/categories/non-existent-category` |
| Deleted/unpublished recipe | `/recipes/deleted-recipe`           |

#### Display

- 404 error message
- "Return to Home" button linking to `/`

#### Components

- `ErrorPage` - 404 error display container

---

## 10. Technical Reference

### 10.1 Route Parameters

#### Dynamic Parameters Summary

| Parameter         | Type   | Used In                                                                                  | Example                     |
| ----------------- | ------ | ---------------------------------------------------------------------------------------- | --------------------------- |
| `slug` (recipe)   | String | `/recipes/[slug]`, `/recipes/[slug]/edit`                                                | `classic-margherita-pizza`  |
| `slug` (category) | String | `/categories/[slug]`                                                                     | `main-course`, `desserts`   |
| `username`        | String | `/profile/[username]`, `/profile/[username]/followers`, `/profile/[username]/followings` | `chef_ali`, `home_cook_123` |
| `q` (search)      | String | `/search?q=...`                                                                          | `pasta`, `کیک شکلاتی`       |

#### Filter & Sort Query Parameters

Used on `/recipes` and `/categories/[slug]`. Values are stored in the URL so state is shareable and restored on navigation.

| Parameter    | Type   | Multiple | Used In                        | Example Values                         |
| ------------ | ------ | :------: | ------------------------------ | -------------------------------------- |
| `category`   | String |   Yes    | `/recipes` only                | `desserts`, `main-course`              |
| `ingredient` | String |   Yes    | `/recipes`, `/categories/[slug]` | `flour`, `chicken`                   |
| `difficulty` | Enum   |   Yes    | `/recipes`, `/categories/[slug]` | `EASY`, `MEDIUM`, `HARD`             |
| `prepTime`   | Number |    No    | `/recipes`, `/categories/[slug]` | `30`, `60`                           |
| `cuisine`    | String |   Yes    | `/recipes`, `/categories/[slug]` | `iranian`, `italian`                 |
| `sort`       | Enum   |    No    | `/recipes`, `/categories/[slug]` | `popular`, `highestRated`, `newest`, `oldest` |

#### Parameter Validation

**Recipe Slug:**

- Format: Lowercase, URL-friendly
- Generated from: Recipe title
- Uniqueness: Must be unique across all recipes
- Example: "Classic Margherita Pizza" → `classic-margherita-pizza`

**Category Slug:**

- Format: Lowercase, URL-friendly
- Generated from: Category name
- Uniqueness: Must be unique across all categories

**Username:**

- Format: 3-30 characters, alphanumeric + underscore
- Uniqueness: Must be unique across all users
- Case: Stored as lowercase

**Search Query (q):**

- Max length: 100 characters
- Encoding: URL-encoded
- Persian support: Full support for Persian characters

---

### 10.2 Route Protection & Authorization

#### Protection Types

| Type          | Description                  | Check Required                     |
| ------------- | ---------------------------- | ---------------------------------- |
| **Public**    | No authentication required   | None                               |
| **Protected** | Authentication required      | Valid session                      |
| **Owner**     | Authentication + ownership   | Valid session + resource ownership |
| **Self**      | Authentication + self-access | Valid session + matching username  |

#### Unauthenticated User Handling

When a guest attempts to access a protected route:

```
Redirect: /login?redirect=/protected-route
```

After successful authentication, user is redirected back to original protected route.

#### Authentication Prompt Messages

| Action          | Prompt Message               |
| --------------- | ---------------------------- |
| Create Recipe   | "Sign in to create recipes"  |
| Bookmark Recipe | "Sign in to save recipes"    |
| Rate Recipe     | "Sign in to rate recipes"    |
| Post Comment    | "Sign in to comment"         |
| Follow User     | "Sign in to follow users"    |
| Submit Ticket   | "Sign in to contact support" |

#### Authorization Middleware Pattern

```typescript
// Example middleware structure
export const authMiddleware = {
  public: [], // No checks
  protected: [requireAuth],
  owner: [requireAuth, checkOwnership],
  self: [requireAuth, checkSelfAccess],
};
```

---

### 10.3 Navigation Flows

#### Primary Navigation Structure

```
Header / Nav (all pages)
├── Guest State
│   ├── Sign In (/login)
│   └── Sign Up (/register)
├── Auth State
│   ├── Profile (/profile)
│   ├── Bookmarks (/bookmarks)
│   ├── Notifications (/notifications)
│   ├── Community (/community)
│   └── Sign Out (from profile)
└── Search Bar
    ├── Input (3+ chars)
    ├── Suggestions
    └── View All (/search)
```

#### Page-to-Page Navigation Map

```
Home (/)
├── Recipes (/recipes?filters&sort)
│   ├── Recipe Detail (/recipes/[slug])
│   │   ├── Author → Profile
│   │   ├── Category → Category Detail
│   │   └── Edit (owner) → Edit Recipe
│   └── New Recipe (/recipes/new)
├── Categories (/categories)
│   └── Category Detail (/categories/[slug]?filters&sort)
│       └── Recipe → Recipe Detail
├── Search (/search?q=...)
│   └── Result → Recipe Detail
├── Community (/community)
│   └── User → Profile
├── Profile (/profile or /profile/[username])
│   ├── Followers (/profile/[username]/followers)
│   ├── Followings (/profile/[username]/followings)
│   ├── Change Password (/change-password)
│   └── Recipe → Recipe Detail / Edit
├── Bookmarks (/bookmarks)
│   └── Recipe → Recipe Detail
├── Notifications (/notifications)
│   └── Related Content
└── Support (/support)
```

#### Authentication Flow Navigation

```
Guest → Register → Verify Email → Home (Authenticated)
Guest → Login → Home (Authenticated)
Guest → Forgot Password → Verify Reset → Reset Password → Login
User → Change Password → Profile
User → Logout (from Profile) → Home (Guest)
```

---

### 10.4 Implementation Guide

#### TypeScript Route Constants

```typescript
// Recommended route constants for type-safe navigation
const ROUTES = {
  HOME: "/",

  RECIPES: {
    LIST: "/recipes",
    NEW: "/recipes/new",
    DETAIL: (slug: string) => `/recipes/${slug}`,
    EDIT: (slug: string) => `/recipes/${slug}/edit`,
  },

  AUTH: {
    LOGIN: "/login",
    REGISTER: "/register",
    VERIFY_EMAIL: "/verify-email",
    FORGOT_PASSWORD: "/forgot-password",
    VERIFY_RESET_CODE: "/verify-reset-code",
    RESET_PASSWORD: "/reset-password",
    CHANGE_PASSWORD: "/change-password",
  },

  CATEGORIES: {
    LIST: "/categories",
    DETAIL: (slug: string) => `/categories/${slug}`,
  },

  SEARCH: "/search",

  COMMUNITY: "/community",

  PROFILE: {
    MY_PROFILE: "/profile",
    USER: (username: string) => `/profile/${username}`,
    FOLLOWERS: (username: string) => `/profile/${username}/followers`,
    FOLLOWINGS: (username: string) => `/profile/${username}/followings`,
  },

  BOOKMARKS: "/bookmarks",
  NOTIFICATIONS: "/notifications",
  SUPPORT: "/support",
} as const;

// Usage examples:
// router.push(ROUTES.RECIPES.LIST)
// router.push(ROUTES.RECIPES.DETAIL("pasta-carbonara"))
// router.push(ROUTES.PROFILE.USER("john_doe"))
// router.push(`${ROUTES.RECIPES.LIST}?sort=newest&difficulty=EASY`)
```

---

### 10.5 Next.js App Router File Structure

```typescript
// Recommended Next.js 14+ App Router structure
src/
├── app/
│   ├── layout.tsx                        // Root layout
│   ├── page.tsx                          // Home (/)
│   │
│   ├── (auth)/                          // Auth route group
│   │   ├── layout.tsx                    // AuthLayout
│   │   ├── login/
│   │   │   └── page.tsx                  // Login
│   │   ├── register/
│   │   │   └── page.tsx                  // Register
│   │   ├── verify-email/
│   │   │   └── page.tsx                  // Verify Email
│   │   ├── forgot-password/
│   │   │   └── page.tsx                  // Forgot Password
│   │   ├── verify-reset-code/
│   │   │   └── page.tsx                  // Verify Reset
│   │   └── reset-password/
│   │       └── page.tsx                  // Reset Password
│   │
│   ├── change-password/
│   │   └── page.tsx                      // Change Password
│   │
│   ├── recipes/
│   │   ├── page.tsx                      // All Recipes (?filters&sort)
│   │   ├── new/
│   │   │   └── page.tsx                  // New Recipe
│   │   └── [slug]/
│   │       ├── page.tsx                  // Recipe Detail
│   │       └── edit/
│   │           └── page.tsx              // Edit Recipe
│   │
│   ├── categories/
│   │   ├── page.tsx                      // All Categories
│   │   └── [slug]/
│   │       └── page.tsx                  // Category Detail (?filters&sort)
│   │
│   ├── search/
│   │   └── page.tsx                      // Search Results
│   │
│   ├── community/
│   │   └── page.tsx                      // Community (all users)
│   │
│   ├── profile/
│   │   ├── page.tsx                      // My Profile
│   │   └── [username]/
│   │       ├── page.tsx                  // User Profile
│   │       ├── followers/
│   │       │   └── page.tsx              // Followers
│   │       └── followings/
│   │           └── page.tsx              // Followings
│   │
│   ├── bookmarks/
│   │   └── page.tsx                      // Bookmarks
│   │
│   ├── notifications/
│   │   └── page.tsx                      // Notifications
│   │
│   ├── support/
│   │   └── page.tsx                      // Support
│   │
│   └── not-found.tsx                     // 404 Not Found
│
├── components/                           // Shared components
├── lib/                                  // Utilities & helpers
└── middleware.ts                         // Route protection middleware
```

---

### 10.6 Middleware Implementation

```typescript
// middleware.ts - Example route protection
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicRoutes = [
  "/",
  "/recipes",
  "/recipes/[slug]",
  "/categories",
  "/categories/[slug]",
  "/search",
  "/community",
  "/profile/[username]",
  "/support",
];

const authOnlyRoutes = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/verify-reset-code",
  "/reset-password",
];

const protectedRoutes = [
  "/recipes/new",
  "/recipes/[slug]/edit",
  "/change-password",
  "/profile",
  "/bookmarks",
  "/notifications",
];

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth-only pages
  if (isAuthenticated && authOnlyRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users from protected routes
  if (
    !isAuthenticated &&
    protectedRoutes.some((route) => pathname.startsWith(route))
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### 10.7 Shared Validation Rules

#### Recipe Form Validation (New & Edit)

```typescript
import { z } from "zod";

export const recipeSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(30).max(500).optional(),
  coverImage: z.string().url(),
  categoryId: z.string(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  preparationTime: z.number().min(1),
  cookingTime: z.number().min(0).optional(),
  servings: z.number().min(1).max(100),
  origin: z.string().max(60).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().min(0),
        unit: z.string().min(1),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        order: z.number().min(1),
        title: z.string().optional(),
        description: z.string().min(1).max(1000),
        image: z.string().url().optional(),
      }),
    )
    .min(1),
  nutrition: z
    .object({
      calories: z.number().min(0).optional(),
      protein: z.number().min(0).optional(),
      carbohydrates: z.number().min(0).optional(),
      fat: z.number().min(0).optional(),
    })
    .optional(),
});
```

#### Authentication Validation

```typescript
// Registration
export const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(
      /^[a-z0-9_]+$/,
      "Username must be lowercase letters, numbers, or underscores",
    ),
  email: z.string().email(),
  password: z.string().min(8),
});

// Login
export const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

// OTP Verification
export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

// Password Change
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  verificationCode: z.string().regex(/^\d{6}$/),
});
```

#### Profile Validation

```typescript
export const profileSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  socialLinks: z
    .object({
      instagram: z.string().url().optional(),
      telegram: z.string().url().optional(),
      x: z.string().url().optional(),
    })
    .optional(),
});
```

---

### 10.8 Common Components Reference

#### Shared Layout Components

| Component       | Used In         | Purpose                                |
| --------------- | --------------- | -------------------------------------- |
| `AuthLayout`    | All auth routes | Centered auth page layout              |
| `DefaultLayout` | All app routes  | Standard app layout with header/footer |
| `Header`        | All pages       | Navigation, search, auth actions       |
| `Footer`        | All pages       | Footer links and info                  |

#### Shared Form Components

| Component          | Used In            | Purpose                           |
| ------------------ | ------------------ | --------------------------------- |
| `PasswordInput`    | Auth pages         | Secure password input with toggle |
| `OTPInput`         | Verification pages | 6-digit code input                |
| `CountdownTimer`   | Verification pages | OTP expiration countdown          |
| `ResendCodeButton` | Verification pages | Resend OTP action                 |
| `ImageUploader`    | Recipe, Profile    | Upload/crop/preview images        |

#### Shared Data Components

| Component          | Used In          | Purpose               |
| ------------------ | ---------------- | --------------------- |
| `RecipeCard`       | Multiple pages   | Recipe preview card   |
| `CategoryCard`     | Home, Categories | Category preview card |
| `UserCard`         | Followings, Community | User preview card     |
| `CommentCard`      | Recipe detail    | Comment display       |
| `NotificationItem` | Notifications    | Single notification   |

#### Shared UI Components

| Component      | Used In        | Purpose            |
| -------------- | -------------- | ------------------ |
| `EmptyState`   | Multiple pages | No content display |
| `LoadingState` | Multiple pages | Loading indicator  |
| `ErrorState`   | Multiple pages | Error display      |
| `Modal`        | Multiple pages | Modal dialogs      |
| `Dropdown`     | Multiple pages | Dropdown menus     |
| `Tabs`         | Multiple pages | Tab navigation     |

---

### 10.9 SEO & Metadata

#### Dynamic Metadata Pattern

```typescript
// Example: app/recipes/[slug]/page.tsx
import { Metadata } from "next";

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await getRecipeBySlug(params.slug);

  if (!recipe) {
    return {
      title: "Recipe Not Found",
    };
  }

  return {
    title: `${recipe.title} | Loghmeh`,
    description: recipe.description,
    openGraph: {
      title: recipe.title,
      description: recipe.description,
      images: [recipe.coverImage],
      type: "article",
    },
  };
}
```

#### Static Metadata by Route

| Route         | Title Pattern                        | Description Pattern |
| ------------- | ------------------------------------ | ------------------- | -------------------- |
| Home          | `Loghmeh - Discover & Share Recipes` | Main app tagline    |
| All Recipes   | `Recipes                             | Loghmeh`            | Browse all recipes   |
| Recipe Detail | `{title}                             | Loghmeh`            | Recipe description   |
| Category      | `{name} Recipes                      | Loghmeh`            | Category description |
| Search        | `Search Results for "{query}"        | Loghmeh`            | Search query         |
| Profile       | `{username}                          | Loghmeh`            | User bio             |
| Community     | `Community                           | Loghmeh`            | Browse all users     |
| Login         | `Sign In                             | Loghmeh`            | Authentication page  |
| Register      | `Create Account                      | Loghmeh`            | Registration page    |

---

### 10.10 Performance Considerations

#### Route-Level Optimizations

| Route Type    | Strategy                              | Implementation                     |
| ------------- | ------------------------------------- | ---------------------------------- |
| Home          | ISR (Incremental Static Regeneration) | Revalidate every 60s               |
| All Recipes   | SSR with caching                      | Cache for 30s                      |
| Recipe Detail | SSG + ISR                             | Static with on-demand revalidation |
| Categories    | SSG                                   | Static generation                  |
| Search        | Client-side                           | Dynamic search with debounce       |
| Profile       | SSR                                   | Dynamic based on user              |
| Auth Pages    | Static                                | No dynamic data                    |

#### Pagination & Loading

| Route               | Pagination      | Initial Load | Load More  |
| ------------------- | --------------- | ------------ | ---------- |
| All Recipes         | Infinite scroll | 12 items     | 12 items   |
| Category Detail     | Infinite scroll | 12 items     | 12 items   |
| Search Results      | Infinite scroll | 12 items     | 12 items   |
| Profile Recipes     | Pagination      | 12 items     | Page-based |
| Community           | Pagination      | 24 items     | Page-based |
| Bookmarks           | Infinite scroll | 12 items     | 12 items   |
| Notifications       | Infinite scroll | 20 items     | 20 items   |
| Followers/Followings| Pagination      | 24 items     | Page-based |

---

## Appendix

### A. Route Improvements Summary

This improved documentation consolidates and reorganizes the original routes.md with the following enhancements:

**Structure Improvements:**

- Single route summary table (vs. 3 separate tables)
- Consolidated validation rules per feature (vs. scattered per route)
- Grouped related routes logically
- Added visual navigation flows

**Content Consolidation:**

- Filters & sorting described once (vs. repeated 5+ times)
- Shared components referenced (vs. listed per route)
- Validation rules by feature (vs. per page)
- Error states grouped

**Technical Additions:**

- TypeScript route constants
- Next.js file structure
- Middleware implementation examples
- Zod validation schemas
- SEO metadata patterns
- Performance strategies

**Navigation Enhancements:**

- Comprehensive table of contents
- Cross-references between related sections
- Quick reference tables
- Permission matrices

### B. Feature-to-Route Mapping

| Feature            | Primary Routes                                                                                                          | Count |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | :---: |
| Authentication     | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/verify-reset-code`, `/reset-password`, `/change-password` |   7   |
| Recipe Discovery   | `/`, `/recipes`, `/recipes/[slug]`                                                                                      |   3   |
| Recipe Management  | `/recipes/new`, `/recipes/[slug]/edit` (own recipes managed on `/profile`)                                              |   2   |
| Categories         | `/categories`, `/categories/[slug]`                                                                                     |   2   |
| Search             | `/search?q=...`                                                                                                         |   1   |
| User Profile       | `/profile`, `/profile/[username]`                                                                                       |   2   |
| Social Features    | `/profile/[username]/followers`, `/profile/[username]/followings`                                                       |   2   |
| Community          | `/community`                                                                                                            |   1   |
| User Actions       | `/bookmarks`, `/notifications`                                                                                          |   2   |
| Support            | `/support`                                                                                                              |   1   |
| Error Handling     | 404 Not Found                                                                                                           |   1   |

### C. Route State Transitions

**User Authentication States:**

```
Guest → [Register] → [Verify Email] → Authenticated User
Guest → [Login] → Authenticated User
Authenticated User → [Logout] → Guest
```

**Recipe States:**

```
Not Created → [Create] → Draft
Draft → [Publish] → Published
Published → [Edit] → Published (updated)
Published → [Delete] → Deleted (soft delete)
```

**Bookmark States:**

```
Not Bookmarked → [Bookmark] → Bookmarked
Bookmarked → [Remove] → Not Bookmarked
```

**Follow States:**

```
Not Following → [Follow] → Following
Following → [Unfollow] → Not Following
```

### D. Error Code Reference

| HTTP Code | Route Scenario        | User Message                 | Action                    |
| --------- | --------------------- | ---------------------------- | ------------------------- |
| 401       | Unauthorized access   | "Please sign in to continue" | Redirect to `/login`      |
| 403       | Forbidden (not owner) | "You don't have permission"  | Redirect to previous page |
| 404       | Resource not found    | "Page not found"             | Show 404 page             |
| 500       | Server error          | "Something went wrong"       | Show error page           |

### E. Desktop Page Reference

The following desktop page screenshots correspond to routes:

| Screenshot File                        | Route                                                       | Notes                         |
| ----------------------------------------| -------------------------------------------------------------| -------------------------------|
| `desktop-home.png`                     | `/`                                                         | Home feed layout              |
| `desktop-signin.png`                   | `/login`                                                    | Login page                    |
| `desktop-signup.png`                   | `/register`                                                 | Registration page             |
| `desktop-forget-password-*.png`        | `/forgot-password`, `/verify-reset-code`, `/reset-password` | Password reset flow (4 steps) |
| `desktop-all-recipes-list.png`         | `/recipes`                                                  | All recipes with filters      |
| `desktop-recipe-detail.png`            | `/recipes/[slug]`                                           | Recipe detail page            |
| `desktop-add-recipe.png`               | `/recipes/new`                                              | Recipe creation form          |
| `desktop-current-user-recipe.png`      | `/profile`                                                  | Own profile recipes section   |
| `desktop-categories-list.png`          | `/categories`                                               | All categories                |
| `desktop-category-recipes.png`         | `/categories/[slug]`                                        | Category detail               |
| `desktop-category-recipes-empty.png`   | `/categories/[slug]`                                        | Empty state                   |
| `desktop-search-all-results.png`       | `/search?q=...`                                             | Search results                |
| `desktop-search-all-results-empty.png` | `/search?q=...`                                             | No results state              |
| `desktop-filter-results-empty.png`     | `/recipes`                                                  | Empty filter state            |
| `desktop-user-profile.png`             | `/profile/[username]`                                       | Public user profile           |
| `desktop-current-user-profile.png`     | `/profile`                                                  | Own profile (+ settings)      |
| `desktop-current-user-saves.png`       | `/bookmarks`                                                | Bookmarks page                |
| `desktop-followers-list.png`           | `/profile/[username]/followers`                             | Followers list                |
| `desktop-followings-list.png`          | `/profile/[username]/followings`                            | Followings list               |
| `desktop-community.png`                | `/community`                                                | Community users list          |
| `desktop-notifications.png`            | `/notifications`                                            | Notifications page            |
| `desktop-support-and-about-us.png`     | `/support`                                                  | Support page                  |
| `desktop-error-or-not-found.png`       | `*` (404)                                                   | Error page                    |
| `desktop-modal.png`                    | Various                                                     | Modal overlay examples        |

_Document Version: 1.0_
_Last Updated: July 2026_
