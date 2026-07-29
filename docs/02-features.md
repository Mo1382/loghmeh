# Features

This document describes all functional features of the Loqmeh application.

Each feature includes its purpose, capabilities, dependencies, business rules, and implementation requirements.

---

# Feature Index

1. Authentication
2. User Profile
3. Recipes
4. Recipe Search
5. Categories
6. Bookmarks
7. Ratings
8. Comments
9. Following System
10. Notifications
11. Support Tickets
12. Settings
13. Home Feed

---

# Authentication

## Overview

The Authentication feature allows users to securely create an account, verify their email address, sign in, sign out, and manage their password.

Email verification is required during registration and password reset using a one-time verification code (OTP) sent to the user's email address.

Authentication is implemented using Auth.js.

---

## Purpose

Provide a secure authentication system while ensuring that every registered account belongs to a valid email owner.

---

## User Roles

- Guest
- Registered User

---

## User Capabilities

### Guest

- Register
- Verify Email
- Sign In
- Request Password Reset
- Verify Reset Code
- Reset Password

### Registered User

- Sign Out
- Change Password

---

## Authentication Flow

### Registration

1. User submits the registration form.
2. The system validates all input.
3. A verification code is sent to the user's email.
4. The user enters the verification code.
5. The system verifies the code.
6. The account becomes active.
7. The user is automatically signed in.

---

### Login

1. User enters email (or username) and password.
2. Credentials are validated.
3. A session is created.
4. User is redirected to the application.

---

### Forgot Password

1. User enters their email address.
2. A verification code is sent to the email.
3. User enters the verification code.
4. User chooses a new password.
5. Password is updated.
6. User is redirected to the login page.

---

### Change Password

1. User enters their current password.
2. User enters a new password.
3. A verification code is sent to the registered email.
4. User enters the verification code.
5. Password is updated successfully.

---

## Pages

- /login
- /register
- /verify-email
- /forgot-password
- /verify-reset-code
- /reset-password
- /change-password

---

## Components

- LoginForm
- RegisterForm
- PasswordInput
- EmailVerificationForm
- OTPInput
- ForgotPasswordForm
- ResetPasswordForm
- ChangePasswordForm
- AuthLayout
- CountdownTimer
- ResendCodeButton

---

## Database Collections

- User
- VerificationCode

---

## User Collection Fields

- username
- email
- password
- image
- emailVerified
- createdAt
- updatedAt

---

## VerificationCode Collection Fields

- email
- code
- purpose
- expiresAt
- createdAt

Purpose values:

- EMAIL_VERIFICATION
- PASSWORD_RESET
- PASSWORD_CHANGE

---

## Server Actions

registerUser()

sendVerificationCode()

verifyEmail()

loginUser()

logoutUser()

requestPasswordReset()

verifyResetCode()

resetPassword()

requestPasswordChange()

verifyPasswordChange()

changePassword()

---

## Validation

### Registration

Required

- username
- email
- password

Rules

- username: 3–30 characters
- email: valid email address
- password: minimum 8 characters

---

### Verification Code

- Required
- Numeric
- Fixed length (6 digits)

---

### Login

Required

- email or username
- password

---

### Password Reset

Required

- email
- verification code
- new password

---

### Change Password

Required

- current password
- new password
- verification code

---

## Business Rules

- Every email address must be unique.
- Every username must be unique.
- Passwords must contain at least 8 characters.
- Passwords are stored as hashed values.
- Users cannot sign in until their email has been verified.
- Verification codes expire after 10 minutes.
- Verification codes can only be used once.
- A new verification code invalidates any previous unused code for the same purpose.
- Users may request a new verification code after the resend cooldown expires.
- Verification codes are sent only to the email address associated with the request.
- Password reset requires successful verification of the email code.
- Password change requires verification of both the current password and the email verification code.
- Verification attempts are rate-limited to prevent abuse.
- Failed verification attempts are limited.
- Authentication sessions are invalidated after a password change.

---

## Dependencies

- Auth.js
- MongoDB
- Mongoose
- Zod
- React Hook Form
- Email Service (Resend, Nodemailer, etc.)

---

## Future Enhancements

- Google Sign-In
- GitHub Sign-In
- Passkeys (WebAuthn)
- Two-Factor Authentication (2FA)
- Trusted Devices
- Login Activity History

---

## Priority

Highest

---

## Status

Planned

# User Profile

## Overview

The User Profile feature represents a user's public identity within Loqmeh.

It allows users to manage their personal information, showcase their published recipes, connect with other users, and share their social media accounts.

Every registered user owns exactly one profile.

---

## Purpose

Provide a personalized public profile where users can:

- Introduce themselves
- Showcase their recipes
- Build their cooking reputation
- Connect with other members
- Share their social media accounts

---

## User Roles

- Guest (Read Only)
- Registered User

---

## User Capabilities

### Guest

- View public user profiles
- View published recipes
- View follower count
- View following count
- View recipe count
- View social media links

---

### Registered User

#### Profile

- View own profile
- View other users' profiles
- Edit profile
- Upload avatar
- Replace avatar
- Remove avatar
- Update bio

#### Social Media

- Add Instagram account
- Edit Instagram account
- Remove Instagram account

- Add Telegram account
- Edit Telegram account
- Remove Telegram account

- Add X (Twitter) account
- Edit X (Twitter) account
- Remove X (Twitter) account

#### Community

- Follow users
- Unfollow users

---

## Pages

- /profile
- /profile/edit
- /profile/[username]

---

## Profile Information

A profile displays:

- Avatar
- Username
- Full Name (Optional)
- Biography
- Recipe Count
- Followers Count
- Following Count
- Social Media Accounts
- Published Recipes

---

## Social Media

Supported platforms:

- Instagram
- Telegram
- X (Twitter)

Each social account is optional.

Users may:

- Add
- Edit
- Remove

Other users can view all public social links.

---

## Components

ProfileHeader

ProfileAvatar

ProfileInformation

ProfileStatistics

ProfileSocialLinks

ProfileActions

EditProfileForm

AvatarUploader

Bio

FollowButton

RecipeGrid

RecipeCard

EmptyRecipeState

---

## Database Collections

User

Recipe

Follow

---

## User Fields

- username
- email
- image
- bio

Social Links

- instagram
- telegram
- twitter

Statistics (Calculated)

- recipeCount
- followerCount
- followingCount

---

## Server Actions

getProfile()

updateProfile()

uploadAvatar()

deleteAvatar()

updateSocialLinks()

followUser()

unfollowUser()

getUserRecipes()

---

## Validation

### Bio

- Maximum 500 characters

### Avatar

- Image only
- Maximum file size: 5 MB

### Social Links

Instagram

- Valid username or URL

Telegram

- Valid username or URL

X (Twitter)

- Valid username or URL

---

## Business Rules

- Every registered user owns exactly one profile.
- Usernames are unique.
- Usernames cannot be changed.
- Users can edit only their own profile.
- Profile picture is optional.
- Biography is optional.
- Social media links are optional.
- Users may provide one account per supported platform.
- Users can add, update, or remove their social media accounts at any time.
- Social media links are publicly visible.
- Every published recipe appears automatically on its author's profile.
- Draft recipes are never displayed on public profiles.
- Recipe count includes only published recipes.
- Follower and following counts are updated automatically.
- Guests can view only public profile information.

---

## Dependencies

- Auth.js
- MongoDB
- Mongoose
- UploadThing
- React Hook Form
- Zod

---

## Future Enhancements

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

## Priority

High

---

## Status

Planned

# Recipes

## Overview

Recipes are the core feature of Loqmeh.

Users can create, publish, discover, search, filter, sort, rate, comment, bookmark, and manage cooking recipes through an intuitive and responsive interface.

Guests can browse public recipes, while authenticated users can fully interact with the recipe ecosystem.

---

## Purpose

Provide a modern and enjoyable recipe-sharing experience where users can easily publish recipes, discover new foods, and interact with the cooking community.

---

## User Roles

- Guest (Read Only)
- Registered User

---

## User Capabilities

### Guest

- Browse published recipes
- View recipe details
- Search recipes
- Filter recipes
- Sort recipes
- View recipe ratings
- View recipe author
- View ingredients
- View preparation steps

---

### Registered User

#### Recipe Management

- Create recipe
- Save recipe as draft
- Publish recipe
- Edit own recipe
- Delete own recipe

#### Images

- Upload cover image
- Replace cover image
- Remove cover image

#### Discovery

- Browse recipes
- Search recipes
- Filter recipes
- Sort recipes

#### Community

- Rate recipes
- Bookmark recipes
- Remove bookmarks
- Comment on recipes

---

## Pages

- /
- /recipes
- /recipes/new
- /recipes/[slug]
- /recipes/[slug]/edit
- /my-recipes

---

## Recipe Information

Each recipe contains:

- Title
- Slug
- Description
- Cover Image
- Gallery (Future)
- Category
- Difficulty
- Cuisine
- Preparation Time
- Servings
- Ingredients
- Preparation Steps
- Author
- Created Date
- Updated Date

#### Recipe Statistics

Each recipe stores the following statistics:

- Average Rating
- Rating Count
- Bookmark Count
- Comment Count
- View Count

---

## Filters

Users can filter recipes by:

- Category
- Main Ingredient
- Difficulty
- Preparation Time
- Cuisine

Filters can be combined.

---

## Sorting

Users can sort recipes by:

- Most Popular
- Highest Rated
- Newest
- Oldest

Only one sorting option can be active at a time.

---

## Search

Users can search recipes by:

- Recipe Title

Future versions:

- Ingredient
- Author
- Tags

---

## Components

RecipeCard

RecipeGrid

RecipeForm

RecipeImageUploader

RecipeHeader

RecipeInformation

RecipeActions

RecipeAuthor

IngredientList

IngredientItem

PreparationSteps

StepItem

RecipeRating

RecipeBookmarkButton

RecipeSearchBar

RecipeFilters

RecipeSorting

EmptyRecipeState

RecipeComments

CommentList

CommentCard

CommentForm

---

## Database Collections

- Recipe
- Category
- User
- Rating
- Bookmark
- Comment

---

## Recipe Status

- Draft
- Published

---

## Recipe Fields

- title
- slug
- description
- coverImage
- category
- cuisine
- difficulty
- preparationTime
- servings
- ingredients
- steps
- author
- stats
- status
- createdAt
- updatedAt

---

## Server Actions

createRecipe()

updateRecipe()

deleteRecipe()

publishRecipe()

saveDraft()

getRecipe()

getRecipes()

getUserRecipes()

searchRecipes()

filterRecipes()

sortRecipes()

uploadRecipeImage()

deleteRecipeImage()

rateRecipe()

bookmarkRecipe()

removeBookmark()

addComment()

deleteComment()

getRecipeComments()

---

## Validation

### Required

- Title
- Cover Image
- Category
- Difficulty
- Preparation Time
- Servings
- At least one ingredient
- At least one preparation step

---

### Optional

- Description
- Cuisine

---

### Ingredients

Each ingredient must contain:

- Name
- Quantity
- Unit

---

### Preparation Steps

- Minimum one step
- Maximum 1000 characters per step

---

## Business Rules

- Only authenticated users can create recipes.
- Recipes are saved as Draft by default.
- Draft recipes are visible only to their author.
- Only the recipe owner can edit a recipe.
- Only the recipe owner can delete a recipe.
- Every recipe must belong to exactly one category.
- Every recipe must contain at least one ingredient.
- Every recipe must contain at least one preparation step.
- Every published recipe must have a unique slug.
- Cover image is required.
- Images must be valid image files.
- Soft delete must be used when deleting recipes.
- Guests cannot create, edit, delete, bookmark, or rate recipes.
- Registered users can bookmark any published recipe except their own.
- A user can rate a recipe only once.
- Users may update their rating at any time.
- Recipe ratings are automatically recalculated after each new or updated rating.
- Users can apply multiple filters simultaneously.
- Only one sorting option can be active at a time.
- Search results include only published recipes.
- Recipes are visible on the author's public profile only after publication.
- Only authenticated users can post comments.
- Guests can read comments but cannot create comments.
- Users can delete only their own comments.
- Empty comments are not allowed.
- Each comment must belong to exactly one recipe.
- Comments are displayed in chronological order (oldest first).

---

## Dependencies

- MongoDB
- Mongoose
- Auth.js
- UploadThing
- React Hook Form
- Zod
- date-fns

---

## Future Enhancements

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

## Priority

Highest

---

## Status

Planned

# Recipe Search

## Overview

Recipe Search enables users to quickly discover published recipes by searching their titles.

The feature provides real-time search suggestions in the global search bar and a dedicated search results page.

---

## Purpose

Help users quickly find recipes without manually browsing categories or applying filters.

---

## User Roles

- Guest
- Registered User

---

## User Capabilities

- Search recipes by title
- View live search suggestions
- View recipe thumbnails
- View recipe ratings
- View recipe categories
- Open recipe details
- View all search results
- Clear the current search query
- Search again from the results page

---

## Pages

- Global Header Search
- /search

---

## Search Scope

Version 1

Search is performed only on:

- Recipe Title

Future Versions

- Ingredients
- Categories
- Cuisine
- Author
- Tags

---

## Search Suggestions

While typing after 3 letters typed, a dropdown appears below the search input.

Each suggestion displays:

- Cover Image
- Recipe Title
- Category
- Average Rating
- View Recipe button

Maximum suggestions displayed:

- 5

At the bottom of the dropdown:

- View All Results

---

## Search Results Page

Displays

- Search Input
- Search Keyword
- Matching Recipe Cards
- Empty State (if no recipes found)

Users can modify the search query without leaving the page.

---

## Empty State

If no recipes match the search query, the application displays:

- Empty illustration
- Informative message

Example message:

"No recipes were found for your search."

---

## Components

SearchBar

SearchInput

ClearSearchButton

SearchDropdown

SearchSuggestionItem

SearchResultsGrid

SearchResultCard

SearchEmptyState

SearchLoading

ViewAllResultsButton

---

## Database Collections

- Recipe
- Category

---

## Server Actions

searchRecipes()

getSearchSuggestions()

getSearchResults()

---

## Validation

- Search query is optional.
- Maximum length: 100 characters.
- Leading and trailing spaces are ignored.
- Consecutive spaces are reduced to a single space.

---

## Business Rules

- Only published recipes appear in search results.
- Draft recipes are never searchable.
- Search is case-insensitive.
- Search supports Persian text.
- Search suggestions appear after entering at least three character.
- A maximum of five suggestions are displayed.
- Suggestions are ordered by relevance.
- Search results are ordered by relevance by default.
- Clicking a suggestion opens the recipe details page.
- Clicking "View All Results" opens the search results page.
- Clearing the search query immediately clears the search results.
- The search query remains in the search input after navigating to the results page.
- The search page supports browser refresh without losing the search query.
- The search page supports direct navigation using URL query parameters.

---

## URL Structure

/search?q=pasta

Examples

/search?q=کیک

/search?q=سوپ

/search?q=پاستا

---

## Dependencies

- MongoDB
- Mongoose
- Next.js Server Actions

---

## Future Enhancements

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

## Priority

High

---

## Status

Planned

# Categories

## Overview

The Categories feature allows users to browse all available recipe categories and discover recipes organized by category.

Each category has its own dedicated page displaying recipes that belong to it. Users can filter and sort recipes within the selected category.

The homepage also showcases featured categories to help users quickly discover popular recipe collections.

---

## Purpose

Provide a structured and intuitive way for users to explore recipes based on their interests.

---

## User Roles

- Guest
- Registered User

---

## User Capabilities

- View all categories
- Open a category
- Browse recipes within a category
- Filter recipes
- Sort recipes
- Open recipe details

---

## Pages

- /categories
- /categories/[slug]

---

## Category Information

Each category contains:

- Name
- Slug
- Description (Optional)
- Cover Image
- Recipe Count
- Featured Order (Optional)
- Created Date

---

## Categories Page

Displays all available categories.

Each category card contains:

- Cover Image
- Category Name
- Recipe Count

Clicking a category navigates to its dedicated page.

---

## Category Details Page

Displays:

- Category Name
- Total Recipes
- Recipe Grid

Users can:

- Filter recipes
- Sort recipes
- Open recipe details

---

## Homepage Integration

The homepage displays featured categories.

Featured categories are determined by the **Featured Order** field.

Categories without a Featured Order are not displayed on the homepage.

---

## Available Filters

Users can filter recipes by:

- Main Ingredient
- Difficulty
- Preparation Time
- Cuisine (Origin)

Multiple filters can be active simultaneously.

---

## Available Sorting

Users can sort recipes by:

- Most Viewed
- Highest Rated
- Newest
- Oldest

Only one sorting option can be active at a time.

---

## Components

CategoriesGrid

CategoryCard

CategoryHeader

CategoryRecipeGrid

CategoryEmptyState

CategoryLoading

RecipeCard

FilterBar

SortDropdown

---

## Database Collections

- Category
- Recipe

---

## Data Relationships

Category (1) ────────────< Recipe (Many)

- One category can contain many recipes.
- Every recipe belongs to exactly one category.

---

## Server Actions

getCategories()

getFeaturedCategories()

getCategory()

getCategoryRecipes()

---

## Validation

- Category slug must exist.
- Invalid category slugs return a 404 page.

---

## Business Rules

- Every recipe must belong to exactly one category.
- A recipe cannot exist without a category.
- One category can contain multiple recipes.
- Only published recipes are displayed.
- Recipe count is updated automatically.
- Filters apply only to recipes within the selected category.
- Sorting is applied after filtering.
- Users can combine multiple filters.
- Only one sorting option can be active at a time.
- Featured categories are displayed on the homepage according to their Featured Order.
- Categories without a Featured Order do not appear on the homepage.
- Empty categories display an empty state instead of an empty recipe grid.
- Categories are displayed alphabetically on the Categories page by default.

---

## Empty State

If a category contains no published recipes, the application displays:

"No recipes are available in this category yet."

---

## Dependencies

- MongoDB
- Mongoose
- Next.js Server Actions

---

## Future Enhancements

- Category Icons
- Category Banner Images
- Popular Recipes
- Recently Added Recipes
- Category SEO Metadata
- Nested Categories
- Category Analytics

---

## Priority

High

---

## Status

Planned

# Bookmarks

## Overview

The Bookmarks feature allows registered users to save recipes for quick access and future reference.

Users can bookmark or remove bookmarks directly from recipe cards or the recipe details page.

All bookmarked recipes are accessible through a dedicated bookmarks page.

---

## Purpose

Provide users with a personal collection of favorite recipes that can be accessed anytime.

---

## User Roles

- Registered User

Guests can browse recipes but cannot create bookmarks.

---

## User Capabilities

- Bookmark a recipe
- Remove a bookmarked recipe
- View bookmarked recipes
- Open bookmarked recipe details

---

## Pages

- /bookmarks

---

## Bookmark Sources

Users can bookmark or remove bookmarks from:

- Recipe Card
- Recipe Details Page

The bookmark button always reflects the current bookmark status.

---

## Bookmarks Page

Displays:

- Total Bookmarked Recipes
- Recipe Grid

Users can:

- Open recipe details
- Remove bookmarks

---

## Components

BookmarksGrid

BookmarkButton

BookmarkToggle

BookmarkCard

BookmarkEmptyState

BookmarkLoading

RecipeCard

---

## Database Collections

- User
- Recipe
- Bookmark

---

## Data Relationships

User (1) ────────────< Bookmark >──────────── Recipe (1)

- One user can bookmark many recipes.
- One recipe can be bookmarked by many users.
- A bookmark belongs to exactly one user.
- A bookmark belongs to exactly one recipe.

---

## Recipe Statistics

The Bookmarks feature updates the following recipe statistic:

- stats.bookmarkCount

Recipe statistics are managed automatically by the system.

---

## Server Actions

getBookmarks()

addBookmark()

removeBookmark()

isBookmarked()

---

## Validation

- User must be authenticated.
- The recipe must exist.
- Duplicate bookmarks are not allowed.

---

## Business Rules

- Only authenticated users can bookmark recipes.
- Guests cannot bookmark recipes.
- A user can bookmark a recipe only once.
- Clicking the bookmark button on a non-bookmarked recipe creates a bookmark.
- Clicking the bookmark button on a bookmarked recipe removes the bookmark.
- Bookmark status updates immediately after user interaction.
- Bookmarks are private and visible only to their owner.
- Removing a bookmark never affects the recipe itself.
- stats.bookmarkCount is automatically updated whenever a bookmark is added or removed.
- stats.bookmarkCount represents the total number of users who have bookmarked the recipe.
- Recipe statistics are managed exclusively by the system.
- Users cannot directly modify recipe statistics.

---

## Empty State

If the user has no bookmarked recipes, the application displays:

"You haven't bookmarked any recipes yet."

---

## Dependencies

- Auth.js
- MongoDB
- Mongoose
- Next.js Server Actions

---

## Future Enhancements

- Bookmark Collections
- Bookmark Folders
- Most Bookmarked Recipes
- Export Bookmarks
- Share Bookmark Collections
- Recently Bookmarked
- Offline Bookmarks

---

## Priority

High

---

## Status

Planned

# Ratings

## Overview

The Ratings feature allows authenticated users to rate recipes.

Each recipe has an average rating calculated from all submitted ratings.

Each user also has an overall rating, calculated from the average ratings of all published recipes they have created.

Recipe and user statistics are managed automatically by the system.

---

## User Stories

As a guest, I can:

- View recipe ratings.
- View recipe rating count.
- View user ratings.

As an authenticated user, I can:

- Rate a recipe.
- Update my previous rating.
- View recipe ratings.
- View user ratings.

---

## Functional Requirements

### Recipe Rating

Authenticated users can:

- Submit a rating for a recipe.
- Update their previous rating.

Guests cannot submit ratings.

Users cannot rate their own recipes.

Rating values must be integers between 1 and 5.

---

### Recipe Statistics

Each recipe stores the following statistics:

- stats.averageRating
- stats.ratingCount

Recipe ratings are displayed as:

Average Rating (Rating Count)

Example:

⭐ 4.8 (152)

Recipe statistics are managed automatically by the system.

---

### User Statistics

Each user stores the following statistics:

- stats.averageRating

This value represents the average rating of all published recipes created by the user.

User ratings are displayed as:

Average Rating

Example:

⭐ 4.7

User statistics are managed automatically by the system.

---

## Statistics Updates

After each rating action, the system automatically updates:

Recipe

- stats.averageRating
- stats.ratingCount

Author

- stats.averageRating

---

## Business Rules

- Only authenticated users can rate recipes.
- Guests cannot submit ratings.
- Users cannot rate their own recipes.
- Submitting another rating updates the previous rating.
- Ratings are always associated with both a user and a recipe.
- Rating values must be integers between 1 and 5.
- A recipe's average rating is calculated from all submitted ratings.
- stats.averageRating represents the current average recipe rating.
- stats.ratingCount represents the total number of submitted ratings.
- Recipe ratings are displayed as: Average Rating (Rating Count).
- An author's rating is calculated as the average rating of all published recipes created by that author.
- Only published recipes are included when calculating the author's rating.
- Ratings are recalculated automatically after every rating update.
- Recipe statistics are managed exclusively by the system.
- User statistics are managed exclusively by the system.
- Users cannot directly modify recipe or user statistics.

---

## Validation Rules

- Rating is required.
- Rating must be an integer.
- Minimum rating is 1.
- Maximum rating is 5.

---

## Error States

- User is not authenticated.
- User attempts to rate their own recipe.
- Invalid rating value.
- Recipe not found.
- Failed to submit rating.

---

## Empty States

- This recipe has not been rated yet.

---

## Future Enhancements

- Rating History
- Top Rated Recipes
- Top Rated Authors
- Rating Distribution
- Weighted Rating Algorithm (Bayesian Rating)
- Verified Ratings
- Helpful Rating Reviews

# Comments

## Overview

The Comments feature allows authenticated users to share their opinions and feedback on recipes.

All users can read comments, while authenticated users can interact with comments by posting, liking, or disliking them.

Recipe owners can reply to comments.

In future versions, administrators from the Admin Panel will also be able to reply to comments.

Comment and recipe statistics are managed automatically by the system.

---

## User Stories

### As a Guest, I can:

- View recipe comments.
- View comment replies.
- View comment reactions.

### As an Authenticated User, I can:

- Add a comment.
- Like a comment.
- Dislike a comment.
- Change my reaction.
- Remove my reaction.

### As the Recipe Owner, I can:

- Reply to comments.

### Future

As an Administrator, I can:

- Reply to comments.
- Delete inappropriate comments.

---

## Functional Requirements

### View Comments

Every recipe displays its comments.

Each comment displays:

- User Avatar
- Username
- User Title
- Comment Content
- Created Date
- Like Count
- Dislike Count
- Reply Count
- Replies

Comments are displayed in chronological order.

Replies are displayed below their parent comment.

---

### Create Comment

Authenticated users can create comments.

Guests cannot create comments.

---

### Reply to Comment

Only the recipe owner can reply to comments.

Future administrators can also reply.

Replies contain the same properties as regular comments.

Each comment may have multiple replies.

---

### Comment Reactions

Authenticated users can:

- Like a comment.
- Dislike a comment.

Users may:

- Change their reaction.
- Remove their reaction.

Guests cannot react to comments.

---

## Comment Statistics

Each comment stores:

- stats.likeCount
- stats.dislikeCount
- stats.replyCount

Comment statistics are managed automatically by the system.

---

## Recipe Statistics

Each recipe stores:

- stats.commentCount

This value is automatically updated whenever a top-level comment is added or removed.

Recipe statistics are managed automatically by the system.

---

## User Titles

User titles are represented as an enumeration.

Available values:

- User
- Chef
- Master Chef
- Barista
- Food Blogger

Additional titles may be introduced in future versions.

---

## Components

CommentSection

CommentList

CommentCard

CommentForm

CommentReaction

CommentLikeButton

CommentDislikeButton

CommentEmptyState

CommentLoading

---

## Component Behavior

CommentForm is used for both creating comments and replying to comments.

When creating a new comment:

- parentCommentId is null.

When creating a reply:

- parentCommentId contains the parent comment identifier.

The component automatically switches between comment and reply modes based on the provided parentCommentId.

---

## Database Collections

- User
- Recipe
- Comment
- CommentReaction

---

## Data Relationships

Recipe (1) ────────────< Comment (Many)

User (1) ──────────────< Comment (Many)

Comment (1) ───────────< Comment (Many)

A comment may have multiple replies.

Replies are also comments.

Each reply belongs to exactly one parent comment.

---

## Comment Structure

Each comment contains:

- Content
- Author
- Recipe
- Parent Comment (Optional)
- Created Date
- Updated Date
- Statistics

Replies have exactly the same structure as regular comments.

---

## Server Actions

getRecipeComments()

createComment()

likeComment()

dislikeComment()

removeCommentReaction()

---

## Validation Rules

### Comment

- Required
- Minimum length: 1 character
- Maximum length: 1000 characters

### Reaction

- Only Like or Dislike
- Only one reaction per user per comment

---

## Business Rules

- Only authenticated users can create comments.
- Guests cannot create comments.
- Empty comments are not allowed.
- Comment length must not exceed 1000 characters.
- Only the recipe owner can reply to comments.
- Future administrators can also reply.
- Replies are comments and contain the same properties as regular comments.
- Each comment may have multiple replies.
- Replies belong to exactly one parent comment.
- createComment() is used for both comments and replies.
- A reply is identified by a non-null parentCommentId.
- Only authenticated users can react to comments.
- A user can either like or dislike a comment.
- Users cannot like and dislike the same comment simultaneously.
- Users may change or remove their reaction at any time.
- stats.likeCount is automatically updated after every reaction.
- stats.dislikeCount is automatically updated after every reaction.
- stats.replyCount is automatically updated whenever replies are added or removed.
- stats.commentCount is automatically updated whenever top-level comments are added or removed.
- Comment statistics are managed exclusively by the system.
- Recipe statistics are managed exclusively by the system.
- Users cannot directly modify any statistics.

---

## Error States

- User is not authenticated.
- Recipe not found.
- Comment not found.
- Empty comment.
- Comment exceeds the maximum allowed length.
- User is not allowed to reply.
- Failed to save comment.
- Failed to submit reaction.

---

## Empty States

If a recipe has no comments:

"Be the first to share your thoughts about this recipe."

---

## Future Enhancements

- Edit Own Comment
- Delete Own Comment
- Report Comment
- Mention Users
- Comment Notifications
- Pin Comments
- Sort Comments
- Markdown Support
- Nested Replies

---

## Related Features

- Recipes
- User Profile
- Ratings
- Notifications

# Following System

## Overview

The Following System allows authenticated users to follow or unfollow other users.

Following other users helps users discover recipes from their favorite creators and build a personalized cooking community.

The Home page also displays the latest recipes published by followed users.

---

## User Stories

### As a Guest, I can:

- View public user profiles.
- View follower count.
- View following count.
- View recipes published by other users.

### As an Authenticated User, I can:

- Follow another user.
- Unfollow a followed user.
- View my followers.
- View the users I follow.
- View recipes from followed users on the Home page.

---

## Functional Requirements

### Follow User

Authenticated users can follow other users.

The **Follow** button is available:

- On the user profile page.
- On the recipe details page.

After following a user:

- The button changes to **Following**.
- The follower count increases automatically.
- The following count of the authenticated user increases automatically.

---

### Unfollow User

Authenticated users can unfollow users they already follow.

After unfollowing:

- The button changes back to **Follow**.
- The follower count decreases automatically.
- The following count of the authenticated user decreases automatically.

---

### Followers List

Users can view their followers list.

The Followers page displays:

- User Avatar
- Username
- User Title
- User Rating
- Recipe Count
- Follow / Following button

Only the authenticated user can access their own Followers list.

---

### Following List or Follower List

Users can view the users they follow or the users that follow them.

The Following page or Follower page displays:

- User Avatar
- Username
- User Title
- User Rating
- Recipe Count
- Follow / Following button

Only the authenticated user can access their own Following or Follower list.

---

### Home Feed

The Home page displays a dedicated section containing the latest recipes published by followed users.

Recipes are ordered from newest to oldest.

If the user is not following anyone, this section displays an appropriate empty state.

---

### Public Profile

Every public profile displays:

- Recipe Count
- Followers Count
- Following Count

Only the profile owner can open the Followers and Following pages.

Visitors can only view the counters.

---

## User Statistics

Each user stores:

- stats.recipeCount
- stats.followerCount
- stats.followingCount
- stats.rating

All statistics are managed automatically by the system.

---

## Components

- FollowButton
- FollowersList
- FollowingList
- UserCard
- FollowingFeed
- FollowEmptyState
- FollowLoading

---

## Database Collections

- User
- Follow

---

## Data Relationships

User (1) ───────────< Follow (Many)

Each Follow document represents one following relationship between two users.

---

## Follow Structure

Each follow relationship contains:

- Follower
- Following
- Created Date

---

## Server Actions

- followUser()
- unfollowUser()
- getFollowers()
- getFollowing()
- getFollowingFeed()

---

## Validation Rules

- Users must be authenticated.
- A user cannot follow themselves.
- Duplicate follow relationships are not allowed.
- The target user must exist.

---

## Business Rules

- Only authenticated users can follow other users.
- Guests cannot follow users.
- Guests cannot unfollow users.
- A user cannot follow themselves.
- A follow relationship must be unique.
- Users may unfollow at any time.
- Following or unfollowing updates follower and following counts automatically.
- Only the profile owner can access their Followers page.
- Only the profile owner can access their Following page.
- Other users can only view follower and following counts.
- The Home page feed contains recipes published by followed users.
- The Home feed is ordered by newest recipes first.
- User statistics are managed exclusively by the system.

---

## Error States

- User is not authenticated.
- User not found.
- Cannot follow yourself.
- Already following this user.
- Follow relationship not found.
- Failed to follow user.
- Failed to unfollow user.

---

## Empty States

### Followers List

"You don't have any followers yet."

### Following List

"You're not following anyone yet."

### Home Feed

"Follow your favorite cooks to see their latest recipes here."

---

## Future Enhancements

- Suggested Users
- Mutual Followers
- User Activity Feed
- Follow Notifications
- Block Users
- Private Profiles
- Verified Creators
- Creator Recommendations

---

## Related Features

- User Profile
- Recipes
- Home
- Recipe Details
- Search
- Notifications

# Notifications

## Overview

The Notifications feature keeps authenticated users informed about important activities related to their recipes, comments, and the platform.

Notifications are generated automatically when specific events occur, allowing users to stay updated without manually checking their recipes or profile.

Guests cannot receive or access notifications.

---

## User Stories

### As a Guest, I can:

- I cannot receive notifications.
- I cannot access the Notifications page.

### As an Authenticated User, I can:

- View all of my notifications.
- Open a notification.
- Delete a notification.
- See which notifications are unread.
- Receive notifications when someone interacts with my content.
- Receive platform announcements.

---

## Functional Requirements

### Notification Types

The system supports the following notification types:

- Recipe Rating
- Recipe Comment
- Comment Like
- Comment Dislike
- Comment Reply
- System Announcement

---

### Notifications List

Authenticated users can access the Notifications page.

The page displays notifications ordered from newest to oldest.

Each notification displays:

- Notification Title
- Notification Message
- Notification Type
- Created Date
- Read Status

Unread notifications are visually distinguished from read notifications.

---

### Open Notification

Users can open a notification.

Opening a notification automatically marks it as read.

If the notification references a recipe or comment, the user is redirected to the related page.

---

### Delete Notification

Users can permanently delete any notification they own.

Deleting a notification only removes it for that user.

---

### Unread Badge

The notification icon displayed in the application header indicates whether the user has any unread notifications.

If one or more unread notifications exist, a small red badge is displayed on the notification icon.

The badge is automatically updated whenever notifications are:

- Created
- Read
- Deleted

The badge does not display the number of unread notifications.

If there are no unread notifications, the badge is hidden.

---

### Recipe Activity Notifications

The recipe owner receives a notification when:

- Someone rates their recipe.
- Someone comments on their recipe.

---

### Comment Activity Notifications

The comment author receives a notification when:

- Someone likes their comment.
- Someone dislikes their comment.
- The recipe owner or an administrator replies to their comment.

---

### System Announcements

Administrators can send platform-wide announcements.

These notifications may include:

- New features
- Maintenance announcements
- Updates
- General platform information

---

## Components

NotificationsList

NotificationItem

UnreadBadge

NotificationEmptyState

NotificationLoading

---

## Database Collections

- Notification
- User

---

## Data Relationships

User (1) ───────────< Notification (Many)

Each notification belongs to exactly one user.

---

## Notification Structure

Each notification contains:

- Recipient User
- Notification Type
- Title
- Message
- Related Recipe (optional)
- Related Comment (optional)
- Read Status
- Created Date

---

## Server Actions

getNotifications()

markNotificationAsRead()

deleteNotification()

getUnreadNotificationCount()

---

## Validation Rules

- Users must be authenticated.
- Users can only access their own notifications.
- Users can only delete their own notifications.
- Notification types must be valid.

---

## Business Rules

- Only authenticated users can receive notifications.
- Guests cannot access the Notifications page.
- Notifications are created automatically by the system.
- Notifications are ordered by newest first.
- Opening a notification marks it as read.
- Users may delete their own notifications at any time.
- Deleting a notification is permanent.
- Recipe owners are notified when their recipes receive ratings or comments.
- Comment authors are notified when their comments receive likes, dislikes, or replies.
- System announcements can be sent by administrators.
- The unread notification badge is automatically updated whenever notification status changes.
- Users cannot modify notification content.

---

## Error States

- User is not authenticated.
- Notification not found.
- Unauthorized access.
- Failed to load notifications.
- Failed to delete notification.
- Failed to update notification status.

---

## Empty States

Notifications List

"You don't have any notifications yet."

---

## Future Enhancements

- Push Notifications
- Email Notifications
- Real-time Notifications
- Notification Preferences
- Mark All as Read
- Notification Categories
- Notification Search

---

## Related Features

- Recipes
- Ratings
- Comments
- User Profile
- Following System
- Home

# Support Tickets

## Overview

The Support Tickets feature allows authenticated users to contact the Loghmeh support team by submitting support messages directly from within the application.

Support requests are intended for reporting problems, asking questions, requesting assistance, or providing feedback about the platform.

Each submitted message is stored as a support ticket that can be reviewed and managed by administrators.

---

## User Stories

### As a Guest, I can:

- View the Support page.
- View contact information (if available).
- I cannot submit support tickets.

### As an Authenticated User, I can:

- Submit a support ticket.
- View a confirmation after submitting.
- Submit multiple support tickets over time.

---

## Functional Requirements

### Submit Support Ticket

Authenticated users can send a message to the support team.

Each support ticket contains:

- Message
- Created Date
- Status

After successful submission:

- The ticket is stored in the database.
- A success message is displayed.
- The message input is cleared.

---

### Ticket Status

Each support ticket has a status managed by administrators.

Possible statuses include:

- Open
- In Progress
- Resolved
- Closed

Users cannot modify the ticket status.

---

### Ticket Confirmation

After a successful submission:

- A confirmation message is displayed.
- The user remains on the Support page.

---

### Rate Support Experience

After a ticket has been marked as **Resolved** or **Closed**, the user can rate the support experience in the related notification.

The rating is optional.

Each support ticket may receive:

- 1–5 Star Rating

The support rating is used only for internal service quality evaluation.

---

### Support Response Notification

Whenever the support team updates or replies to a support ticket, the user receives a notification.

Notifications may be generated when:

- A ticket status changes.
- A support reply is added.
- The ticket is marked as Resolved.
- The ticket is marked as Closed.

Notifications appear in the Notifications feature.

---

## Components

SupportForm

SupportMessageInput

SubmitButton

SupportSuccessMessage

SupportLoading

SupportErrorState

---

## Database Collections

- SupportTicket

---

## Data Relationships

User (1) ───────────< SupportTicket (Many)

Each support ticket belongs to one user.

---

## Support Ticket Structure

Each support ticket contains:

- User
- Message
- Status
- Support Rating (optional)
- Created Date
- Updated Date

---

## Server Actions

createSupportTicket()

getUserSupportTickets()

rateSupportExperience()

---

## Validation Rules

- Users must be authenticated.
- Message cannot be empty.
- Message must satisfy the minimum and maximum length requirements.
- Only resolved or closed tickets can receive a support rating.

---

## Business Rules

- Only authenticated users can submit support tickets.
- Guests cannot submit tickets.
- Every support ticket belongs to exactly one user.
- Ticket status is managed only by administrators.
- Users cannot edit submitted tickets.
- Users cannot delete submitted tickets.
- A support rating can only be submitted once per ticket.
- Support ratings are used exclusively for internal quality assessment.
- Users receive a notification whenever their ticket is updated by the support team.

---

## Error States

- User is not authenticated.
- Message is empty.
- Message exceeds the allowed length.
- Failed to submit support ticket.
- Failed to submit support rating.

---

## Empty States

Support Form

"Need help? Send us a message and our support team will get back to you."

---

## Future Enhancements

- Ticket Conversation Thread
- File Attachments
- Ticket Categories
- Priority Levels
- Live Chat Support
- FAQ Suggestions
- Ticket Search
- Ticket History

---

## Related Features

- Notifications
- User Profile
- Authentication

# Settings

## Overview

The Settings feature allows authenticated users to manage their account preferences and application settings.

Users can personalize their experience, update account information and configure privacy options from a single place.

---

## User Stories

### As a Guest, I can:

- I cannot access the Settings page.

### As an Authenticated User, I can:

- Update my profile information.
- Change my password.
- Manage privacy settings.
- Log out of my account.

---

## Functional Requirements

### Profile Settings

Users can update their personal information.

Editable fields include:

- Full Name
- Username
- Bio
- Profile Picture
- Social Media Links

Changes are saved immediately after successful validation.

---

### Change Password

Users can change their account password.

The user must enter:

- Current Password
- New Password
- Confirm New Password

After a successful password change:

- The new password becomes active immediately.
- The user remains logged in.

---

### Privacy Settings

Users can control parts of their public profile.

Available options include:

- Show Social Media Links
- Show User Bio

Changes are reflected immediately on the public profile.

---

### Logout

Users can securely sign out of their account.

After logout:

- The current session is terminated.
- Protected pages require authentication again.

---

## Components

SettingsPage

ProfileSettingsForm

PasswordForm

PrivacySettings

LogoutButton

SaveButton

SettingsLoading

---

## Database Collections

- User

---

## Data Relationships

Each authenticated user owns one settings configuration stored within their User document.

---

## Settings Structure

Each user stores:

- Profile Information
- Privacy Preferences

---

## Server Actions

updateProfile()

changePassword()

updatePrivacySettings()

logout()

---

## Validation Rules

- Users must be authenticated.
- Username must be unique.
- Password must satisfy security requirements.
- New Password and Confirm Password must match.
- Social media links must be valid URLs.

---

## Business Rules

- Only authenticated users can access Settings.
- Users may only modify their own settings.
- Username uniqueness is enforced.
- Password changes require the current password.
- Privacy settings only affect public visibility.
- Logout immediately invalidates the current session.

---

## Error States

- User is not authenticated.
- Username already exists.
- Invalid current password.
- Password confirmation does not match.
- Invalid social media link.
- Failed to save settings.

---

## Empty States

Profile Bio

"No bio added."

Social Media Links

"No social media links added."

---

## Future Enhancements

- Language Selection
- Theme (Light / Dark / System)
- Delete Account
- Download Personal Data
- Two-Factor Authentication (2FA)
- Active Sessions Management
- Connected Accounts
- Email Preferences

---

## Related Features

- Authentication
- User Profile
- Following System
- Support Tickets

# Home Feed

## Overview

The Home Feed is the main discovery page of the application.

It presents recipes, categories, and creators in multiple curated sections, allowing users to quickly discover popular content and recently published recipes from people they follow.

Each section is displayed independently and can be explored horizontally or expanded into a dedicated page.

---

## User Stories

### As a Guest, I can:

- View all public Home Feed sections.
- Browse recipes and categories.
- View popular chefs.
- Open the full page of each section.

### As an Authenticated User, I can:

- View all public Home Feed sections.
- View the latest recipes published by users I follow.
- Browse more items within each section.
- Open the dedicated page of every section.

---

## Functional Requirements

### Popular Categories

The Home page displays a section containing the most popular recipe categories.

Each category card displays:

- Category Image
- Category Name
- Recipe Count

Users can:

- Scroll horizontally through the categories.
- Click **See More** to open the Categories page.

---

### Popular Recipes

The Home page displays a section containing the most popular recipes.

Each recipe card displays:

- Recipe Image
- Recipe Name
- Author
- Average Rating
- Bookmark Button

Users can:

- Scroll horizontally through recipes.
- Open the recipe details page.
- Bookmark or remove bookmarks.
- Click **See More** to view all popular recipes.

Recipes are ordered by popularity.

---

### Following Feed

Authenticated users can view the latest recipes published by users they follow.

Each recipe card displays:

- Recipe Image
- Recipe Name
- Author
- Average Rating
- Bookmark Button

Users can:

- Scroll horizontally through recipes.
- Open recipe details.
- Bookmark recipes.
- Click **See More** to view the complete following feed.

Recipes are ordered from newest to oldest.

If the user is not following anyone, an empty state is displayed.

Guests do not see this section.

---

### Popular Chefs

The Home page displays the highest-rated recipe creators.

Each user card displays:

- Profile Picture
- Username
- User Title
- Average Rating
- Recipe Count

Users can:

- Scroll horizontally.
- Open the creator's profile.
- Click **See More** to browse all creators.

Creators are ordered by rating.

---

### Popular Light Meals

The Home page displays popular recipes belonging to the Light Meals category.

Users can:

- Scroll horizontally.
- Open recipe details.
- Click **See More** to browse all light meal recipes.

Recipes are ordered by popularity.

---

### Popular Main Courses

The Home page displays popular recipes belonging to the Main Courses category.

Users can:

- Scroll horizontally.
- Open recipe details.
- Click **See More** to browse all main course recipes.

Recipes are ordered by popularity.

---

### Popular Desserts

The Home page displays popular dessert recipes.

Users can:

- Scroll horizontally.
- Open recipe details.
- Click **See More** to browse all dessert recipes.

Recipes are ordered by popularity.

---

## Components

HomeFeed

SectionHeader

HorizontalCarousel

RecipeCard

CategoryCard

UserCard

SeeMoreButton

FeedEmptyState

FeedLoading

---

## Database Collections

- Recipe
- Category
- User
- Follow

---

## Data Relationships

Category (1) ───────────< Recipe (Many)

User (1) ───────────< Recipe (Many)

User (1) ───────────< Follow (Many)

---

## Server Actions

getPopularCategories()

getPopularRecipes()

getPopularChefs()

getPopularLightMeals()

getPopularMainCourses()

getPopularDesserts()

getFollowingFeed()

---

## Validation Rules

- Only published recipes appear in the Home Feed.
- Only public user profiles are displayed.
- The Following Feed is available only for authenticated users.

---

## Business Rules

- The Home Feed is publicly accessible.
- All sections are displayed independently.
- Each section supports horizontal scrolling.
- Each section contains a **See More** button.
- The Following Feed is displayed only to authenticated users.
- Guests cannot view the Following Feed.
- If the user follows no one, the Following Feed displays an empty state.
- Popular recipes are ordered by popularity.
- Popular chefs are ordered by user rating.
- Category-specific sections display recipes only from their respective categories.
- Only published recipes can appear in any Home Feed section.

---

## Error States

- Failed to load Home Feed.
- Failed to load popular recipes.
- Failed to load categories.
- Failed to load creators.
- Failed to load following feed.

---

## Empty States

Following Feed

"Follow your favorite cooks to see their latest recipes here."

Popular Categories

"No categories available."

Popular Recipes

"No recipes available."

Popular Chefs

"No creators available."

---

## Future Enhancements

- Personalized Recommendations
- Recently Viewed Recipes
- Trending Recipes
- Seasonal Collections
- Featured Creators
- Editor's Picks
- Continue Cooking
- AI Recipe Recommendations

---

## Related Features

- Categories
- Recipes
- Following System
- Bookmarks
- Search
- User Profile
