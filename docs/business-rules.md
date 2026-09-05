# Business Rules

This document defines all business rules for the Loghmeh application.

Rules are organized by domain and include validation constraints, access control, and system behavior.

---

## Document Structure

### Rule Categories

1. **Authentication Rules** - Account creation, sign in, password management
2. **User Profile Rules** - Profile management, social links, statistics
3. **Recipe Rules** - Creation, editing, publishing, deletion
4. **Category Rules** - Category management, recipe assignment
5. **Interaction Rules** - Ratings, comments, bookmarks
6. **Social Rules** - Following system, notifications
7. **Support Rules** - Ticket management
8. **System Rules** - Security, file uploads, SEO, general

---

## Quick Reference

| Domain         | Rule Count | Primary Constraints                                        |
| -------------- | ---------- | ---------------------------------------------------------- |
| Authentication | 18         | Unique email/username, password strength, OTP verification |
| User Profile   | 12         | Single profile per user, immutable username                |
| Recipes        | 24         | Required fields, ownership, soft delete                    |
| Categories     | 8          | Unique names, recipe assignment                            |
| Interactions   | 20         | Auth required, ownership validation                        |
| Social         | 10         | No self-follow, unique relationships                       |
| Support        | 6          | Auth required, admin status management                     |
| System         | 15         | File validation, security, timestamps                      |

---

# 1. Authentication Rules

## 1.1 Registration Rules

| Rule ID  | Rule                                                                 | Priority |
| -------- | -------------------------------------------------------------------- | -------- |
| AUTH-001 | Every email address must be unique                                   | Critical |
| AUTH-002 | Every username must be unique                                        | Critical |
| AUTH-003 | Usernames may only contain English letters, numbers, and underscores | High     |
| AUTH-004 | Username length must be between 3-30 characters                      | High     |
| AUTH-005 | Passwords must contain at least 8 characters                         | Critical |
| AUTH-006 | Passwords must be stored as hashed values                            | Critical |
| AUTH-007 | Users cannot sign in until email is verified                         | Critical |
| AUTH-008 | Users are automatically signed in after successful registration      | Medium   |

## 1.2 Sign In Rules

| Rule ID  | Rule                                                            | Priority |
| -------- | --------------------------------------------------------------- | -------- |
| AUTH-009 | Users can sign in using either email address or username        | High     |
| AUTH-010 | A valid session must be created after successful authentication | Critical |
| AUTH-011 | Inactive or suspended users cannot sign in                      | High     |

## 1.3 Verification Code Rules

| Rule ID  | Rule                                                                              | Priority |
| -------- | --------------------------------------------------------------------------------- | -------- |
| AUTH-012 | Verification codes expire after 10 minutes                                        | High     |
| AUTH-013 | Verification codes can only be used once                                          | Critical |
| AUTH-014 | A new verification code invalidates any previous unused code for the same purpose | High     |
| AUTH-015 | Verification attempts are rate-limited to prevent abuse                           | Critical |
| AUTH-016 | Failed verification attempts are limited                                          | High     |
| AUTH-017 | Verification codes are sent only to the associated email address                  | Critical |

## 1.4 Password Management Rules

| Rule ID  | Rule                                                                     | Priority |
| -------- | ------------------------------------------------------------------------ | -------- |
| AUTH-018 | Only the account owner can change their password                         | Critical |
| AUTH-019 | New password must be different from the current password                 | High     |
| AUTH-020 | Password reset requires successful email verification                    | Critical |
| AUTH-021 | Password change requires verification of current password and email code | Critical |
| AUTH-022 | All sessions are invalidated after password change                       | High     |

---

# 2. User Profile Rules

## 2.1 Profile Ownership Rules

| Rule ID  | Rule                                                          | Priority |
| -------- | ------------------------------------------------------------- | -------- |
| PROF-001 | Every registered user owns exactly one profile                | Critical |
| PROF-002 | Usernames are unique and cannot be changed after registration | Critical |
| PROF-003 | Users can edit only their own profile                         | Critical |
| PROF-004 | Guests can view only public profile information               | High     |

## 2.2 Profile Content Rules

| Rule ID  | Rule                                                    | Priority |
| -------- | ------------------------------------------------------- | -------- |
| PROF-005 | Profile picture is optional                             | Low      |
| PROF-006 | Biography is optional with maximum 500 characters       | Medium   |
| PROF-007 | Users may provide one account per social media platform | Medium   |
| PROF-008 | Social media links are publicly visible                 | Medium   |

## 2.3 Profile Statistics Rules

| Rule ID  | Rule                                                             | Priority |
| -------- | ---------------------------------------------------------------- | -------- |
| PROF-009 | Every published recipe appears automatically on author's profile | High     |
| PROF-010 | Draft recipes are never displayed on public profiles             | Critical |
| PROF-011 | Recipe count includes only published recipes                     | High     |
| PROF-012 | Follower and following counts are updated automatically          | High     |

---

# 3. Recipe Rules

## 3.1 Recipe Creation Rules

| Rule ID | Rule                                              | Priority |
| ------- | ------------------------------------------------- | -------- |
| REC-001 | Only authenticated users can create recipes       | Critical |
| REC-002 | Every recipe must belong to exactly one category  | Critical |
| REC-003 | Every recipe must have a title                    | Critical |
| REC-004 | Recipe title cannot be empty                      | Critical |
| REC-005 | Every published recipe must have a unique slug    | Critical |
| REC-006 | Cover image is required for all recipes           | High     |
| REC-007 | Images must be valid image files (JPG, PNG, WebP) | High     |

## 3.2 Recipe Content Rules

| Rule ID | Rule                                                    | Priority |
| ------- | ------------------------------------------------------- | -------- |
| REC-009 | Every recipe must contain at least one ingredient       | Critical |
| REC-010 | Every recipe must contain at least one preparation step | Critical |
| REC-011 | Preparation time must be greater than zero              | High     |
| REC-012 | Serving size must be greater than zero                  | High     |
| REC-013 | Each preparation step must not exceed 1000 characters   | Medium   |

## 3.3 Recipe Ownership Rules

| Rule ID | Rule                                                             | Priority |
| ------- | ---------------------------------------------------------------- | -------- |
| REC-014 | Only the recipe owner can edit a recipe                          | Critical |
| REC-015 | Only the recipe owner can delete a recipe                        | Critical |
| REC-016 | Only the recipe owner can publish a draft recipe                 | Critical |
| REC-017 | The updatedAt timestamp must be updated after every modification | High     |

## 3.4 Recipe Deletion Rules

| Rule ID | Rule                                                                            | Priority |
| ------- | ------------------------------------------------------------------------------- | -------- |
| REC-018 | Soft delete must be used when deleting recipes                                  | High     |
| REC-019 | Deleting a recipe removes it from all public views immediately                  | High     |
| REC-020 | Deleting a recipe must properly handle related bookmarks, ratings, and comments | High     |

## 3.5 Recipe Publishing Rules

| Rule ID | Rule                                                      | Priority |
| ------- | --------------------------------------------------------- | -------- |
| REC-021 | Only valid recipes can be published                       | Critical |
| REC-022 | Published recipes are publicly accessible                 | High     |
| REC-023 | Recipes appear on author's profile only after publication | High     |
| REC-024 | Draft recipes are visible only to their author            | Critical |

---

# 4. Category Rules

## 4.1 Category Management Rules

| Rule ID | Rule                                               | Priority |
| ------- | -------------------------------------------------- | -------- |
| CAT-001 | Category names must be unique                      | Critical |
| CAT-002 | Every category must have a cover image             | High     |
| CAT-003 | Categories are displayed alphabetically by default | Medium   |

## 4.2 Category Assignment Rules

| Rule ID | Rule                                                        | Priority |
| ------- | ----------------------------------------------------------- | -------- |
| CAT-004 | Every recipe must belong to exactly one category            | Critical |
| CAT-005 | A recipe cannot exist without a category                    | Critical |
| CAT-006 | One category can contain multiple recipes                   | Medium   |
| CAT-007 | Recipe count is updated automatically                       | High     |
| CAT-008 | Categories without Featured Order do not appear on homepage | Medium   |

---

# 5. Interaction Rules

## 5.1 Bookmark Rules

| Rule ID  | Rule                                                        | Priority |
| -------- | ----------------------------------------------------------- | -------- |
| BKMK-001 | Only authenticated users can bookmark recipes               | Critical |
| BKMK-002 | A user can bookmark a recipe only once                      | Critical |
| BKMK-003 | Users can bookmark any published recipe including their own | Medium   |
| BKMK-004 | Bookmark status updates immediately after user interaction  | High     |
| BKMK-005 | Bookmarks are private and visible only to their owner       | High     |
| BKMK-006 | Removing a bookmark never affects the recipe itself         | High     |
| BKMK-007 | stats.bookmarkCount is automatically updated                | High     |

## 5.2 Rating Rules

| Rule ID  | Rule                                                             | Priority |
| -------- | ---------------------------------------------------------------- | -------- |
| RATE-001 | Only authenticated users can rate recipes                        | Critical |
| RATE-002 | Rating values must be integers between 1 and 5                   | Critical |
| RATE-003 | Users may update their rating at any time                        | Medium   |
| RATE-004 | Users cannot rate their own recipes                              | High     |
| RATE-005 | stats.averageRating is recalculated after each rating            | High     |
| RATE-006 | stats.ratingCount is updated automatically                       | High     |
| RATE-007 | Author's average rating is calculated from all published recipes | High     |

## 5.3 Comment Rules

| Rule ID | Rule                                                               | Priority |
| ------- | ------------------------------------------------------------------ | -------- |
| CMT-001 | Only authenticated users can create comments                       | Critical |
| CMT-002 | Comments cannot be empty                                           | Critical |
| CMT-003 | Comments must not exceed 1000 characters                           | High     |
| CMT-004 | Users can delete only their own comments                           | Critical |
| CMT-005 | Only the recipe owner can reply to comments                        | Critical |
| CMT-006 | A user can either like or dislike a comment (not both)             | High     |
| CMT-007 | Comments are displayed in chronological order (newest first)       | Medium   |
| CMT-008 | stats.commentCount is updated automatically for top-level comments | High     |

---

# 6. Social Rules

## 6.1 Following Rules

| Rule ID  | Rule                                                          | Priority |
| -------- | ------------------------------------------------------------- | -------- |
| FLLW-001 | Only authenticated users can follow other users               | Critical |
| FLLW-002 | Users cannot follow themselves                                | Critical |
| FLLW-003 | A follow relationship must be unique                          | Critical |
| FLLW-004 | Following updates follower and following counts automatically | High     |
| FLLW-005 | Only profile owner can access their Followers/Following pages | High     |
| FLLW-006 | Other users can only view follower and following counts       | Medium   |
| FLLW-007 | Home feed shows recipes from followed users (newest first)    | High     |

## 6.2 Notification Rules

| Rule ID | Rule                                                          | Priority |
| ------- | ------------------------------------------------------------- | -------- |
| NTF-001 | Only authenticated users receive notifications                | Critical |
| NTF-002 | Notifications are created automatically by the system         | High     |
| NTF-003 | Opening a notification marks it as read                       | Medium   |
| NTF-004 | Users can delete their own notifications                      | High     |
| NTF-005 | Recipe owners are notified for ratings and comments           | High     |
| NTF-006 | Comment authors are notified for likes, dislikes, and replies | High     |
| NTF-007 | Unread notification badge is updated automatically            | High     |

---

# 7. Support Rules

## 7.1 Support Ticket Rules

| Rule ID | Rule                                                                        | Priority |
| ------- | --------------------------------------------------------------------------- | -------- |
| SUP-001 | Only authenticated users can submit tickets                                 | Critical |
| SUP-002 | Every ticket belongs to exactly one user                                    | Critical |
| SUP-003 | Ticket status is managed only by administrators                             | High     |
| SUP-004 | Users cannot edit submitted tickets                                         | High     |
| SUP-005 | Users cannot delete submitted tickets                                       | High     |
| SUP-006 | Support rating can be updated in every ticket notification before its close | Medium   |
| SUP-007 | Users are notified when ticket status changes                               | High     |

---

# 8. System Rules

## 8.1 File Upload Rules

| Rule ID | Rule                                                 | Priority |
| ------- | ---------------------------------------------------- | -------- |
| SYS-001 | Only image files are allowed (JPG, PNG, WebP)        | Critical |
| SYS-002 | Maximum file size is 5 MB                            | High     |
| SYS-003 | Uploaded files must be validated before storage      | Critical |
| SYS-004 | Cover images are required for recipes and categories | High     |

## 8.2 Security Rules

| Rule ID | Rule                                                          | Priority |
| ------- | ------------------------------------------------------------- | -------- |
| SYS-005 | Users may only access resources they are authorized to access | Critical |
| SYS-006 | All sensitive operations require authentication               | Critical |
| SYS-007 | All user input must be validated                              | Critical |
| SYS-008 | Sensitive data must never be exposed to unauthorized users    | Critical |
| SYS-009 | All timestamps must be stored in UTC                          | High     |

## 8.3 Data Integrity Rules

| Rule ID | Rule                                                                  | Priority |
| ------- | --------------------------------------------------------------------- | -------- |
| SYS-010 | Every entity must include id, createdAt, and updatedAt fields         | Critical |
| SYS-011 | Soft deletion should be preferred whenever possible                   | High     |
| SYS-012 | All operations should return consistent and predictable responses     | High     |
| SYS-013 | Application errors should be handled gracefully                       | Critical |
| SYS-014 | Internal implementation details must not be exposed in error messages | High     |

## 8.4 SEO Rules

| Rule ID | Rule                                               | Priority |
| ------- | -------------------------------------------------- | -------- |
| SYS-015 | Every published recipe must have a unique slug     | Critical |
| SYS-016 | Recipe slugs should not change after publication   | High     |
| SYS-017 | Every published recipe should include SEO metadata | Medium   |

---

# Appendix

## Search Rules

| Rule ID | Rule                                                      | Priority |
| ------- | --------------------------------------------------------- | -------- |
| SRC-001 | Only published recipes appear in search results           | Critical |
| SRC-002 | Search is case-insensitive                                | Medium   |
| SRC-003 | Search supports Persian text                              | High     |
| SRC-004 | Search suggestions appear after at least three characters | Medium   |
| SRC-005 | Maximum of five suggestions are displayed                 | Low      |
| SRC-006 | Search results are ordered by relevance by default        | Medium   |
| SRC-007 | Draft recipes are never searchable                        | Critical |

## Filter and Sort Rules

| Rule ID | Rule                                                            | Priority |
| ------- | --------------------------------------------------------------- | -------- |
| FLT-001 | Users can apply multiple filters simultaneously                 | Medium   |
| FLT-002 | Only one sorting option can be active at a time                 | High     |
| FLT-003 | Sorting is applied after filtering                              | Medium   |
| FLT-004 | Filters apply only to the current context (e.g., category page) | Medium   |

## Home Feed Rules

| Rule ID | Rule                                           | Priority |
| ------- | ---------------------------------------------- | -------- |
| HM-001  | Home Feed is publicly accessible               | High     |
| HM-002  | All sections are displayed independently       | Medium   |
| HM-003  | Each section supports horizontal scrolling     | Low      |
| HM-004  | Following Feed is only for authenticated users | Critical |
| HM-005  | Popular recipes are ordered by popularity      | Medium   |
| HM-006  | Popular chefs are ordered by rating            | Medium   |

## Settings Rules

| Rule ID | Rule                                                   | Priority |
| ------- | ------------------------------------------------------ | -------- |
| SET-001 | Only authenticated users can access Settings           | Critical |
| SET-002 | Users may only modify their own settings               | Critical |
| SET-003 | Username uniqueness is enforced                        | Critical |
| SET-004 | Password changes require current password verification | Critical |
| SET-005 | Logout invalidates the current session                 | High     |

---

# Rule Priorities

| Priority | Description                                                           | Example                                |
| -------- | --------------------------------------------------------------------- | -------------------------------------- |
| Critical | Must be enforced at all times, violation causes data integrity issues | Unique emails, authentication required |
| High     | Should be enforced, violation affects user experience                 | Password length, ownership validation  |
| Medium   | Good practice, violation may cause minor issues                       | Character limits, display ordering     |
| Low      | Optional enhancement, nice to have                                    | UI behavior, display preferences       |

---

# Enforcement Guidelines

## Backend Validation

All **Critical** and **High** priority rules must be validated on the backend:

- Database constraints (unique indexes, required fields)
- Server-side validation before data persistence
- Authorization checks for protected resources

## Frontend Validation

All rules should have corresponding frontend validation:

- Immediate feedback for user input errors
- Disabled buttons for unauthorized actions
- Visual indicators for rule violations

## Error Handling

When a rule is violated:

1. Display clear, user-friendly error message
2. Suggest corrective action when possible
3. Log the violation for debugging
4. Never expose internal implementation details

---

_Document Version: 1.0_
_Last Updated: July 2026_
