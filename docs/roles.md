# User Roles

This document defines all user roles, permissions, and access control for the Loghmeh application.

Roles determine what actions users can perform and what resources they can access.

---

## Document Structure

### Role Categories

1. **Primary Roles** - Guest, Authenticated User
2. **Logical Roles** - Recipe Owner, Comment Author
3. **Administrative Roles** - Administrator (separate application)

---

## Quick Reference

| Role               | Type           | Access Level               | Can Create Content |
| ------------------ | -------------- | -------------------------- | ------------------ |
| Guest              | Primary        | Read-only                  | ❌                 |
| Authenticated User | Primary        | Full community access      | ✅                 |
| Recipe Owner       | Logical        | Recipe-specific moderation | ✅                 |
| Comment Author     | Logical        | Own comment management     | ✅                 |
| Administrator      | Administrative | Full platform management   | ✅                 |

---

# 1. Primary Roles

## 1.1 Guest

### Definition

A **Guest** is an unauthenticated visitor who has not signed in.

Guests have read-only access to public content.

### Purpose

Allow users to explore the platform and discover content before registering.

### Access Level

**Read-only** - Guests can view but cannot interact with content.

### Capabilities

#### Browse & Discovery

| Capability          | Access | Description                |
| ------------------- | ------ | -------------------------- |
| Browse Recipes      | ✅     | View all published recipes |
| Search Recipes      | ✅     | Search by title            |
| View Categories     | ✅     | Browse all categories      |
| View Recipe Details | ✅     | Full recipe information    |
| View User Profiles  | ✅     | Public profile information |

#### View Content

| Capability        | Access | Description             |
| ----------------- | ------ | ----------------------- |
| View Comments     | ✅     | Read all comments       |
| View Ratings      | ✅     | See recipe ratings      |
| View Statistics   | ✅     | Public statistics only  |
| View Social Links | ✅     | User social media links |

#### Restrictions

| Restriction             | Reason                  |
| ----------------------- | ----------------------- |
| Create Recipes          | Requires authentication |
| Edit/Delete Recipes     | Requires ownership      |
| Bookmark Recipes        | Requires authentication |
| Follow Users            | Requires authentication |
| Rate Recipes            | Requires authentication |
| Post Comments           | Requires authentication |
| Like/Dislike Comments   | Requires authentication |
| Submit Support Tickets  | Requires authentication |
| Receive Notifications   | Requires authentication |
| Access Personal Profile | Requires authentication |

---

## 1.2 Authenticated User

### Definition

An **Authenticated User** is a registered user who has successfully signed in.

This is the primary user role with full access to community features.

### Purpose

Enable users to create content, interact with the community, and manage their profile.

### Access Level

**Full community access** - Can create, interact, and manage own content.

### Capabilities

#### Recipe Management

| Capability         | Access | Description             |
| ------------------ | ------ | ----------------------- |
| Create Recipes     | ✅     | Create new recipes      |
| Edit Own Recipes   | ✅     | Modify own recipes      |
| Delete Own Recipes | ✅     | Soft delete own recipes |
| Publish Recipes    | ✅     | Publish draft recipes   |
| Upload Images      | ✅     | Upload cover images     |

#### Community Interaction

| Capability            | Access | Description                            |
| --------------------- | ------ | -------------------------------------- |
| Bookmark Recipes      | ✅     | Save recipes for later                 |
| Follow/Unfollow Users | ✅     | Build network                          |
| Rate Recipes          | ✅     | Submit and update ratings              |
| Post Comments         | ✅     | Share feedback                         |
| Like/Dislike Comments | ✅     | React to comments                      |
| Reply to Comments     | ❌     | Only on own recipes (see Recipe Owner) |

#### Profile Management

| Capability               | Access | Description           |
| ------------------------ | ------ | --------------------- |
| View Own Profile         | ✅     | Personal dashboard    |
| Edit Profile             | ✅     | Update information    |
| Upload Avatar            | ✅     | Profile picture       |
| Manage Social Links      | ✅     | Add/edit/remove links |
| View Followers/Following | ✅     | Network lists         |
| Change Password          | ✅     | Security management   |
| Manage Settings          | ✅     | Account preferences   |

#### Notifications & Support

| Capability             | Access | Description              |
| ---------------------- | ------ | ------------------------ |
| Receive Notifications  | ✅     | Activity updates         |
| Delete Notifications   | ✅     | Remove own notifications |
| Submit Support Tickets | ✅     | Contact support          |
| Rate Support           | ✅     | Rate resolved tickets    |

#### Ownership Principle

Authenticated users can **only** modify resources they own:

- Edit own recipes only
- Delete own recipes only
- Delete own comments only
- Modify own profile only
- Manage own bookmarks only

### Restrictions

| Restriction                          | Reason                 |
| ------------------------------------ | ---------------------- |
| Edit Others' Recipes                 | Ownership required     |
| Delete Others' Recipes               | Ownership required     |
| Delete Others' Comments              | Ownership required     |
| Moderate Content                     | Admin privilege        |
| Reply to Comments on Others' Recipes | Recipe Owner privilege |
| Rate Own Recipes                     | Conflict of interest   |

---

# 2. Logical Roles

## 2.1 Recipe Owner

### Definition

A **Recipe Owner** is an authenticated user who owns a specific recipe.

This is a **logical role**, not a database role. No user is permanently assigned this role.

### Role Assignment

Ownership is determined dynamically:

```
User is Recipe Owner IF:
  authenticatedUser._id === recipe.author._id
```

The application does **not** store `RecipeOwner` in the user's `role` field.

### Purpose

Grant recipe-specific moderation capabilities to recipe authors.

### Access Level

**Recipe-specific moderation** - Additional permissions on owned recipes.

### Capabilities

| Capability             | Scope            | Description              |
| ---------------------- | ---------------- | ------------------------ |
| Edit Recipe            | Own recipes only | Modify recipe content    |
| Delete Recipe          | Own recipes only | Soft delete recipe       |
| Reply to Comments      | Own recipes only | Respond to user feedback |
| View Recipe Statistics | Own recipes only | Performance metrics      |

### Restrictions

| Restriction                          | Reason               |
| ------------------------------------ | -------------------- |
| Reply to Comments on Others' Recipes | Not the owner        |
| Delete Others' Comments              | Admin privilege only |
| Edit Others' Recipes                 | Not the owner        |
| Moderate Other Content               | Admin privilege only |

---

## 2.2 Comment Author

### Definition

A **Comment Author** is an authenticated user who has written a specific comment.

This is a **logical role**, not a database role.

### Role Assignment

Authorship is determined dynamically:

```
User is Comment Author IF:
  authenticatedUser._id === comment.author._id
```

### Purpose

Allow users to manage their own comments.

### Capabilities

| Capability         | Scope             | Description    |
| ------------------ | ----------------- | -------------- |
| Delete Own Comment | Own comments only | Remove comment |

### Restrictions

| Restriction             | Reason                 |
| ----------------------- | ---------------------- |
| Edit Own Comment        | Not implemented in MVP |
| Delete Others' Comments | Admin privilege only   |

---

# 3. Administrative Roles

## 3.1 Administrator

### Definition

An **Administrator** manages the overall platform.

Administrative functionality is implemented in a **separate Admin application** and is outside the scope of this documentation.

### Purpose

Manage users, content, and platform operations.

### Access Level

**Full platform management** - Complete access to all features and data.

### Responsibilities

| Area                | Responsibilities                              |
| ------------------- | --------------------------------------------- |
| User Management     | Manage accounts, handle reports, verify users |
| Recipe Management   | Review, feature, or remove recipes            |
| Category Management | Create, edit, delete categories               |
| Comment Management  | Moderate, remove inappropriate content        |
| Support Management  | Handle tickets, respond to users              |
| Announcements       | Send platform-wide notifications              |
| Analytics           | Monitor platform metrics                      |
| Reports             | Review reported content                       |

### Documentation

Detailed administrator permissions are documented separately in the Admin Dashboard project.

---

# 4. Permission Matrix

## 4.1 Recipe Permissions

| Action                 | Guest | Authenticated User | Recipe Owner | Administrator |
| ---------------------- | :---: | :----------------: | :----------: | :-----------: |
| View Published Recipes |  ✅   |         ✅         |      ✅      |      ✅       |
| View Draft Recipes     |  ❌   |         ❌         |   ✅ (Own)   |      ✅       |
| Create Recipes         |  ❌   |         ✅         |      ✅      |      ✅       |
| Edit Recipes           |  ❌   |      ✅ (Own)      |   ✅ (Own)   |      ✅       |
| Delete Recipes         |  ❌   |      ✅ (Own)      |   ✅ (Own)   |      ✅       |
| Publish Recipes        |  ❌   |      ✅ (Own)      |   ✅ (Own)   |      ✅       |
| Rate Recipes           |  ❌   |         ✅         | ✅ (Not own) |      ✅       |
| Bookmark Recipes       |  ❌   |         ✅         |      ✅      |      ✅       |

## 4.2 Comment Permissions

| Action                | Guest | Authenticated User |   Recipe Owner   | Administrator |
| --------------------- | :---: | :----------------: | :--------------: | :-----------: |
| View Comments         |  ✅   |         ✅         |        ✅        |      ✅       |
| Create Comments       |  ❌   |         ✅         |        ✅        |      ✅       |
| Delete Own Comments   |  ❌   |         ✅         |        ✅        |      ✅       |
| Reply to Comments     |  ❌   |         ❌         | ✅ (Own recipes) |      ✅       |
| Like/Dislike Comments |  ❌   |         ✅         |        ✅        |      ✅       |
| Delete Any Comment    |  ❌   |         ❌         |        ❌        |      ✅       |

## 4.3 User Interaction Permissions

| Action                   | Guest | Authenticated User | Administrator |
| ------------------------ | :---: | :----------------: | :-----------: |
| View User Profiles       |  ✅   |         ✅         |      ✅       |
| Follow Users             |  ❌   |         ✅         |      ✅       |
| View Followers/Following |  ❌   |      ✅ (Own)      |      ✅       |
| Send Messages            |  ❌   |         ❌         |      ❌       |

## 4.4 Profile Permissions

| Action             | Guest | Authenticated User | Administrator |
| ------------------ | :---: | :----------------: | :-----------: |
| View Own Profile   |  ❌   |         ✅         |      ✅       |
| Edit Own Profile   |  ❌   |         ✅         |      ✅       |
| Change Password    |  ❌   |         ✅         |      ✅       |
| Manage Settings    |  ❌   |         ✅         |      ✅       |
| Delete Own Account |  ❌   |         ❌         |      ✅       |

## 4.5 Notification Permissions

| Action                | Guest | Authenticated User | Administrator |
| --------------------- | :---: | :----------------: | :-----------: |
| Receive Notifications |  ❌   |         ✅         |      ✅       |
| View Notifications    |  ❌   |      ✅ (Own)      |      ✅       |
| Delete Notifications  |  ❌   |      ✅ (Own)      |      ✅       |
| Send Announcements    |  ❌   |         ❌         |      ✅       |

## 4.6 Support Permissions

| Action            | Guest | Authenticated User | Administrator |
| ----------------- | :---: | :----------------: | :-----------: |
| View Support Page |  ✅   |         ✅         |      ✅       |
| Submit Tickets    |  ❌   |         ✅         |      ✅       |
| View Own Tickets  |  ❌   |         ✅         |      ✅       |
| Manage Tickets    |  ❌   |         ❌         |      ✅       |
| Rate Support      |  ❌   |         ✅         |      ❌       |

## 4.7 Category Permissions

| Action                  | Guest | Authenticated User | Administrator |
| ----------------------- | :---: | :----------------: | :-----------: |
| View Categories         |  ✅   |         ✅         |      ✅       |
| Browse Category Recipes |  ✅   |         ✅         |      ✅       |
| Create Categories       |  ❌   |         ❌         |      ✅       |
| Edit Categories         |  ❌   |         ❌         |      ✅       |
| Delete Categories       |  ❌   |         ❌         |      ✅       |

---

# 5. Role Implementation

## 5.1 Database Schema

User roles are stored in the User collection:

```javascript
// User Schema
{
  role: {
    type: String,
    enum: ['user'],
    default: 'user'
  }
}
```

**Note:** MVP has only one database role: `user`. Administrator role is managed separately.

## 5.2 Authentication Check

```javascript
// Server-side authentication check
const session = await getServerSession(authOptions);
const isAuthenticated = !!session?.user;
```

## 5.3 Ownership Check

```javascript
// Recipe ownership check
const isRecipeOwner = recipe.author._id.equals(session.user._id);

// Comment ownership check
const isCommentAuthor = comment.author._id.equals(session.user._id);
```

## 5.4 Authorization Middleware

| Route Type       | Check Required                   |
| ---------------- | -------------------------------- |
| Public Routes    | None                             |
| Protected Routes | Authentication required          |
| Owner Routes     | Authentication + Ownership check |
| Admin Routes     | Admin role (separate app)        |

---

# 6. Security Considerations

## 6.1 Authorization Principles

| Principle              | Description                                 |
| ---------------------- | ------------------------------------------- |
| Authenticate First     | Verify identity before checking permissions |
| Least Privilege        | Grant minimum required permissions          |
| Server-Side Validation | Never trust client-side checks alone        |
| Ownership Verification | Always verify ownership for modifications   |

## 6.2 Common Authorization Patterns

### Pattern 1: Public Read, Authenticated Write

```
Guest: View recipes ✅
User: View recipes ✅, Create recipes ✅
```

### Pattern 2: Owner Modification

```
User: Edit own recipes ✅
User: Edit others' recipes ❌
```

### Pattern 3: Recipe Owner Privilege

```
User: Reply to comments ❌
Recipe Owner: Reply to comments on own recipes ✅
```

## 6.3 Authorization Errors

| Error                    | Response Code | Message                                            |
| ------------------------ | ------------- | -------------------------------------------------- |
| Not Authenticated        | 401           | "Please sign in to continue"                       |
| Insufficient Permissions | 403           | "You don't have permission to perform this action" |
| Resource Not Found       | 404           | "Resource not found" (don't reveal existence)      |

---

# Appendix

## Role Transition Flow

```
┌─────────┐     Register      ┌──────────────────┐
│  Guest  │ ───────────────► │ Authenticated User│
└─────────┘                  └──────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Recipe   │   │  Comment  │   │  Ticket   │
            │  Owner    │   │  Author   │   │  Creator  │
            └───────────┘   └───────────┘   └───────────┘
            (Logical)       (Logical)       (Logical)
```

## Role Comparison

| Aspect           | Guest | Authenticated User | Administrator |
| ---------------- | ----- | ------------------ | ------------- |
| Authentication   | ❌    | ✅                 | ✅            |
| Create Content   | ❌    | ✅                 | ✅            |
| Interact         | ❌    | ✅                 | ✅            |
| Moderate         | ❌    | ❌                 | ✅            |
| Manage Platform  | ❌    | ❌                 | ✅            |
| Access Admin App | ❌    | ❌                 | ✅            |

## Future Enhancements

| Enhancement      | Description                             |
| ---------------- | --------------------------------------- |
| Verified Badge   | Verified creators with special status   |
| Premium Users    | Paid tier with additional features      |
| Moderator Role   | Community moderators for content review |
| Contributor Role | Users with special contribution status  |

---

_Document Version: 1.0_
_Last Updated: July 2026_
