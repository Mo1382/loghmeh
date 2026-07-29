# User Roles

The Loghmeh platform defines several user roles to control permissions and responsibilities throughout the application.

Most features are available to all visitors, while creating content and interacting with the community requires authentication.

Administrative operations are handled in a separate Admin application.

---

## Guest

A Guest is an unauthenticated visitor.

Guests can browse and explore public content but cannot perform actions that require an account.

Guests can:

- Browse recipes
- Search recipes
- View categories
- View recipe details
- View user profiles
- View comments
- View ratings
- View public statistics

Guests cannot:

- Create recipes
- Bookmark recipes
- Follow users
- Rate recipes
- Post comments
- Like or dislike comments
- Submit support tickets
- Access personal profile features
- Receive notifications

---

## Authenticated User

An Authenticated User is a registered user who has signed in.

This role provides access to all community features.

Authenticated users can:

- Create, edit, and delete their own recipes
- Bookmark recipes
- Follow and unfollow users
- Rate recipes
- Post comments
- Like or dislike comments
- Receive notifications
- Submit support tickets
- Manage profile settings
- Change password
- View followers and following lists
- Access personal profile features

Authenticated users can only modify resources they own unless otherwise specified.

---

## Recipe Owner

A Recipe Owner is an authenticated user who owns a specific recipe.

This is a **logical role**, not a database role.

No user is permanently assigned the **Recipe Owner** role. Instead, a user is considered a Recipe Owner only when interacting with one of their own recipes.

Therefore, the application does **not** store `RecipeOwner` in the user's `role` field. Ownership is determined dynamically by comparing the authenticated user with the recipe's owner.

In addition to normal authenticated user permissions, recipe owners have moderation capabilities for comments on their own recipes.

Recipe owners can:

- Reply to comments on their recipes
- Manage their own recipes

Recipe owners cannot:

- Reply to comments on recipes owned by other users
- Moderate other users' content outside their own recipes

---

## Administrator

Administrators manage the overall platform.

Administrative functionality is implemented in a separate Admin application and is therefore outside the scope of this documentation.

Typical administrator responsibilities include:

- Managing users
- Managing recipes
- Managing categories
- Managing comments
- Managing support tickets
- Sending announcements
- Managing notifications
- Reviewing reported content
- Maintaining platform data

Detailed administrator permissions are documented separately.

---

## Permission Summary

| Feature                 | Guest | Authenticated User |   Recipe Owner   | Administrator |
| ----------------------- | :---: | :----------------: | :--------------: | :-----------: |
| View Recipes            |  ✅   |         ✅         |        ✅        |      ✅       |
| Search Recipes          |  ✅   |         ✅         |        ✅        |      ✅       |
| View Categories         |  ✅   |         ✅         |        ✅        |      ✅       |
| Create Recipes          |  ❌   |         ✅         |        ✅        |      ✅       |
| Edit Own Recipes        |  ❌   |         ✅         |        ✅        |      ✅       |
| Delete Own Recipes      |  ❌   |         ✅         |        ✅        |      ✅       |
| Bookmark Recipes        |  ❌   |         ✅         |        ✅        |      ✅       |
| Follow Users            |  ❌   |         ✅         |        ✅        |      ✅       |
| Rate Recipes            |  ❌   |         ✅         |        ✅        |      ✅       |
| Post Comments           |  ❌   |         ✅         |        ✅        |      ✅       |
| Like / Dislike Comments |  ❌   |         ✅         |        ✅        |      ✅       |
| Reply to Comments       |  ❌   |         ❌         | ✅ (Own Recipes) |      ✅       |
| Receive Notifications   |  ❌   |         ✅         |        ✅        |      ✅       |
| Submit Support Tickets  |  ❌   |         ✅         |        ✅        |      ✅       |
| Manage Platform         |  ❌   |         ❌         |        ❌        |      ✅       |
