# Features

This document describes all functional features of the Loghmeh application.

Each feature includes its purpose, capabilities, dependencies, business rules, and implementation requirements.

---

## Document Structure

### Feature Categories

1. **Core Features** - Authentication, Recipes, Categories, Search
2. **User Features** - User Profile, Bookmarks, Ratings, Comments
3. **Social Features** - Following System, Notifications
4. **Support Features** - Support Tickets, Settings
5. **Discovery Features** - Home Feed

---

## Quick Reference

| Feature          | Priority | Status  | Primary Users |
| ---------------- | -------- | ------- | ------------- |
| Authentication   | Highest  | Planned | Guest, User   |
| User Profile     | High     | Planned | Guest, User   |
| Recipes          | Highest  | Planned | Guest, User   |
| Recipe Search    | High     | Planned | Guest, User   |
| Categories       | High     | Planned | Guest, User   |
| Bookmarks        | High     | Planned | User          |
| Ratings          | High     | Planned | User          |
| Comments         | High     | Planned | User          |
| Following System | High     | Planned | User          |
| Notifications    | High     | Planned | User          |
| Support Tickets  | Medium   | Planned | User          |
| Settings         | Medium   | Planned | User          |
| Home Feed        | High     | Planned | Guest, User   |

---

# Core Features

## 1. Authentication

### Overview

The Authentication feature allows users to securely create an account, verify their email address, sign in, sign out, and manage their password.

Email verification is required during registration and password reset using a one-time verification code (OTP) sent to the user's email address.

### Purpose

Provide a secure authentication system while ensuring that every registered account belongs to a valid email owner.

### User Roles

- Guest
- Registered User

### User Capabilities

#### Guest

- Register
- Verify Email
- Sign In
- Request Password Reset
- Verify Reset Code
- Reset Password

#### Registered User

- Sign Out
- Change Password

### Authentication Flows

#### Registration Flow

1. User submits the registration form
2. The system validates all input
3. A verification code is sent to the user's email
4. The user enters the verification code
5. The system verifies the code
6. The account becomes active
7. The user is automatically signed in

#### Login Flow

1. User enters email (or username) and password
2. Credentials are validated
3. A session is created
4. User is redirected to the application

#### Forgot Password Flow

1. User enters their email address
2. A verification code is sent to the email
3. User enters the verification code
4. User chooses a new password
5. Password is updated
6. User is redirected to the login page

#### Change Password Flow

1. User enters their current password
2. User enters a new password
3. A verification code is sent to the registered email
4. User enters the verification code
5. Password is updated successfully

### Pages

| Page              | Path                 | Description             |
| ----------------- | -------------------- | ----------------------- |
| Login             | `/login`             | User sign in            |
| Register          | `/register`          | New user registration   |
| Verify Email      | `/verify-email`      | Email verification      |
| Forgot Password   | `/forgot-password`   | Request password reset  |
| Verify Reset Code | `/verify-reset-code` | Verify reset code       |
| Reset Password    | `/reset-password`    | Set new password        |
| Change Password   | `/change-password`   | Change current password |

### Components

| Component             | Purpose                            |
| --------------------- | ---------------------------------- |
| LoginForm             | User authentication form           |
| RegisterForm          | New user registration form         |
| PasswordInput         | Secure password input field        |
| EmailVerificationForm | Email verification interface       |
| OTPInput              | One-time password input            |
| ForgotPasswordForm    | Password recovery form             |
| ResetPasswordForm     | New password setup form            |
| ChangePasswordForm    | Password update form               |
| AuthLayout            | Authentication pages layout        |
| CountdownTimer        | Verification code expiration timer |
| ResendCodeButton      | Resend verification code button    |

### Database Collections

#### User

| Field         | Type   | Required | Description                  |
| ------------- | ------ | -------- | ---------------------------- |
| username      | String | Yes      | Unique username              |
| email         | String | Yes      | Unique email address         |
| password      | String | Yes      | Hashed password              |
| image         | String | No       | Profile image URL            |
| emailVerified | Date   | No       | Email verification timestamp |
| createdAt     | Date   | Yes      | Account creation date        |
| updatedAt     | Date   | Yes      | Last update date             |

#### VerificationCode

| Field     | Type   | Required | Description                                         |
| --------- | ------ | -------- | --------------------------------------------------- |
| email     | String | Yes      | Associated email                                    |
| code      | String | Yes      | 6-digit verification code                           |
| purpose   | Enum   | Yes      | EMAIL_VERIFICATION, PASSWORD_RESET, PASSWORD_CHANGE |
| expiresAt | Date   | Yes      | Code expiration date                                |
| createdAt | Date   | Yes      | Code creation date                                  |

### Server Actions

| Action                    | Description                |
| ------------------------- | -------------------------- |
| `registerUser()`          | Create new user account    |
| `sendVerificationCode()`  | Send OTP to email          |
| `verifyEmail()`           | Verify email with OTP      |
| `loginUser()`             | Authenticate user          |
| `logoutUser()`            | End user session           |
| `requestPasswordReset()`  | Initiate password recovery |
| `verifyResetCode()`       | Validate reset OTP         |
| `resetPassword()`         | Update password            |
| `requestPasswordChange()` | Initiate password change   |
| `verifyPasswordChange()`  | Validate change OTP        |
| `changePassword()`        | Update password            |

### Validation Rules

#### Registration

| Field    | Rules                                |
| -------- | ------------------------------------ |
| username | Required, 3-30 characters, unique    |
| email    | Required, valid email format, unique |
| password | Required, minimum 8 characters       |

#### Verification Code

| Field | Rules                       |
| ----- | --------------------------- |
| code  | Required, numeric, 6 digits |

#### Login

| Field          | Rules    |
| -------------- | -------- |
| email/username | Required |
| password       | Required |

#### Password Reset

| Field             | Rules                          |
| ----------------- | ------------------------------ |
| email             | Required                       |
| verification code | Required                       |
| new password      | Required, minimum 8 characters |

### Business Rules

#### Account Rules

- Every email address must be unique
- Every username must be unique
- Passwords must contain at least 8 characters
- Passwords are stored as hashed values
- Users cannot sign in until their email has been verified

#### Verification Code Rules

- Verification codes expire after 10 minutes
- Verification codes can only be used once
- A new verification code invalidates any previous unused code for the same purpose
- Users may request a new verification code after the resend cooldown expires
- Verification codes are sent only to the email address associated with the request
- Verification attempts are rate-limited to prevent abuse
- Failed verification attempts are limited

#### Password Rules

- Password reset requires successful verification of the email code
- Password change requires verification of both the current password and the email verification code
- Authentication sessions are invalidated after a password change

### Dependencies

- Auth.js
- MongoDB
- Mongoose
- Zod
- React Hook Form
- Email Service (Resend)

### Future Enhancements

- Google Sign-In
- GitHub Sign-In
- Passkeys (WebAuthn)
- Two-Factor Authentication (2FA)
- Trusted Devices
- Login Activity History

---

## 2. Recipes

### Overview

Recipes are the core feature of Loghmeh. Users can create, publish, discover, search, filter, sort, rate, comment, bookmark, and manage cooking recipes through an intuitive and responsive interface.

Guests can browse public recipes, while authenticated users can fully interact with the recipe ecosystem.

### Purpose

Provide a modern and enjoyable recipe-sharing experience where users can easily publish recipes, discover new foods, and interact with the cooking community.

### User Roles

- Guest (Read Only)
- Registered User

### User Capabilities

#### Guest

- Browse published recipes
- View recipe details
- Search recipes
- Filter recipes
- Sort recipes
- View recipe ratings
- View recipe author
- View recipe comments
- View ingredients
- View preparation steps

#### Registered User

##### Recipe Management

- Create recipe
- Publish recipe
- Edit own recipe
- Delete own recipe

##### Images

- Upload cover image
- Replace cover image

##### Discovery

- Browse recipes
- Search recipes
- Filter recipes
- Sort recipes

##### Community

- Rate recipes
- Bookmark recipes
- Remove bookmarks
- Comment on recipes

### Pages

| Page           | Path                   | Description          |
| -------------- | ---------------------- | -------------------- |
| Home           | `/`                    | Main discovery page  |
| All Recipes    | `/recipes`             | Browse all recipes   |
| New Recipe     | `/recipes/new`         | Create new recipe    |
| Recipe Details | `/recipes/[slug]`      | View recipe details  |
| Edit Recipe    | `/recipes/[slug]/edit` | Edit existing recipe |
| My Recipes     | `/my-recipes`          | User's own recipes   |

### Recipe Information

Each recipe contains:

| Field           | Type     | Required | Description             |
| --------------- | -------- | -------- | ----------------------- |
| title           | String   | Yes      | Recipe title            |
| slug            | String   | Yes      | URL-friendly identifier |
| description     | String   | No       | Recipe description      |
| coverImage      | String   | Yes      | Cover image URL         |
| category        | ObjectId | Yes      | Recipe category         |
| cuisine         | String   | No       | Cuisine type            |
| difficulty      | Enum     | Yes      | EASY, MEDIUM, HARD      |
| preparationTime | Number   | Yes      | Time in minutes         |
| servings        | Number   | Yes      | Number of servings      |
| ingredients     | Array    | Yes      | List of ingredients     |
| steps           | Array    | Yes      | Preparation steps       |
| author          | ObjectId | Yes      | Recipe creator          |
| status          | Enum     | Yes      | DRAFT, PUBLISHED        |
| createdAt       | Date     | Yes      | Creation date           |
| updatedAt       | Date     | Yes      | Last update date        |

#### Recipe Statistics

Each recipe stores:

| Statistic     | Description             |
| ------------- | ----------------------- |
| averageRating | Mean of all ratings     |
| ratingCount   | Total number of ratings |
| bookmarkCount | Total bookmarks         |
| commentCount  | Total comments          |
| viewCount     | Total views             |

### Filters & Sorting

#### Available Filters

| Filter           | Description        | Multiple Selection |
| ---------------- | ------------------ | ------------------ |
| Category         | Recipe category    | Yes                |
| Main Ingredient  | Primary ingredient | Yes                |
| Difficulty       | EASY, MEDIUM, HARD | Yes                |
| Preparation Time | Cooking duration   | Yes                |
| Cuisine          | Origin type        | Yes                |

Filters can be combined.

#### Available Sorting

| Sort Option   | Description       |
| ------------- | ----------------- |
| Most Popular  | By view count     |
| Highest Rated | By average rating |
| Newest        | By creation date  |
| Oldest        | By creation date  |

Only one sorting option can be active at a time.

### Search

Users can search recipes by:

**Version 1:**

- Recipe Title

**Future Versions:**

- Ingredient
- Author
- Tags

### Components

| Component            | Purpose                   |
| -------------------- | ------------------------- |
| RecipeCard           | Recipe preview card       |
| RecipeGrid           | Grid layout for recipes   |
| RecipeForm           | Recipe creation/edit form |
| RecipeImageUploader  | Cover image upload        |
| RecipeHeader         | Recipe title and meta     |
| RecipeInformation    | Recipe details display    |
| RecipeActions        | Recipe action buttons     |
| RecipeAuthor         | Author information        |
| IngredientList       | Ingredients display       |
| IngredientItem       | Single ingredient         |
| PreparationSteps     | Cooking steps             |
| StepItem             | Single step               |
| RecipeRating         | Rating display            |
| RecipeBookmarkButton | Bookmark toggle           |
| RecipeSearchBar      | Search input              |
| RecipeFilters        | Filter controls           |
| RecipeSorting        | Sort controls             |
| EmptyRecipeState     | No recipes display        |
| RecipeComments       | Comments section          |
| CommentList          | Comments list             |
| CommentCard          | Single comment            |
| CommentForm          | Comment input             |

### Database Collections

- Recipe
- Category
- User
- Rating
- Bookmark
- Comment

### Server Actions

| Action                | Description            |
| --------------------- | ---------------------- |
| `createRecipe()`      | Create new recipe      |
| `updateRecipe()`      | Update existing recipe |
| `deleteRecipe()`      | Soft delete recipe     |
| `publishRecipe()`     | Publish draft recipe   |
| `saveDraft()`         | Save as draft          |
| `getRecipe()`         | Get single recipe      |
| `getRecipes()`        | Get all recipes        |
| `getUserRecipes()`    | Get user's recipes     |
| `searchRecipes()`     | Search recipes         |
| `filterRecipes()`     | Filter recipes         |
| `sortRecipes()`       | Sort recipes           |
| `uploadRecipeImage()` | Upload cover image     |
| `deleteRecipeImage()` | Remove cover image     |
| `rateRecipe()`        | Submit rating          |
| `bookmarkRecipe()`    | Add bookmark           |
| `removeBookmark()`    | Remove bookmark        |
| `addComment()`        | Add comment            |
| `deleteComment()`     | Delete comment         |
| `getRecipeComments()` | Get recipe comments    |

### Validation Rules

#### Required Fields

- Title
- Cover Image
- Category
- Difficulty
- Preparation Time
- Servings
- At least one ingredient
- At least one preparation step

#### Optional Fields

- Description
- Cuisine

#### Ingredient Structure

Each ingredient must contain:

- Name (required)
- Quantity (required)
- Unit (required)

#### Preparation Steps

- Minimum one step
- Maximum 1000 characters per step

### Business Rules

#### Creation & Ownership

- Only authenticated users can create recipes
- Only the recipe owner can edit a recipe
- Only the recipe owner can delete a recipe
- Soft delete must be used when deleting recipes

#### Content Requirements

- Every recipe must belong to exactly one category
- Every recipe must contain at least one ingredient
- Every recipe must contain at least one preparation step
- Every published recipe must have a unique slug
- Cover image is required
- Images must be valid image files

#### User Interactions

- Guests cannot create, edit, delete, bookmark,comment or rate recipes
- Registered users can bookmark any published recipe even their own
- A user can rate a recipe only once
- Users may update their rating at any time
- Only authenticated users can post comments
- Guests can read comments but cannot create comments
- Users can delete only their own comments
- Empty comments are not allowed
- Each comment must belong to exactly one recipe
- Comments are displayed in chronological order (newest first)

#### Statistics

- Recipe ratings are automatically recalculated after each new or updated rating
- Users can apply multiple filters simultaneously
- Only one sorting option can be active at a time
- Search results include only published recipes
- Recipes are visible on the author's public profile only after publication

### Dependencies

- MongoDB
- Mongoose
- Auth.js
- UploadThing
- React Hook Form
- Zod
- date-fns

### Future Enhancements

- Recipe Gallery
- Video Recipes
- Nutrition Facts
- Tags
- Recipe Collections
- Recently Viewed Recipes
- Similar Recipes
- AI-assisted Recipe Writing
- Recipe Version History
- Import Recipe from URL

---

## 3. Categories

### Overview

The Categories feature allows users to browse all available recipe categories and discover recipes organized by category.

Each category has its own dedicated page displaying recipes that belong to it.

### Purpose

Provide a structured and intuitive way for users to explore recipes based on their interests.

### User Roles

- Guest
- Registered User

### User Capabilities

- View all categories
- Open a category
- Browse recipes within a category
- Filter recipes
- Sort recipes
- Open recipe details

### Pages

| Page             | Path                 | Description           |
| ---------------- | -------------------- | --------------------- |
| Categories       | `/categories`        | Browse all categories |
| Category Details | `/categories/[slug]` | View category recipes |

### Category Information

| Field         | Type   | Required | Description             |
| ------------- | ------ | -------- | ----------------------- |
| name          | String | Yes      | Category name           |
| slug          | String | Yes      | URL-friendly identifier |
| description   | String | No       | Category description    |
| coverImage    | String | Yes      | Cover image URL         |
| recipeCount   | Number | Auto     | Number of recipes       |
| featuredOrder | Number | No       | Homepage display order  |
| createdAt     | Date   | Yes      | Creation date           |

### Homepage Integration

The homepage displays featured categories based on the **Featured Order** field.

Categories without a Featured Order are not displayed on the homepage.

### Available Filters

(for the recipes in the category page)

| Filter           | Description        |
| ---------------- | ------------------ |
| Main Ingredient  | Primary ingredient |
| Difficulty       | EASY, MEDIUM, HARD |
| Preparation Time | Cooking duration   |
| Cuisine          | Origin type        |

Multiple filters can be active simultaneously.

### Available Sorting

(for the recipes in the category page)

| Sort Option   | Description       |
| ------------- | ----------------- |
| Most Viewed   | By view count     |
| Highest Rated | By average rating |
| Newest        | By creation date  |
| Oldest        | By creation date  |

Only one sorting option can be active at a time.

### Components

| Component          | Purpose                    |
| ------------------ | -------------------------- |
| CategoriesGrid     | Grid layout for categories |
| CategoryCard       | Category preview card      |
| CategoryHeader     | Category title and info    |
| CategoryRecipeGrid | Recipe grid in category    |
| CategoryEmptyState | No recipes in category     |
| CategoryLoading    | Loading state              |
| RecipeCard         | Recipe preview card        |
| FilterBar          | Filter controls            |
| SortDropdown       | Sort selection             |

### Database Collections

- Category
- Recipe

### Data Relationships

```
Category (1) ────────────< Recipe (Many)
```

- One category can contain many recipes
- Every recipe belongs to exactly one category

### Server Actions

| Action                    | Description             |
| ------------------------- | ----------------------- |
| `getCategories()`         | Get all categories      |
| `getFeaturedCategories()` | Get homepage categories |
| `getCategory()`           | Get single category     |
| `getCategoryRecipes()`    | Get category recipes    |

### Business Rules

- Every recipe must belong to exactly one category
- A recipe cannot exist without a category
- One category can contain multiple recipes
- Only published recipes are displayed
- Recipe count is updated automatically
- Filters apply only to recipes within the selected category
- Sorting is applied after filtering
- Users can combine multiple filters
- Only one sorting option can be active at a time
- Featured categories are displayed on the homepage according to their Featured Order
- Categories without a Featured Order do not appear on the homepage
- Empty categories display an empty state instead of an empty recipe grid
- Categories are displayed alphabetically on the Categories page by default

### Empty State

If a category contains no published recipes:

> "No recipes are available in this category yet."

### Dependencies

- MongoDB
- Mongoose
- Next.js Server Actions

### Future Enhancements

- Category Icons
- Category Banner Images
- Popular Recipes
- Recently Added Recipes
- Category SEO Metadata
- Nested Categories
- Category Analytics

---

## 4. Recipe Search

### Overview

Recipe Search enables users to quickly discover published recipes by searching their titles.

The feature provides real-time search suggestions in the global search bar and a dedicated search results page.

### Purpose

Help users quickly find recipes without manually browsing categories or applying filters.

### User Roles

- Guest
- Registered User

### User Capabilities

- Search recipes by title
- View live search suggestions
- View recipe thumbnails
- View recipe ratings
- View recipe categories
- Open recipe details
- View all search results
- Clear the current search query
- Search again from the results page

### Pages

| Page           | Path      | Description          |
| -------------- | --------- | -------------------- |
| Global Search  | Header    | Search bar in header |
| Search Results | `/search` | Full search results  |

### Search Scope

**Version 1:**

- Recipe Title

**Future Versions:**

- Ingredients
- Categories
- Cuisine
- Author
- Tags

### Search Suggestions

After 3 letters typed, a dropdown appears with:

| Element            | Description       |
| ------------------ | ----------------- |
| Cover Image        | Recipe thumbnail  |
| Recipe Title       | Recipe name       |
| Category           | Recipe category   |
| Average Rating     | Rating display    |
| View Recipe Button | Quick access link |

**Maximum suggestions displayed:** 5

**Bottom of dropdown:** "View All Results" link

### Search Results Page

Displays:

- Search Input
- Search Keyword
- Matching Recipe Cards
- Empty State (if no recipes found)

Users can modify the search query without leaving the page.

### URL Structure

```
/search?q=pasta
```

Examples:

- `/search?q=کیک`
- `/search?q=سوپ`
- `/search?q=پاستا`

### Components

| Component            | Purpose               |
| -------------------- | --------------------- |
| SearchBar            | Main search container |
| SearchInput          | Text input field      |
| ClearSearchButton    | Clear query button    |
| SearchDropdown       | Suggestions dropdown  |
| SearchSuggestionItem | Single suggestion     |
| SearchResultsGrid    | Results grid layout   |
| SearchResultCard     | Result preview card   |
| SearchEmptyState     | No results display    |
| SearchLoading        | Loading state         |
| ViewAllResultsButton | See all results       |

### Database Collections

- Recipe
- Category

### Server Actions

| Action                   | Description           |
| ------------------------ | --------------------- |
| `searchRecipes()`        | Perform search        |
| `getSearchSuggestions()` | Get live suggestions  |
| `getSearchResults()`     | Get paginated results |

### Validation Rules

- Search query is optional
- Maximum length: 100 characters
- Leading and trailing spaces are ignored
- Consecutive spaces are reduced to a single space

### Business Rules

- Only published recipes appear in search results
- Search is case-insensitive
- Search supports Persian text
- Search suggestions appear after entering at least three characters
- Maximum of five suggestions are displayed
- Suggestions are ordered by relevance
- Search results are ordered by relevance by default
- Clicking a suggestion opens the recipe details page
- Clicking "View All Results" opens the search results page
- Clearing the search query immediately clears the search results
- The search query remains in the search input after navigating to the results page
- The search page supports browser refresh without losing the search query
- The search page supports direct navigation using URL query parameters

### Empty State

If no recipes match:

> "No recipes were found for your search."

### Dependencies

- MongoDB
- Mongoose
- Next.js Server Actions

### Future Enhancements

- Ingredient Search
- Category Search
- Cuisine Search
- Author Search
- Tag Search
- Search History
- Recent Searches
- Trending Searches
- Typo Tolerance
- Search Highlighting
- Algolia Integration

---

# User Features

## 5. User Profile

### Overview

The User Profile feature represents a user's public identity within Loghmeh.

It allows users to manage their personal information, showcase their published recipes, connect with other users, and share their social media accounts.

### Purpose

Provide a personalized public profile where users can:

- Introduce themselves
- Showcase their recipes
- Build their cooking reputation
- Connect with other members
- Share their social media accounts

### User Roles

- Guest (Read Only)
- Registered User

### User Capabilities

#### Guest

- View public user profiles
- View published recipes
- View follower count
- View following count
- View recipe count
- View social media links

#### Registered User

##### Profile Management

- View own profile
- View other users' profiles
- Edit profile
- Upload avatar
- Replace avatar
- Remove avatar
- Update bio

##### Social Media Management

- Add/Edit/Remove Instagram account
- Add/Edit/Remove Telegram account
- Add/Edit/Remove X (Twitter) account

##### Community

- Follow users
- Unfollow users

### Pages

| Page         | Path                  | Description          |
| ------------ | --------------------- | -------------------- |
| My Profile   | `/profile`            | Current user profile |
| Edit Profile | `/profile/edit`       | Profile editing      |
| User Profile | `/profile/[username]` | Public profile view  |

### Profile Information

| Element           | Description                 |
| ----------------- | --------------------------- |
| Avatar            | Profile picture             |
| Username          | Unique identifier           |
| Full Name         | Display name (optional)     |
| Biography         | User bio                    |
| User Title        | User badge                  |
| User Rate         | Average of all user recipes |
| Recipe Count      | Published recipes           |
| Followers Count   | Followers count             |
| Following Count   | Following count             |
| Social Media      | Social links                |
| Published Recipes | Recipe grid                 |

### Social Media Platforms

| Platform    | Capabilities      |
| ----------- | ----------------- |
| Instagram   | Add, Edit, Remove |
| Telegram    | Add, Edit, Remove |
| X (Twitter) | Add, Edit, Remove |

Each social account is optional and publicly visible.

### Components

| Component          | Purpose                |
| ------------------ | ---------------------- |
| ProfileHeader      | Profile top section    |
| ProfileAvatar      | Avatar display         |
| ProfileInformation | User details           |
| ProfileStatistics  | Recipe/follow counts   |
| ProfileSocialLinks | Social media links     |
| ProfileActions     | Action buttons         |
| EditProfileForm    | Profile editing form   |
| AvatarUploader     | Avatar upload          |
| Bio                | Biography display      |
| FollowButton       | Follow/unfollow toggle |
| RecipeGrid         | User's recipes         |
| RecipeCard         | Recipe preview         |
| EmptyRecipeState   | No recipes display     |

### Database Collections

- User
- Recipe
- Follow

### User Fields

| Field     | Type   | Description        |
| --------- | ------ | ------------------ |
| username  | String | Unique username    |
| email     | String | Email address      |
| image     | String | Avatar URL         |
| bio       | String | User biography     |
| instagram | String | Instagram handle   |
| telegram  | String | Telegram handle    |
| twitter   | String | X (Twitter) handle |

#### Statistics (Calculated)

| Statistic      | Description       |
| -------------- | ----------------- |
| recipeCount    | Published recipes |
| followerCount  | Total followers   |
| followingCount | Total following   |

### Server Actions

| Action                | Description         |
| --------------------- | ------------------- |
| `getProfile()`        | Get user profile    |
| `updateProfile()`     | Update profile data |
| `uploadAvatar()`      | Upload avatar       |
| `deleteAvatar()`      | Remove avatar       |
| `updateSocialLinks()` | Update social media |
| `followUser()`        | Follow a user       |
| `unfollowUser()`      | Unfollow a user     |
| `getUserRecipes()`    | Get user's recipes  |

### Validation Rules

#### Bio

- Maximum 500 characters

#### Avatar

- Image only
- Maximum file size: 5 MB

#### Social Links

- Valid username or URL for each platform

### Business Rules

- Every registered user owns exactly one profile
- Usernames are unique and cannot be changed
- Users can edit only their own profile
- Profile picture and biography are optional
- Users may provide one account per supported platform
- Social media links are publicly visible
- Every published recipe appears automatically on its author's profile
- Draft recipes are never displayed on public profiles
- Recipe count includes only published recipes
- Follower and following counts are updated automatically
- Guests can view only public profile information

### Dependencies

- Auth.js
- MongoDB
- Mongoose
- UploadThing
- React Hook Form
- Zod

### Future Enhancements

- Cover Photo
- Verified Badge
- Favorite Cuisine
- Cooking Level
- Personal Website
- Location
- Joined Date
- Achievements
- Recipe Collections
- Pinned Recipes

---

## 6. Bookmarks

### Overview

The Bookmarks feature allows registered users to save recipes for quick access and future reference.

Users can bookmark or remove bookmarks directly from recipe cards or the recipe details page.

### Purpose

Provide users with a personal collection of favorite recipes that can be accessed anytime.

### User Roles

- Registered User (Guests can browse but cannot bookmark)

### User Capabilities

- Bookmark a recipe
- Remove a bookmarked recipe
- View bookmarked recipes
- Open bookmarked recipe details

### Pages

| Page      | Path         | Description   |
| --------- | ------------ | ------------- |
| Bookmarks | `/bookmarks` | Saved recipes |

### Bookmark Sources

Users can bookmark from:

- Recipe Card
- Recipe Details Page

### Components

| Component          | Purpose         |
| ------------------ | --------------- |
| BookmarksGrid      | Grid layout     |
| BookmarkButton     | Bookmark toggle |
| BookmarkCard       | Recipe preview  |
| BookmarkEmptyState | No bookmarks    |
| RecipeCard         | Recipe preview  |

### Database Collections

- User
- Recipe
- Bookmark

### Data Relationships

```
User (1) ────────────< Bookmark >──────────── Recipe (1)
```

- One user can bookmark many recipes
- One recipe can be bookmarked by many users

### Server Actions

| Action             | Description           |
| ------------------ | --------------------- |
| `getBookmarks()`   | Get user bookmarks    |
| `addBookmark()`    | Add bookmark          |
| `removeBookmark()` | Remove bookmark       |
| `isBookmarked()`   | Check bookmark status |

### Business Rules

- Only authenticated users can bookmark recipes
- A user can bookmark a recipe only once
- Bookmark status updates immediately after user interaction
- Bookmarks are private and visible only to their owner
- Removing a bookmark never affects the recipe itself
- stats.bookmarkCount is automatically updated

### Empty State

> "You haven't bookmarked any recipes yet."

### Dependencies

- Auth.js
- MongoDB
- Mongoose
- Next.js Server Actions

### Future Enhancements

- Bookmark Collections
- Bookmark Folders
- Export Bookmarks
- Share Bookmark Collections
- Recently Bookmarked

---

## 7. Ratings

### Overview

The Ratings feature allows authenticated users to rate recipes.

Each recipe has an average rating calculated from all submitted ratings.

Each user also has an overall rating from the average of all their published recipes.

### Purpose

Enable users to evaluate recipe quality and help others discover highly-rated recipes.

### User Roles

- Guest (View Only)
- Registered User

### User Capabilities

#### Guest

- View recipe ratings
- View recipe rating count
- View user ratings

#### Registered User

- Rate a recipe
- Update previous rating
- View recipe/user ratings

### Recipe Statistics

| Statistic           | Description       |
| ------------------- | ----------------- |
| stats.averageRating | Mean rating value |
| stats.ratingCount   | Total ratings     |

**Display format:** `⭐ 4.8 (152)`

### User Statistics

| Statistic           | Description                             |
| ------------------- | --------------------------------------- |
| stats.averageRating | Average of all published recipe ratings |

**Display format:** `⭐ 4.7`

### Statistics Updates

After each rating, system updates:

- Recipe: stats.averageRating, stats.ratingCount
- Author: stats.averageRating

### Business Rules

- Only authenticated users can rate recipes
- Users cannot rate their own recipes
- Submitting another rating updates the previous rating
- Rating values: integers between 1 and 5
- An author's rating is calculated from all published recipes
- Ratings are recalculated automatically after every update

### Validation Rules

| Rule     | Value   |
| -------- | ------- |
| Required | Yes     |
| Type     | Integer |
| Minimum  | 1       |
| Maximum  | 5       |

### Empty State

> "This recipe has not been rated yet."

### Future Enhancements

- Rating History
- Top Rated Recipes/Authors
- Rating Distribution
- Weighted Rating Algorithm

---

## 8. Comments

### Overview

The Comments feature allows authenticated users to share opinions and feedback on recipes.

All users can read comments, while authenticated users can interact by posting, liking, or disliking.

Recipe owners can reply to comments.

### Purpose

Enable community interaction and feedback on recipes.

### User Roles

- Guest (View Only)
- Registered User
- Recipe Owner

### User Capabilities

#### Guest

- View recipe comments
- View comment replies
- View comment reactions

#### Registered User

- Add a comment
- Like/dislike a comment
- Change/remove reaction

#### Recipe Owner

- Reply to comments

### Comment Display

| Element         | Description      |
| --------------- | ---------------- |
| User Avatar     | Commenter avatar |
| Username        | Commenter name   |
| User Title      | User badge       |
| Comment Content | Comment text     |
| Created Date    | Timestamp        |
| Like Count      | Total likes      |
| Dislike Count   | Total dislikes   |
| Reply Count     | Total replies    |
| Replies         | Nested replies   |

Comments displayed in chronological order (newest first).

### User Titles

| Title        | Description          |
| ------------ | -------------------- |
| User         | Default title        |
| Chef         | Cooking professional |
| Master Chef  | Expert chef          |
| Barista      | Coffee specialist    |
| Food Blogger | Food content creator |

### Components

| Component       | Purpose            |
| --------------- | ------------------ |
| CommentSection  | Comments container |
| CommentList     | Comments list      |
| CommentCard     | Single comment     |
| CommentForm     | Comment input      |
| CommentReaction | Reaction buttons   |

### Database Collections

- User
- Recipe
- Comment
- CommentReaction

### Comment Structure

| Field         | Type     | Description        |
| ------------- | -------- | ------------------ |
| content       | String   | Comment text       |
| author        | ObjectId | User who created   |
| recipe        | ObjectId | Associated recipe  |
| parentComment | ObjectId | Parent (optional)  |
| createdAt     | Date     | Creation timestamp |
| updatedAt     | Date     | Update timestamp   |

### Server Actions

| Action                    | Description          |
| ------------------------- | -------------------- |
| `getRecipeComments()`     | Get recipe comments  |
| `createComment()`         | Create comment/reply |
| `likeComment()`           | Like a comment       |
| `dislikeComment()`        | Dislike a comment    |
| `removeCommentReaction()` | Remove reaction      |

### Validation Rules

| Rule           | Value           |
| -------------- | --------------- |
| Required       | Yes             |
| Minimum Length | 1 character     |
| Maximum Length | 1000 characters |

### Business Rules

- Only authenticated users can create comments
- Empty comments are not allowed
- Only the recipe owner can reply to comments
- A user can either like or dislike a comment (not both)
- Comment statistics updated automatically
- Comments displayed chronologically

### Empty State

> "Be the first to share your thoughts about this recipe."

### Future Enhancements

- Edit/Delete Own Comment
- Report Comment
- Mention Users
- Pin Comments
- Markdown Support

---

# Social Features

## 9. Following System

### Overview

The Following System allows authenticated users to follow or unfollow other users.

Following helps users discover recipes from favorite creators and build a personalized cooking community.

### Purpose

Enable users to build their cooking community and discover content from favorite creators.

### User Roles

- Guest (View Only)
- Registered User

### User Capabilities

#### Guest

- View public profiles
- View follower/following counts
- View recipes by other users

#### Registered User

- Follow/unfollow other users
- View followers list
- View following list
- View recipes from followed users on Home page

### Pages

| Page      | Path                            | Description      |
| --------- | ------------------------------- | ---------------- |
| Followers | `/profile/[username]/followers` | User's followers |
| Following | `/profile/[username]/following` | User's following |

### User Statistics

| Statistic            | Description     |
| -------------------- | --------------- |
| stats.followerCount  | Total followers |
| stats.followingCount | Total following |

### Components

| Component     | Purpose                |
| ------------- | ---------------------- |
| FollowButton  | Follow/unfollow toggle |
| FollowersList | Followers display      |
| FollowingList | Following display      |
| UserCard      | User preview card      |

### Database Collections

- User
- Follow

### Follow Structure

| Field     | Type     | Description         |
| --------- | -------- | ------------------- |
| follower  | ObjectId | User who follows    |
| following | ObjectId | User being followed |
| createdAt | Date     | Follow date         |

### Server Actions

| Action               | Description                 |
| -------------------- | --------------------------- |
| `followUser()`       | Follow a user               |
| `unfollowUser()`     | Unfollow a user             |
| `getFollowers()`     | Get user's followers        |
| `getFollowing()`     | Get user's following        |
| `getFollowingFeed()` | Get followed users' recipes |

### Business Rules

- Only authenticated users can follow others
- A user cannot follow themselves
- A follow relationship must be unique
- Following updates follower/following counts automatically
- Only profile owner can access their Followers/Following pages
- Home feed shows recipes from followed users (newest first)

### Empty States

**Followers:** "You don't have any followers yet."

**Following:** "You're not following anyone yet."

**Home Feed:** "Follow your favorite cooks to see their latest recipes here."

### Future Enhancements

- Suggested Users
- Mutual Followers
- Block Users
- Private Profiles
- Verified Creators

---

## 10. Notifications

### Overview

The Notifications feature keeps authenticated users informed about important activities related to their recipes, comments, and the platform.

Notifications are generated automatically when specific events occur.

### Purpose

Keep users informed about interactions with their content without manual checking.

### User Roles

- Guest (No access)
- Registered User

### User Capabilities

- View all notifications
- Open a notification
- Delete a notification
- See unread notifications
- Receive platform announcements

### Notification Types

| Type                | Description                          |
| ------------------- | ------------------------------------ |
| Recipe Rating       | Someone rated your recipe            |
| Recipe Comment      | Someone commented on your recipe     |
| Comment Like        | Someone liked your comment           |
| Comment Dislike     | Someone disliked your comment        |
| Comment Reply       | Recipe owner replied to your comment |
| System Announcement | Platform-wide announcements          |

### Pages

| Page          | Path             | Description       |
| ------------- | ---------------- | ----------------- |
| Notifications | `/notifications` | All notifications |

### Notification Structure

| Field          | Type     | Description                |
| -------------- | -------- | -------------------------- |
| recipient      | ObjectId | Notification owner         |
| type           | Enum     | Notification type          |
| title          | String   | Notification title         |
| message        | String   | Notification message       |
| relatedRecipe  | ObjectId | Related recipe (optional)  |
| relatedComment | ObjectId | Related comment (optional) |
| read           | Boolean  | Read status                |
| createdAt      | Date     | Creation date              |

### Components

| Component         | Purpose             |
| ----------------- | ------------------- |
| NotificationsList | Notifications list  |
| NotificationItem  | Single notification |
| UnreadBadge       | Unread indicator    |

### Database Collections

- Notification
- User

### Server Actions

| Action                         | Description            |
| ------------------------------ | ---------------------- |
| `getNotifications()`           | Get user notifications |
| `markNotificationAsRead()`     | Mark as read           |
| `deleteNotification()`         | Remove notification    |
| `getUnreadNotificationCount()` | Count unread           |

### Business Rules

- Only authenticated users receive notifications
- Notifications created automatically by system
- Opening a notification marks it as read
- Users may delete their own notifications
- Recipe owners notified for ratings/comments
- Comment authors notified for likes/dislikes/replies
- Unread badge updated automatically

### Empty State

> "You don't have any notifications yet."

### Future Enhancements

- Push Notifications
- Email Notifications
- Real-time Notifications
- Notification Preferences
- Mark All as Read

---

# Support Features

## 11. Support Tickets

### Overview

The Support Tickets feature allows authenticated users to contact the Loghmeh support team by submitting messages directly from the application.

### Purpose

Provide users with a direct channel for reporting problems, asking questions, or providing feedback.

### User Roles

- Guest (View only)
- Registered User

### User Capabilities

#### Guest

- View Support page
- Cannot submit tickets

#### Registered User

- Submit support ticket
- View confirmation
- Rate support experience
  ( In notifications that are sent by admins during solving the ticket )

### Pages

| Page    | Path       | Description  |
| ------- | ---------- | ------------ |
| Support | `/support` | Support form |

### Ticket Status

| Status      | Description    |
| ----------- | -------------- |
| Open        | New ticket     |
| In Progress | Being handled  |
| Resolved    | Issue resolved |
| Closed      | Ticket closed  |

### Ticket Structure

| Field     | Type     | Description               |
| --------- | -------- | ------------------------- |
| user      | ObjectId | Ticket owner              |
| message   | String   | Ticket content            |
| status    | Enum     | Ticket status             |
| rating    | Number   | Support rating (optional) |
| createdAt | Date     | Creation date             |
| updatedAt | Date     | Update date               |

### Components

| Component           | Purpose           |
| ------------------- | ----------------- |
| SupportForm         | Ticket submission |
| SupportMessageInput | Message input     |
| SubmitButton        | Submit action     |

### Server Actions

| Action                    | Description      |
| ------------------------- | ---------------- |
| `createSupportTicket()`   | Create ticket    |
| `getUserSupportTickets()` | Get user tickets |
| `rateSupportExperience()` | Rate support     |

### Business Rules

- Only authenticated users can submit tickets
- Every ticket belongs to one user
- Ticket status managed by administrators
- Users cannot edit or delete submitted tickets
- Support rating can be updated in every ticket notification before its close
- Users notified when ticket updated

### Empty State

> "Need help? Send us a message and our support team will get back to you."

### Future Enhancements

- Ticket Conversation Thread
- File Attachments
- Ticket Categories
- Priority Levels
- Live Chat Support

---

## 12. Settings

### Overview

The Settings feature allows authenticated users to manage their account preferences and application settings.

### Purpose

Provide users with control over their account, profile, and privacy settings.

### User Roles

- Registered User only

### User Capabilities

- Update profile information
- Change password
- Manage privacy settings
- Log out

### Pages

| Page     | Path        | Description      |
| -------- | ----------- | ---------------- |
| Settings | `/settings` | Account settings |

### Settings Sections

| Section  | Description                             |
| -------- | --------------------------------------- |
| Profile  | Name, username, bio, avatar             |
| Password | Current password, new password          |
| Privacy  | Social links visibility, bio visibility |

### Components

| Component           | Purpose            |
| ------------------- | ------------------ |
| SettingsPage        | Settings container |
| ProfileSettingsForm | Profile editing    |
| PasswordForm        | Password change    |
| PrivacySettings     | Privacy controls   |
| LogoutButton        | Sign out           |

### Server Actions

| Action                    | Description     |
| ------------------------- | --------------- |
| `updateProfile()`         | Update profile  |
| `changePassword()`        | Change password |
| `updatePrivacySettings()` | Update privacy  |
| `logout()`                | Sign out        |

### Business Rules

- Only authenticated users can access Settings
- Users may only modify their own settings
- Username uniqueness enforced
- Password changes require current password
- Logout invalidates current session

### Future Enhancements

- Language Selection
- Theme (Light/Dark/System)
- Delete Account
- Download Personal Data
- Two-Factor Authentication
- Active Sessions Management

---

# Discovery Features

## 13. Home Feed

### Overview

The Home Feed is the main discovery page of the application.

It presents recipes, categories, and creators in multiple curated sections.

### Purpose

Provide an engaging entry point for users to discover popular content and recipes from followed users.

### User Roles

- Guest
- Registered User

### User Capabilities

#### Guest

- View all public sections
- Browse recipes and categories
- View popular chefs
- Open full pages

#### Registered User

- All guest capabilities
- View following feed

### Feed Sections

| Section              | Description                             |
| -------------------- | --------------------------------------- |
| Popular Categories   | Featured categories                     |
| Popular Recipes      | Top recipes                             |
| Following Feed       | Recipes from followed users (auth only) |
| Popular Chefs        | Top-rated creators                      |
| Popular Light Meals  | Top light meal recipes                  |
| Popular Main Courses | Top main course recipes                 |
| Popular Desserts     | Top dessert recipes                     |

### Section Components

Each section contains:

- Section header with title
- Horizontal scrolling carousel
- "See More" button for full page

### Components

| Component          | Purpose           |
| ------------------ | ----------------- |
| HomeFeed           | Feed container    |
| SectionHeader      | Section title     |
| HorizontalCarousel | Horizontal scroll |
| RecipeCard         | Recipe preview    |
| CategoryCard       | Category preview  |
| UserCard           | User preview      |
| SeeMoreButton      | Navigation button |

### Database Collections

- Recipe
- Category
- User
- Follow

### Server Actions

| Action                    | Description                 |
| ------------------------- | --------------------------- |
| `getPopularCategories()`  | Get featured categories     |
| `getPopularRecipes()`     | Get top recipes             |
| `getPopularChefs()`       | Get top creators            |
| `getPopularLightMeals()`  | Get light meal recipes      |
| `getPopularMainCourses()` | Get main course recipes     |
| `getPopularDesserts()`    | Get dessert recipes         |
| `getFollowingFeed()`      | Get followed users' recipes |

### Business Rules

- Home Feed publicly accessible
- All sections displayed independently
- Each section supports horizontal scrolling
- Following Feed only for authenticated users
- Only published recipes appear
- Popular recipes ordered by popularity
- Popular chefs ordered by rating

### Empty States

**Following Feed:** "Follow your favorite cooks to see their latest recipes here."

**Popular Categories:** "No categories available."

**Popular Recipes:** "No recipes available."

**Popular Chefs:** "No creators available."

### Future Enhancements

- Personalized Recommendations
- Recently Viewed Recipes
- Trending Recipes
- Seasonal Collections
- Featured Creators
- Editor's Picks
- AI Recipe Recommendations

---

# Appendix

## Error States

All features share common error states:

- User is not authenticated (for protected actions)
- Resource not found
- Validation errors
- Network/server errors
- Unauthorized access

## Loading States

All features implement loading states for:

- Initial data fetching
- Form submissions
- Pagination
- Search operations

## Accessibility

All features follow WCAG requirements:

- Keyboard navigation
- Screen reader support
- Color contrast
- Focus management
- Error announcements

## Responsive Design

All features support:

- Desktop
- Tablet
- Mobile

## Performance Goals

- Fast initial load
- Optimized images
- Efficient queries
- Minimal re-renders
- Lazy loading where appropriate

---

_Document Version: 1.0_
_Last Updated: July 2026_
