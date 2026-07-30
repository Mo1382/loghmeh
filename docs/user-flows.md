# User Flows

This document describes all user flows for the Loghmeh application.

User flows define the sequences of actions users perform to achieve specific goals.

---

## Document Structure

### Flow Categories

1. **Authentication Flows** - Account creation, sign in, password management
2. **Recipe Flows** - Create, edit, publish, browse, search recipes
3. **User Profile Flows** - Profile management, social links
4. **Social Flows** - Follow users, view followers/following
5. **Interaction Flows** - Rate, comment, bookmark recipes
6. **Support Flows** - Submit and manage support tickets
7. **Settings Flows** - Account settings and preferences
8. **Notification Flows** - View and manage notifications
9. **Error & Edge Case Flows** - Authentication required, not found, session expired

---

## Quick Reference

| Flow Category      | Flow Count | Primary Users             |
| ------------------ | ---------- | ------------------------- |
| Authentication     | 5          | Guest, Authenticated User |
| Recipes            | 10         | Guest, Authenticated User |
| User Profile       | 5          | Authenticated User        |
| Social             | 4          | Authenticated User        |
| Interaction        | 6          | Authenticated User        |
| Support            | 2          | Authenticated User        |
| Settings           | 3          | Authenticated User        |
| Notifications      | 2          | Authenticated User        |
| Error & Edge Cases | 3          | All Users                 |

---

# 1. Authentication Flows

## 1.1 Registration Flow

### Flow Overview

| Aspect          | Description                           |
| --------------- | ------------------------------------- |
| **Flow Name**   | User Registration                     |
| **User Role**   | Guest                                 |
| **Entry Point** | `/register`                           |
| **Exit Point**  | Home page (authenticated)             |
| **Goal**        | Create a new account and verify email |

### Flow Diagram

```
┌─────────────────┐
│  Landing Page   │
│    (Guest)      │
└────────┬────────┘
         │ Click "Sign Up"
         ▼
┌─────────────────┐
│  Register Page  │
│  /register      │
└────────┬────────┘
         │ Fill form (username, email, password)
         │ Submit
         ▼
┌─────────────────┐
│  Validation     │
│  (Client)       │
└────────┬────────┘
         │ Valid?
         │
    ┌────┴────┐
    │         │
   No        Yes
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  Send OTP       │
│ Msg   │  │  to Email       │
└───────┘  └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Verify Email   │
           │  /verify-email  │
           └────────┬────────┘
                    │ Enter OTP
                    │ Submit
                    ▼
           ┌─────────────────┐
           │  Verify OTP     │
           └────────┬────────┘
                    │
               ┌────┴────┐
               │         │
            Invalid    Valid
               │         │
               ▼         ▼
         ┌─────────┐ ┌─────────────────┐
         │ Resend  │ │ Account Created │
         │ OTP     │ │ Auto Sign In    │
         └─────────┘ └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Home Page     │
                    │  (Authenticated)│
                    └─────────────────┘
```

### Steps

| Step | Action                         | System Response                           |
| ---- | ------------------------------ | ----------------------------------------- |
| 1    | Navigate to register page      | Display registration form                 |
| 2    | Fill username, email, password | Client-side validation                    |
| 3    | Submit form                    | Send OTP to email                         |
| 4    | Enter OTP                      | Verify OTP code                           |
| 5    | Verification successful        | Create account, sign in, redirect to home |

### Error States

| Error          | Trigger                | Resolution                       |
| -------------- | ---------------------- | -------------------------------- |
| Username taken | Duplicate username     | Enter different username         |
| Email taken    | Duplicate email        | Enter different email or sign in |
| Invalid email  | Wrong format           | Enter valid email address        |
| Weak password  | Less than 8 characters | Enter stronger password          |
| Invalid OTP    | Wrong/expired code     | Resend OTP and re-enter          |
| OTP expired    | More than 10 minutes   | Resend OTP                       |

---

## 1.2 Sign In Flow

### Flow Overview

| Aspect          | Description                     |
| --------------- | ------------------------------- |
| **Flow Name**   | User Sign In                    |
| **User Role**   | Guest                           |
| **Entry Point** | `/login`                        |
| **Exit Point**  | Home page (authenticated)       |
| **Goal**        | Authenticate and access account |

### Flow Diagram

```
┌─────────────────┐
│  Landing Page   │
│    (Guest)      │
└────────┬────────┘
         │ Click "Sign In"
         ▼
┌─────────────────┐
│   Login Page    │
│   /login        │
└────────┬────────┘
         │ Enter email/username + password
         │ Submit
         ▼
┌─────────────────┐
│  Validate       │
│  Credentials    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Invalid    Valid
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  Create Session │
│ Msg   │  └────────┬────────┘
└───────┘           │
                    ▼
           ┌─────────────────┐
           │   Home Page     │
           │  (Authenticated)│
           └─────────────────┘
```

### Steps

| Step | Action                            | System Response                  |
| ---- | --------------------------------- | -------------------------------- |
| 1    | Navigate to login page            | Display login form               |
| 2    | Enter email/username and password | Client-side validation           |
| 3    | Submit form                       | Validate credentials             |
| 4    | Credentials valid                 | Create session, redirect to home |

### Error States

| Error              | Trigger             | Resolution              |
| ------------------ | ------------------- | ----------------------- |
| User not found     | Invalid credentials | Check email/username    |
| Wrong password     | Invalid credentials | Check password or reset |
| Email not verified | Unverified account  | Verify email first      |

---

## 1.3 Forgot Password Flow

### Flow Overview

| Aspect          | Description              |
| --------------- | ------------------------ |
| **Flow Name**   | Password Reset           |
| **User Role**   | Guest                    |
| **Entry Point** | `/forgot-password`       |
| **Exit Point**  | Login page               |
| **Goal**        | Reset forgotten password |

### Flow Diagram

```
┌─────────────────┐
│   Login Page    │
└────────┬────────┘
         │ Click "Forgot Password?"
         ▼
┌─────────────────┐
│ Forgot Password │
│ /forgot-password│
└────────┬────────┘
         │ Enter email
         │ Submit
         ▼
┌─────────────────┐
│  Send OTP to    │
│  Email          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify OTP      │
│ /verify-reset   │
└────────┬────────┘
         │ Enter OTP
         │ Verify
         ▼
┌─────────────────┐
│  Reset Password │
│ /reset-password │
└────────┬────────┘
         │ Enter new password
         │ Submit
         ▼
┌─────────────────┐
│  Password Reset │
│  Success        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Login Page    │
└─────────────────┘
```

### Steps

| Step | Action                             | System Response                  |
| ---- | ---------------------------------- | -------------------------------- |
| 1    | Click "Forgot Password" from login | Navigate to forgot password page |
| 2    | Enter email address                | Send OTP to email                |
| 3    | Enter OTP code                     | Verify OTP                       |
| 4    | Enter new password                 | Update password                  |
| 5    | Password updated                   | Redirect to login                |

---

## 1.4 Change Password Flow

### Flow Overview

| Aspect          | Description             |
| --------------- | ----------------------- |
| **Flow Name**   | Change Password         |
| **User Role**   | Authenticated User      |
| **Entry Point** | `/settings`             |
| **Exit Point**  | Settings page           |
| **Goal**        | Update current password |

### Flow Diagram

```
┌─────────────────┐
│  Settings Page  │
└────────┬────────┘
         │ Click "Change Password"
         ▼
┌─────────────────┐
│ Enter Current   │
│ Password        │
└────────┬────────┘
         │ Enter New Password
         │ Submit
         ▼
┌─────────────────┐
│ Verify Current  │
│ Password        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Invalid    Valid
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  Send OTP to    │
│ Msg   │  │  Email          │
└───────┘  └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Enter OTP      │
           └────────┬────────┘
                    │ Verify
                    ▼
           ┌─────────────────┐
           │  Password       │
           │  Changed        │
           └─────────────────┘
```

### Steps

| Step | Action                         | System Response            |
| ---- | ------------------------------ | -------------------------- |
| 1    | Navigate to Settings           | Display settings options   |
| 2    | Click "Change Password"        | Show password form         |
| 3    | Enter current and new password | Validate current password  |
| 4    | Submit                         | Send OTP to email          |
| 5    | Enter OTP                      | Verify and update password |

---

## 1.5 Sign Out Flow

### Flow Overview

| Aspect          | Description        |
| --------------- | ------------------ |
| **Flow Name**   | Sign Out           |
| **User Role**   | Authenticated User |
| **Entry Point** | Header/Settings    |
| **Exit Point**  | Home page (guest)  |
| **Goal**        | End user session   |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│     State       │
└────────┬────────┘
         │ Click "Sign Out"
         ▼
┌─────────────────┐
│  Destroy        │
│  Session        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Home Page      │
│  (Guest)        │
└─────────────────┘
```

---

# 2. Recipe Flows

## 2.1 Browse Recipes Flow

### Flow Overview

| Aspect          | Description               |
| --------------- | ------------------------- |
| **Flow Name**   | Browse Recipes            |
| **User Role**   | Guest, Authenticated User |
| **Entry Point** | `/recipes`                |
| **Exit Point**  | Recipe detail page        |
| **Goal**        | Discover and view recipes |

### Flow Diagram

```
┌─────────────────┐
│   Home Page     │
└────────┬────────┘
         │ Click "See All Recipes"
         ▼
┌─────────────────┐
│  Recipes Page   │
│  /recipes       │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  Apply Filters  │  │  Apply Sort     │
│  (Optional)     │  │  (Optional)     │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └────────┬───────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  View Recipe    │
         │  Cards          │
         └────────┬────────┘
                  │ Click recipe
                  ▼
         ┌─────────────────┐
         │  Recipe Detail  │
         │  /recipes/[slug]│
         └─────────────────┘
```

### Steps

| Step | Action                   | System Response           |
| ---- | ------------------------ | ------------------------- |
| 1    | Navigate to recipes page | Display all recipes       |
| 2    | Optionally apply filters | Filter recipes            |
| 3    | Optionally apply sort    | Sort recipes              |
| 4    | Click recipe card        | Navigate to recipe detail |

---

## 2.2 Search Recipes Flow

### Flow Overview

| Aspect          | Description                     |
| --------------- | ------------------------------- |
| **Flow Name**   | Search Recipes                  |
| **User Role**   | Guest, Authenticated User       |
| **Entry Point** | Header search bar               |
| **Exit Point**  | Recipe detail or search results |
| **Goal**        | Find specific recipes           |

### Flow Diagram

```
┌─────────────────┐
│  Header Search  │
│  Bar            │
└────────┬────────┘
         │ Type query (3+ chars)
         ▼
┌─────────────────┐
│  Show           │
│  Suggestions    │
└────────┬────────┘
         │
    ┌────┴────────┐
    │             │
 Click         Click
 Suggestion    "View All"
    │             │
    ▼             ▼
┌───────────┐ ┌─────────────────┐
│ Recipe    │ │ Search Results  │
│ Detail    │ │ /search?q=...   │
└───────────┘ └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Modify Query    │
              │ or Click Recipe │
              └─────────────────┘
```

### Steps

| Step | Action                     | System Response            |
| ---- | -------------------------- | -------------------------- |
| 1    | Click search bar           | Focus search input         |
| 2    | Type query (3+ characters) | Show suggestions dropdown  |
| 3a   | Click suggestion           | Navigate to recipe detail  |
| 3b   | Press Enter or "View All"  | Navigate to search results |
| 4    | View results               | Display matching recipes   |

---

## 2.3 View Recipe Detail Flow

### Flow Overview

| Aspect          | Description                          |
| --------------- | ------------------------------------ |
| **Flow Name**   | View Recipe Detail                   |
| **User Role**   | Guest, Authenticated User            |
| **Entry Point** | Recipe card                          |
| **Exit Point**  | Various (author, category, comments) |
| **Goal**        | View full recipe information         |

### Recipe Detail Sections

| Section           | Content                                  |
| ----------------- | ---------------------------------------- |
| Header            | Cover image, title, author, rating       |
| Information       | Prep time, servings, difficulty, cuisine |
| Actions           | Bookmark, rate, share                    |
| Ingredients       | Ingredient list with quantities          |
| Preparation Steps | Step-by-step instructions                |
| Comments          | User comments and replies                |

---

## 2.4 Create Recipe Flow

### Flow Overview

| Aspect          | Description                                          |
| --------------- | ---------------------------------------------------- |
| **Flow Name**   | Create Recipe                                        |
| **User Role**   | Authenticated User                                   |
| **Entry Point** | `/recipes/new`                                       |
| **Exit Point**  | Recipe detail page (published) or My Recipes (draft) |
| **Goal**        | Create and publish a new recipe                      |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Click "Add Recipe"
         ▼
┌─────────────────┐
│  Create Recipe  │
│  /recipes/new   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Fill Recipe Form                   │
│  • Title, Description, Cover Image  │
│  • Category, Difficulty, Time       │
│  • Servings, Cuisine                │
│  • Ingredients, Steps               │
└────────┬────────────────────────────┘
         │ Publish
         ▼
┌─────────────────┐
│  Recipe Created │
│  & Published    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Recipe Detail  │
│  Page           │
└─────────────────┘
```

### Steps

| Step | Action                    | System Response                             |
| ---- | ------------------------- | ------------------------------------------- |
| 1    | Navigate to create recipe | Display recipe form                         |
| 2    | Fill recipe details       | Client-side validation                      |
| 3    | Upload cover image        | Store image, show preview                   |
| 4    | Add ingredients           | Dynamic ingredient list                     |
| 5    | Add preparation steps     | Dynamic steps list                          |
| 6a   | Save as Draft             | Save draft, redirect to My Recipes          |
| 6b   | Publish                   | Validate, create recipe, redirect to detail |

### Validation Rules

| Field            | Validation                    |
| ---------------- | ----------------------------- |
| Title            | Required, unique slug         |
| Cover Image      | Required, image file, max 5MB |
| Category         | Required                      |
| Difficulty       | Required (EASY, MEDIUM, HARD) |
| Preparation Time | Required, > 0                 |
| Servings         | Required, > 0                 |
| Ingredients      | At least 1 required           |
| Steps            | At least 1 required           |

---

## 2.5 Edit Recipe Flow

### Flow Overview

| Aspect          | Description                  |
| --------------- | ---------------------------- |
| **Flow Name**   | Edit Recipe                  |
| **User Role**   | Recipe Owner                 |
| **Entry Point** | Recipe detail page           |
| **Exit Point**  | Recipe detail page (updated) |
| **Goal**        | Modify existing recipe       |

### Flow Diagram

```
┌─────────────────┐
│  Own Recipe     │
│  Detail Page    │
│  or Own Recipe  │
│  Card           │
└────────┬────────┘
         │ Click "Edit"
         ▼
┌─────────────────┐
│  Edit Recipe    │
│ /recipes/[slug]/│
│ edit            │
└────────┬────────┘
         │ Pre-filled form
         │ Modify fields
         |
    ┌────┴────┐
    │         │
 Cancel      Sumbit
 Changes     Changes
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────────┐
│ Reset   │ │ Recipe Updated  │
│ Form    │ └────────┬────────┘
└─────────┘          │
                     ▼
            ┌─────────────────┐
            │ Recipe Detail   │
            │ Page            │
            └─────────────────┘
```

---

## 2.6 Delete Recipe Flow

### Flow Overview

| Aspect          | Description                 |
| --------------- | --------------------------- |
| **Flow Name**   | Delete Recipe               |
| **User Role**   | Recipe Owner                |
| **Entry Point** | Recipe detail or My Recipes |
| **Exit Point**  | My Recipes page             |
| **Goal**        | Remove recipe from platform |

### Flow Diagram

```
┌─────────────────┐
│  Own Recipe     │
└────────┬────────┘
         │ Click "Delete"
         ▼
┌─────────────────┐
│  Confirm        │
│  Deletion       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 Cancel      Confirm
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────────┐
│ Recipe  │ │ Soft Delete     │
│ Detail  │ │ Recipe          │
└─────────┘ └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ My Recipes      │
            │ Page            │
            └─────────────────┘
```

---

## 2.7 Browse by Category Flow

### Flow Overview

| Aspect          | Description                  |
| --------------- | ---------------------------- |
| **Flow Name**   | Browse by Category           |
| **User Role**   | Guest, Authenticated User    |
| **Entry Point** | Home or `/categories`        |
| **Exit Point**  | Recipe detail page           |
| **Goal**        | Discover recipes by category |

### Flow Diagram

```
┌─────────────────┐
│   Home Page     │
└────────┬────────┘
         │ Click Category Card
         ▼
┌─────────────────┐
│  Category Page  │
│ /categories/    │
│ [slug]          │
└────────┬────────┘
         │
    ┌────┴────────┐
    │             │
 Apply         Apply
 Filters       Sort
    │             │
    └─────┬───────┘
          │
          ▼
┌─────────────────┐
│  View Recipe    │
│  Grid           │
└────────┬────────┘
         │ Click Recipe
         ▼
┌─────────────────┐
│  Recipe Detail  │
└─────────────────┘
```

---

## 2.8 View My Recipes Flow

### Flow Overview

| Aspect          | Description               |
| --------------- | ------------------------- |
| **Flow Name**   | View My Recipes           |
| **User Role**   | Authenticated User        |
| **Entry Point** | `/my-recipes`             |
| **Exit Point**  | Edit recipe or create new |
| **Goal**        | Manage own recipes        |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Click "Profile"
         ▼
┌─────────────────────┐
│  Profile            │
│  /settings/profile  │
└────────┬────────────┘
         │
    ┌────┴──────────┬───────────┐
    │               │           │
    ▼               ▼           ▼
┌─────────────┐ ┌─────────┐ ┌───────────┐
│ View        │ │ Edit My │ │ Delete My │
│ My Recipes  │ │ Recipe  │ │ Recipe    │
└─────────────┘ └─────────┘ └───────────┘
```

---

## 2.9 View Home Feed Flow

### Flow Overview

| Aspect          | Description                             |
| --------------- | --------------------------------------- |
| **Flow Name**   | View Home Feed                          |
| **User Role**   | Guest, Authenticated User               |
| **Entry Point** | `/`                                     |
| **Exit Point**  | Various (recipes, categories, profiles) |
| **Goal**        | Discover popular content                |

### Flow Diagram

```
┌─────────────────┐
│   Home Page     │
│        /        │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    │         │            │            │
    ▼         ▼            ▼            ▼
┌──────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│Popular   │ │Popular  │ │Popular  │ │Following│
│Categories│ │Recipes  │ │ Chefs   │ │ Feed*   │
└────┬─────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │            │           │           │
     │            │           │           │
     ▼            ▼           ▼           ▼
┌──────────────────────────────────────────────┐
│               Click "See More"               │
└────┬────────────┬───────────┬────────────────┘
     │            │           │           │
     ▼            ▼           ▼           ▼
Categories     Recipes     Profiles   Following
                                       Recipes
```

\*Following Feed only visible to authenticated users.

---

## 2.10 View Bookmarked Recipes Flow

### Flow Overview

| Aspect          | Description          |
| --------------- | -------------------- |
| **Flow Name**   | View Bookmarks       |
| **User Role**   | Authenticated User   |
| **Entry Point** | `/bookmarks`         |
| **Exit Point**  | Recipe detail page   |
| **Goal**        | Access saved recipes |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Click "Bookmarks"
         ▼
┌─────────────────┐
│  Bookmarks Page │
│  /bookmarks     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  View Saved     │
│  Recipe Cards   │
└────────┬────────┘
         │ Click Recipe
         ▼
┌─────────────────┐
│  Recipe Detail  │
└─────────────────┘
```

---

# 3. User Profile Flows

## 3.1 View Own Profile Flow

### Flow Overview

| Aspect          | Description                        |
| --------------- | ---------------------------------- |
| **Flow Name**   | View Own Profile                   |
| **User Role**   | Authenticated User                 |
| **Entry Point** | Header/Navigation                  |
| **Exit Point**  | Edit profile, followers, following |
| **Goal**        | View personal profile and recipes  |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Click Profile Avatar
         ▼
┌───────────────────┐
│  My Profile       │
│  /setting/profile │
└────────┬──────────┘
         │
    ┌────┴────────┬────────────┐
    │             │            │
    ▼             ▼            ▼
┌─────────┐ ┌─────────┐ ┌───────────┐
│ Edit    │ │ View    │ │ View      │
│ Profile │ │Followers│ │ Following │
└─────────┘ └─────────┘ └───────────┘
```

---

## 3.2 View Other User Profile Flow

### Flow Overview

| Aspect          | Description                         |
| --------------- | ----------------------------------- |
| **Flow Name**   | View Other User Profile             |
| **User Role**   | Guest, Authenticated User           |
| **Entry Point** | Recipe author, comment, follow list |
| **Exit Point**  | Recipe detail, follow action        |
| **Goal**        | View other user's public profile    |

### Flow Diagram

```
┌─────────────────┐
│  Click Username │
│  (Any context)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Profile   │
│ /profile/[user] │
└────────┬────────┘
         │
    ┌────┼────────┬────────────┐
    │    │        │            │
    ▼    ▼        ▼            ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌───────────┐
│View │ │View │ │View │ │ Follow    │
│Bio  │ │Stats│ │Social│ │ (Auth)    │
└─────┘ └─────┘ └─────┘ └───────────┘
         │
         ▼
┌─────────────────┐
│  View User's    │
│  Recipes        │
└────────┬────────┘
         │ Click Recipe
         ▼
┌─────────────────┐
│  Recipe Detail  │
└─────────────────┘
```

### Profile Sections

| Section      | Content                                    |
| ------------ | ------------------------------------------ |
| Header       | Avatar, username, full name, title         |
| Statistics   | Recipe count, followers, following, rating |
| Bio          | User biography                             |
| Social Links | Instagram, Telegram, X (Twitter)           |
| Actions      | Follow/Unfollow (other profiles)           |
| Recipes      | User's published recipes                   |

---

## 3.3 Edit Profile Flow

### Flow Overview

| Aspect          | Description                |
| --------------- | -------------------------- |
| **Flow Name**   | Edit Profile               |
| **User Role**   | Authenticated User         |
| **Entry Point** | `/profile/edit`            |
| **Exit Point**  | Profile page (updated)     |
| **Goal**        | Update profile information |

### Flow Diagram

```
┌─────────────────┐
│  Own Profile    │
└────────┬────────┘
         │ Click "Edit Profile"
         ▼
┌─────────────────┐
│  Edit Profile   │
│ /profile/edit   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Modify Profile                     │
│  • Full Name                        │
│  • Bio                              │
│  • Avatar                           │
│  • Social Links                     │
└────────┬────────────────────────────┘
         │ Save Changes
         ▼
┌─────────────────┐
│  Profile        │
│  Updated        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Profile Page   │
└─────────────────┘
```

### Steps

| Step | Action                  | System Response          |
| ---- | ----------------------- | ------------------------ |
| 1    | Navigate to own profile | Display profile page     |
| 2    | Click "Edit Profile"    | Navigate to edit form    |
| 3    | Modify fields           | Client-side validation   |
| 4    | Save changes            | Update profile, redirect |

---

## 3.4 Upload Avatar Flow

### Flow Overview

| Aspect          | Description                 |
| --------------- | --------------------------- |
| **Flow Name**   | Upload Avatar               |
| **User Role**   | Authenticated User          |
| **Entry Point** | Edit profile page           |
| **Exit Point**  | Edit profile page (updated) |
| **Goal**        | Change profile picture      |

### Flow Diagram

```
┌─────────────────┐
│  Edit Profile   │
└────────┬────────┘
         │ Click Avatar
         ▼
┌─────────────────┐
│  Select Image   │
│  (File Dialog)  │
└────────┬────────┘
         │ Select file
         ▼
┌─────────────────┐
│  Validate Image │
│  (Type, Size)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Invalid    Valid
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  Upload Image   │
│ Msg   │  └────────┬────────┘
└───────┘           │
                    │ Save
                    ▼
           ┌─────────────────┐
           │  Avatar         │
           │  Updated        │
           └─────────────────┘
```

### Validation Rules

| Rule      | Value          |
| --------- | -------------- |
| File Type | JPG, PNG, WebP |
| Max Size  | 5 MB           |

---

## 3.5 Manage Social Links Flow

### Flow Overview

| Aspect          | Description                             |
| --------------- | --------------------------------------- |
| **Flow Name**   | Manage Social Links                     |
| **User Role**   | Authenticated User                      |
| **Entry Point** | Edit profile page                       |
| **Exit Point**  | Edit profile page (updated)             |
| **Goal**        | Add, edit, or remove social media links |

### Flow Diagram

```
┌─────────────────┐
│  Edit Profile   │
└────────┬────────┘
         │
    ┌────┴────────┬────────────┐
    │             │            │
    ▼             ▼            ▼
┌─────────┐ ┌─────────┐ ┌───────────┐
│ Add     │ │ Edit    │ │ Remove    │
│ Link    │ │ Link    │ │ Link      │
└────┬────┘ └────┬────┘ └─────┬─────┘
     │           │             │
     └───────────┴─────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Save Changes   │
        └─────────────────┘
```

### Supported Platforms

| Platform    | Format          |
| ----------- | --------------- |
| Instagram   | Username or URL |
| Telegram    | Username or URL |
| X (Twitter) | Username or URL |

---

# 4. Social Flows

## 4.1 Follow User Flow

### Flow Overview

| Aspect          | Description                 |
| --------------- | --------------------------- |
| **Flow Name**   | Follow User                 |
| **User Role**   | Authenticated User          |
| **Entry Point** | Profile page, Recipe detail |
| **Exit Point**  | Profile page (following)    |
| **Goal**        | Follow another user         |

### Flow Diagram

```
┌─────────────────┐
│  User Profile   │
│  (Other User)   │
└────────┬────────┘
         │ Click "Follow"
         ▼
┌─────────────────┐
│  Check Auth     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Guest     Authenticated
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│Prompt │  │  Create Follow  │
│Sign In│  │  Relationship   │
└───────┘  └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Update Stats   │
           │  (Both Users)   │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Button Changes │
           │  to "Unfollow"  │
           └─────────────────┘
```

### Steps

| Step | Action                    | System Response                  |
| ---- | ------------------------- | -------------------------------- |
| 1    | View other user's profile | Display profile                  |
| 2    | Click "Follow" button     | Create follow relationship       |
| 3    | Follow created            | Update follower/following counts |

---

## 4.2 Unfollow User Flow

### Flow Overview

| Aspect          | Description                  |
| --------------- | ---------------------------- |
| **Flow Name**   | Unfollow User                |
| **User Role**   | Authenticated User           |
| **Entry Point** | Profile page, Following list |
| **Exit Point**  | Profile page (not following) |
| **Goal**        | Unfollow a user              |

### Flow Diagram

```
┌─────────────────┐
│  User Profile   │
│  (Following)    │
└────────┬────────┘
         │ Click "Unfollow"
         ▼
┌─────────────────┐
│  Remove Follow  │
│  Relationship   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update Stats   │
│  (Both Users)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Button Changes │
│  to "Follow"    │
└─────────────────┘
```

---

## 4.3 View Followers Flow

### Flow Overview

| Aspect          | Description                           |
| --------------- | ------------------------------------- |
| **Flow Name**   | View Followers                        |
| **User Role**   | Authenticated User (own profile only) |
| **Entry Point** | Own profile page                      |
| **Exit Point**  | Other user's profile                  |
| **Goal**        | View list of followers                |

### Flow Diagram

```
┌─────────────────┐
│  Own Profile    │
└────────┬────────┘
         │ Click "Followers" count
         ▼
┌─────────────────┐
│  Followers List │
│ /profile/[user]/│
│ followers       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  View Follower  │
│  Cards          │
└────────┬────────┘
         │ Click user
         ▼
┌─────────────────┐
│  User Profile   │
└─────────────────┘
```

### List Display

| Element       | Description                 |
| ------------- | --------------------------- |
| Avatar        | User profile picture        |
| Username      | User's username             |
| Title         | User's title (Chef, etc.)   |
| Rating        | User's average rating       |
| Recipe Count  | Number of published recipes |
| Follow Button | Follow/unfollow action      |

---

## 4.4 View Following Flow

### Flow Overview

| Aspect          | Description                           |
| --------------- | ------------------------------------- |
| **Flow Name**   | View Following                        |
| **User Role**   | Authenticated User (own profile only) |
| **Entry Point** | Own profile page                      |
| **Exit Point**  | Other user's profile                  |
| **Goal**        | View list of followed users           |

### Flow Diagram

```
┌─────────────────┐
│  Own Profile    │
└────────┬────────┘
         │ Click "Following" count
         ▼
┌─────────────────┐
│  Following List │
│ /profile/[user]/│
│ following       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  View Following │
│  User Cards     │
└────────┬────────┘
         │ Click user
         ▼
┌─────────────────┐
│  User Profile   │
└─────────────────┘
```

---

# 5. Interaction Flows

## 5.1 Bookmark Recipe Flow

### Flow Overview

| Aspect          | Description                     |
| --------------- | ------------------------------- |
| **Flow Name**   | Bookmark Recipe                 |
| **User Role**   | Authenticated User              |
| **Entry Point** | Recipe card, Recipe detail page |
| **Exit Point**  | Same page (bookmarked)          |
| **Goal**        | Save recipe for later access    |

### Flow Diagram

```
┌─────────────────┐
│  Recipe         │
│  (Any context)  │
└────────┬────────┘
         │ Click Bookmark icon
         ▼
┌─────────────────┐
│  Check Auth     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Guest     Authenticated
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│Prompt │  │  Add Bookmark   │
│Sign In│  └────────┬────────┘
└───────┘           │
                    ▼
           ┌─────────────────┐
           │  Update Stats   │
           │  Show Bookmarked│
           └─────────────────┘
```

### Steps

| Step | Action              | System Response            |
| ---- | ------------------- | -------------------------- |
| 1    | View recipe         | Display bookmark icon      |
| 2    | Click bookmark icon | Check authentication       |
| 3    | Authenticated       | Add bookmark, update stats |
| 4    | Icon changes        | Show bookmarked state      |

### Error States

| Error              | Trigger            | Resolution              |
| ------------------ | ------------------ | ----------------------- |
| Not authenticated  | Guest user         | Prompt to sign in       |
| Already bookmarked | Duplicate bookmark | Remove bookmark instead |

---

## 5.2 Remove Bookmark Flow

### Flow Overview

| Aspect          | Description                                |
| --------------- | ------------------------------------------ |
| **Flow Name**   | Remove Bookmark                            |
| **User Role**   | Authenticated User                         |
| **Entry Point** | Recipe card, Recipe detail, Bookmarks page |
| **Exit Point**  | Same page (unbookmarked)                   |
| **Goal**        | Remove saved recipe                        |

### Flow Diagram

```
┌─────────────────┐
│  Bookmarked     │
│  Recipe         │
└────────┬────────┘
         │ Click Bookmark icon
         ▼
┌─────────────────┐
│  Remove         │
│  Bookmark       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update Stats   │
│  Show Unbookmarked│
└─────────────────┘
```

---

## 5.3 Rate Recipe Flow

### Flow Overview

| Aspect          | Description                |
| --------------- | -------------------------- |
| **Flow Name**   | Rate Recipe                |
| **User Role**   | Authenticated User         |
| **Entry Point** | Recipe detail page         |
| **Exit Point**  | Recipe detail page (rated) |
| **Goal**        | Submit rating for recipe   |

### Flow Diagram

```
┌─────────────────┐
│  Recipe Detail  │
│  (Not Own)      │
└────────┬────────┘
         │ Click star rating
         ▼
┌─────────────────┐
│  Check Auth     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Guest     Authenticated
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│Prompt │  │  Select Rating  │
│Sign In│  │  (1-5 stars)    │
└───────┘  └────────┬────────┘
                    │ Submit
                    ▼
           ┌─────────────────┐
           │  Save Rating    │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Update Recipe  │
           │  Stats          │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Update Author  │
           │  Stats          │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Show Rating    │
           └─────────────────┘
```

### Steps

| Step | Action             | System Response                |
| ---- | ------------------ | ------------------------------ |
| 1    | View recipe detail | Display rating component       |
| 2    | Click star (1-5)   | Select rating                  |
| 3    | Submit rating      | Save to database               |
| 4    | Rating saved       | Update recipe average rating   |
| 5    | Stats updated      | Update author's average rating |

### Error States

| Error             | Trigger                | Resolution             |
| ----------------- | ---------------------- | ---------------------- |
| Not authenticated | Guest user             | Prompt to sign in      |
| Own recipe        | User owns recipe       | Cannot rate own recipe |
| Already rated     | Previous rating exists | Update previous rating |

---

## 5.4 Post Comment Flow

### Flow Overview

| Aspect          | Description                        |
| --------------- | ---------------------------------- |
| **Flow Name**   | Post Comment                       |
| **User Role**   | Authenticated User                 |
| **Entry Point** | Recipe detail page                 |
| **Exit Point**  | Recipe detail page (comment added) |
| **Goal**        | Share feedback on recipe           |

### Flow Diagram

```
┌─────────────────┐
│  Recipe Detail  │
└────────┬────────┘
         │ Scroll to comments
         ▼
┌─────────────────┐
│  Comment Form   │
└────────┬────────┘
         │ Type comment
         │ Submit
         ▼
┌─────────────────┐
│  Validate       │
│  (Length)       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Invalid    Valid
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  Save Comment   │
│ Msg   │  └────────┬────────┘
└───────┘           │
                    ▼
           ┌─────────────────┐
           │  Update Comment │
           │  Count          │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Show Comment   │
           └─────────────────┘
```

### Steps

| Step | Action               | System Response                |
| ---- | -------------------- | ------------------------------ |
| 1    | Navigate to recipe   | Display comments section       |
| 2    | Type comment in form | Character counter shown        |
| 3    | Submit comment       | Validate length (1-1000 chars) |
| 4    | Comment saved        | Add to comment list            |
| 5    | Stats updated        | Update recipe comment count    |

### Validation Rules

| Rule           | Value           |
| -------------- | --------------- |
| Minimum Length | 1 character     |
| Maximum Length | 1000 characters |

---

## 5.5 React to Comment Flow

### Flow Overview

| Aspect          | Description                           |
| --------------- | ------------------------------------- |
| **Flow Name**   | React to Comment                      |
| **User Role**   | Authenticated User                    |
| **Entry Point** | Recipe detail page (comments section) |
| **Exit Point**  | Same page (reaction added/removed)    |
| **Goal**        | Like or dislike a comment             |

### Flow Diagram

```
┌─────────────────┐
│  Comment        │
└────────┬────────┘
         │ Click Like/Dislike
         ▼
┌─────────────────┐
│  Check Auth     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Guest     Authenticated
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│Prompt │  │  Check Current  │
│Sign In│  │  Reaction       │
└───────┘  └────────┬────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
     No Reaction  Same      Different
         │       Reaction   Reaction
         │          │          │
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────────┐
    │ Add    │ │ Remove │ │ Change to  │
    │Reaction│ │Reaction│ │ New One    │
    └────────┘ └────────┘ └────────────┘
```

### Steps

| Step | Action                | System Response           |
| ---- | --------------------- | ------------------------- |
| 1    | View comment          | Show like/dislike buttons |
| 2    | Click like or dislike | Check authentication      |
| 3    | Authenticated         | Process reaction          |
| 4    | Update stats          | Update like/dislike count |

### Business Rules

| Rule                     | Description                             |
| ------------------------ | --------------------------------------- |
| One reaction per comment | User can only like OR dislike           |
| Toggle same reaction     | Clicking same button removes reaction   |
| Switch reaction          | Clicking other button switches reaction |

---

## 5.6 Reply to Comment Flow (Recipe Owner)

### Flow Overview

| Aspect          | Description                      |
| --------------- | -------------------------------- |
| **Flow Name**   | Reply to Comment                 |
| **User Role**   | Recipe Owner                     |
| **Entry Point** | Recipe detail page (own recipe)  |
| **Exit Point**  | Recipe detail page (reply added) |
| **Goal**        | Respond to user feedback         |

### Flow Diagram

```
┌─────────────────┐
│  Own Recipe     │
│  Comments       │
└────────┬────────┘
         │ Click "Reply"
         ▼
┌─────────────────┐
│  Reply Form     │
└────────┬────────┘
         │ Type reply
         │ Submit
         ▼
┌─────────────────┐
│  Save Reply     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Show Reply     │
│  Under Comment  │
└─────────────────┘
```

### Steps

| Step | Action                      | System Response           |
| ---- | --------------------------- | ------------------------- |
| 1    | View comments on own recipe | Show reply button         |
| 2    | Click "Reply"               | Show reply form           |
| 3    | Type reply                  | Character counter shown   |
| 4    | Submit reply                | Save as nested comment    |
| 5    | Reply displayed             | Show under parent comment |

---

# 6. Support Flows

## 6.1 Submit Support Ticket Flow

### Flow Overview

| Aspect          | Description                     |
| --------------- | ------------------------------- |
| **Flow Name**   | Submit Support Ticket           |
| **User Role**   | Authenticated User              |
| **Entry Point** | `/support`                      |
| **Exit Point**  | Support page (ticket submitted) |
| **Goal**        | Contact support team for help   |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Navigate to Support
         ▼
┌─────────────────┐
│  Support Page   │
│  /support       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Support Form   │
└────────┬────────┘
         │ Type message
         │ Submit
         ▼
┌─────────────────┐
│  Validate       │
│  Message        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  Invalid    Valid
    │         │
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  Create Ticket  │
│ Msg   │  └────────┬────────┘
└───────┘           │
                    ▼
           ┌─────────────────┐
           │  Show Success   │
           │  Message        │
           └─────────────────┘
```

### Steps

| Step | Action                   | System Response               |
| ---- | ------------------------ | ----------------------------- |
| 1    | Navigate to support page | Display support form          |
| 2    | Type message             | Character counter shown       |
| 3    | Submit ticket            | Validate message              |
| 4    | Ticket created           | Save to database              |
| 5    | Success shown            | Clear form, show confirmation |

### Ticket States

| State       | Description                   |
| ----------- | ----------------------------- |
| Open        | New ticket, not yet addressed |
| In Progress | Support team working on it    |
| Resolved    | Issue resolved                |
| Closed      | Ticket closed                 |

---

## 6.2 Rate Support Experience Flow

### Flow Overview

| Aspect          | Description                           |
| --------------- | ------------------------------------- |
| **Flow Name**   | Rate Support Experience               |
| **User Role**   | Authenticated User                    |
| **Entry Point** | Notification (resolved/closed ticket) |
| **Exit Point**  | Notification (rating submitted)       |
| **Goal**        | Provide feedback on support quality   |

### Flow Diagram

```
┌─────────────────┐
│  Notification   │
│  (Ticket        │
│  Resolved)      │
└────────┬────────┘
         │ Click notification
         ▼
┌─────────────────┐
│  View Ticket    │
│  Details        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rate Support   │
│  (1-5 stars)    │
└────────┬────────┘
         │ Submit rating
         ▼
┌─────────────────┐
│  Save Rating    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rating         │
│  Submitted      │
└─────────────────┘
```

### Steps

| Step | Action               | System Response        |
| ---- | -------------------- | ---------------------- |
| 1    | Receive notification | Ticket resolved/closed |
| 2    | Click notification   | View ticket details    |
| 3    | Select rating (1-5)  | Rate support quality   |
| 4    | Submit rating        | Save rating to ticket  |

### Business Rules

| Rule       | Description                             |
| ---------- | --------------------------------------- |
| Timing     | Only after ticket is Resolved or Closed |
| One rating | Can only rate once per ticket           |
| Optional   | Rating is not required                  |

---

# 7. Settings Flows

## 7.1 View Settings Flow

### Flow Overview

| Aspect          | Description               |
| --------------- | ------------------------- |
| **Flow Name**   | View Settings             |
| **User Role**   | Authenticated User        |
| **Entry Point** | Header/Profile menu       |
| **Exit Point**  | Various settings sections |
| **Goal**        | Access account settings   |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Click "Settings"
         ▼
┌─────────────────┐
│  Settings Page  │
│  /settings      │
└────────┬────────┘
         │
    ┌────┼────────┬────────────┐
    │    │        │            │
    ▼    ▼        ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐
│ Profile  │ │ Password │ │ Privacy  │ │ Logout │
│ Settings │ │          │ │ Settings │ │        │
└──────────┘ └──────────┘ └──────────┘ └────────┘
```

### Settings Sections

| Section  | Options                                |
| -------- | -------------------------------------- |
| Profile  | Full name, bio, avatar, social links   |
| Password | Current password, new password         |
| Privacy  | Show/hide bio, social links visibility |
| Logout   | Sign out of account                    |

---

## 7.2 Update Privacy Settings Flow

### Flow Overview

| Aspect          | Description                |
| --------------- | -------------------------- |
| **Flow Name**   | Update Privacy Settings    |
| **User Role**   | Authenticated User         |
| **Entry Point** | `/settings`                |
| **Exit Point**  | Settings page (updated)    |
| **Goal**        | Control profile visibility |

### Flow Diagram

```
┌───────────────────┐
│     Profile       │
│ /settings/profile │
└────────┬──────────┘
         │
    ┌────┴────────┐
    │             │
    ▼             ▼
┌──────────┐ ┌──────────────┐
│  Edit or │ │    Edit or   │
│  Remove  │ │    Remove    │
│    Bio   │ │ Socail links │
└────┬─────┘ └─────┬────────┘
     │             │
     └─────┬───────┘
           │
           ▼
    ┌─────────────────┐
    │  Save Changes   │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Settings       │
    │  Updated        │
    └─────────────────┘
```

### Privacy Options

| Option            | Description                            |
| ----------------- | -------------------------------------- |
| Show Bio          | Toggle biography visibility on profile |
| Show Social Links | Toggle social media links visibility   |

---

# 8. Notification Flows

## 8.1 View Notifications Flow

### Flow Overview

| Aspect          | Description                       |
| --------------- | --------------------------------- |
| **Flow Name**   | View Notifications                |
| **User Role**   | Authenticated User                |
| **Entry Point** | Header notification icon          |
| **Exit Point**  | Related content (recipe, comment) |
| **Goal**        | View and manage notifications     |

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  State          │
└────────┬────────┘
         │ Click Notification icon
         ▼
┌─────────────────┐
│  Notifications  │
│  Page           │
│  /notifications │
└────────┬────────┘
         │
    ┌────┴────────┐
    │             │
    ▼             ▼
┌─────────┐ ┌─────────┐
│ Open    │ │ Delete  │
│ Notif   │ │ Notif   │
└────┬────┘ └─────────┘
     │
     ▼
┌───────────┐
│ Mark as   │
│ Read      │
└────┬──────┘
     │
     ▼
┌─────────────────┐
│   Navigate to   │
│ Related Content │
└─────────────────┘
```

### Notification Types

| Type                | Icon | Description                          |
| ------------------- | ---- | ------------------------------------ |
| Recipe Rating       | ⭐   | Someone rated your recipe            |
| Recipe Comment      | 💬   | Someone commented on your recipe     |
| Comment Like        | 👍   | Someone liked your comment           |
| Comment Dislike     | 👎   | Someone disliked your comment        |
| Comment Reply       | ↩️   | Recipe owner replied to your comment |
| System Announcement | 📢   | Platform-wide announcements          |

### Steps

| Step | Action                  | System Response                |
| ---- | ----------------------- | ------------------------------ |
| 1    | Click notification icon | Navigate to notifications page |
| 2    | View notifications      | List ordered by newest first   |
| 3    | Click notification      | Navigate to related content    |
| 4    | Open notification       | Mark as read automatically     |

---

## 8.2 Delete Notification Flow

### Flow Overview

| Aspect          | Description                               |
| --------------- | ----------------------------------------- |
| **Flow Name**   | Delete Notification                       |
| **User Role**   | Authenticated User                        |
| **Entry Point** | Notifications page                        |
| **Exit Point**  | Notifications page (notification removed) |
| **Goal**        | Remove notification from list             |

### Flow Diagram

```
┌─────────────────┐
│  Notification   │
│  Item           │
└────────┬────────┘
         │ Click Delete icon
         ▼
┌─────────────────┐
│  Open Confirm   │
│     Modal       │
└───────┬─────────┘
        │
   ┌────┴──────────────┐
   │                   │
   ▼                   ▼
┌──────────────┐    ┌────────┐
│    Submit    │    │ Cancel │
│    Remove    │    │ Remove │
└──────┬───────┘    └────┬───┘
       │                 │
       ▼                 ▼
┌─────────────┐     ┌─────────────┐
│ Update List │     │ Close Modal │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ Close Modal │
└─────────────┘
```

---

# 9. Error & Edge Case Flows

## 9.1 Authentication Required Flow

### Flow Overview

When a guest attempts to perform an authenticated action.

### Flow Diagram

```
┌─────────────────┐
│  Guest User     │
└────────┬────────┘
         │ Attempt restricted action
         ▼
┌─────────────────┐
│  Check Auth     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Show Auth      │
│  Prompt         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 Sign In    Register
    │         │
    ▼         ▼
┌─────────┐ ┌───────────┐
│ Login   │ │ Register  │
│ Page    │ │ Page      │
└─────────┘ └───────────┘
```

### Actions Requiring Authentication

| Action          | Prompt Message               |
| --------------- | ---------------------------- |
| Create Recipe   | "Sign in to create recipes"  |
| Bookmark Recipe | "Sign in to save recipes"    |
| Rate Recipe     | "Sign in to rate recipes"    |
| Post Comment    | "Sign in to comment"         |
| Follow User     | "Sign in to follow users"    |
| Submit Ticket   | "Sign in to contact support" |

---

## 9.2 Not Found Flow

### Flow Overview

When user navigates to non-existent content.

### Flow Diagram

```
┌─────────────────┐
│  Navigate to    │
│  Invalid URL    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Resource Not   │
│  Found          │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 Recipe    Other
 Not Found Not Found
    │         │
    ▼         ▼
┌─────────┐ ┌───────────┐
│ 404     │ │ 404       │
│ Recipe  │ │ Generic   │
│ Page    │ │ Page      │
└────┬────┘ └─────┬─────┘
     │             │
     └─────┬───────┘
           │
           ▼
    ┌─────────────────┐
    │  Return to      │
    │  Home           │
    └─────────────────┘
```

---

## 9.3 Session Expired Flow

### Flow Overview

When user session expires during activity.

### Flow Diagram

```
┌─────────────────┐
│  Authenticated  │
│  User           │
└────────┬────────┘
         │ Session expires
         ▼
┌─────────────────┐
│  API Request    │
│  Fails (401)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redirect to    │
│  Login Page     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Show Message:  │
│  "Session       │
│  Expired"       │
└─────────────────┘
```

---

# Appendix

## A. Flow Summary by User Role

### Guest Flows

| Flow               | Entry Point      | Goal            |
| ------------------ | ---------------- | --------------- |
| Registration       | /register        | Create account  |
| Sign In            | /login           | Access account  |
| Forgot Password    | /forgot-password | Reset password  |
| Browse Recipes     | /recipes         | View recipes    |
| Search Recipes     | Header search    | Find recipes    |
| View Recipe Detail | Recipe card      | View recipe     |
| Browse Categories  | /categories      | View categories |
| View User Profiles | Various          | View profiles   |

### Authenticated User Flows

| Flow            | Entry Point   | Goal            |
| --------------- | ------------- | --------------- |
| Sign Out        | Header        | End session     |
| Change Password | /settings     | Update password |
| Create Recipe   | /recipes/new  | Publish recipe  |
| Edit Recipe     | Recipe detail | Modify recipe   |
| Delete Recipe   | Recipe detail | Remove recipe   |
| Edit Profile    | /profile/edit | Update profile  |
| Follow User     | Profile page  | Build network   |
| Bookmark Recipe | Recipe card   | Save recipe     |
| Rate Recipe     | Recipe detail | Rate recipe     |
| Post Comment    | Recipe detail | Share feedback  |
| Submit Ticket   | /support      | Get help        |

### Recipe Owner Flows

| Flow               | Entry Point | Goal                |
| ------------------ | ----------- | ------------------- |
| Reply to Comments  | Own recipe  | Respond to feedback |
| Manage Own Recipes | /my-recipes | Manage content      |

---

## B. Navigation Paths

### Primary Navigation

```
Home (/)
├── Recipes (/recipes)
│   ├── Recipe Detail (/recipes/[slug])
│   └── Categories (/categories)
├── Search (/search)
├── Profile (/profile)
│   ├── Edit Profile (/profile/edit)
│   ├── Followers (/profile/[user]/followers)
│   └── Following (/profile/[user]/following)
├── Bookmarks (/bookmarks)
├── My Recipes (/my-recipes)
│   └── Create Recipe (/recipes/new)
├── Notifications (/notifications)
├── Settings (/settings)
└── Support (/support)
```

---

## C. State Transitions

### User States

```
Guest ──Register──► Authenticated User ──Sign Out──► Guest
```

### Recipe States

```
Draft ──Publish──► Published ──Delete──► Deleted
                      │
                      └──Edit──► Published
```

### Comment States

```
Not Commented ──Post──► Commented ──Delete──► Not Commented
```

### Bookmark States

```
Not Bookmarked ──Bookmark──► Bookmarked ──Remove──► Not Bookmarked
```

### Follow States

```
Not Following ──Follow──► Following ──Unfollow──► Not Following
```

---

## D. Response Time Expectations

| Action             | Expected Response |
| ------------------ | ----------------- |
| Page Navigation    | < 500ms           |
| Search Suggestions | < 300ms           |
| Form Submission    | < 1s              |
| Image Upload       | < 3s              |
| OTP Send           | < 5s              |

---

## E. Success/Error Messages

### Success Messages

| Action           | Message                         |
| ---------------- | ------------------------------- |
| Registration     | "Account created successfully"  |
| Sign In          | "Welcome back!"                 |
| Recipe Created   | "Recipe published successfully" |
| Profile Updated  | "Profile updated successfully"  |
| Bookmark Added   | "Recipe saved to bookmarks"     |
| Rating Submitted | "Rating submitted"              |
| Comment Posted   | "Comment added"                 |
| Ticket Submitted | "Support ticket created"        |

### Error Messages

| Error                 | Message                     |
| --------------------- | --------------------------- |
| Authentication Failed | "Invalid credentials"       |
| Not Found             | "Resource not found"        |
| Unauthorized          | "You don't have permission" |
| Validation Error      | "Please check your input"   |
| Server Error          | "Something went wrong"      |
| Network Error         | "Unable to connect"         |

---

_Document Version: 1.0_
_Last Updated: July 2026_
