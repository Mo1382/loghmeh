# Business Rules

## Authentication

#### Registration

- Email must be unique

- Each username must be unique

- Usernames may only contain English letters, numbers, and underscores

- Passwords must contain at least 8 characters

- Users are automatically signed in after successful registration.

- One email address can only be associated with one account.

#### Sign In

- Users can sign in using either their email address or username.

- A valid session must be created after successful authentication.

- Inactive or suspended users are not allowed to sign in.

#### Password Management

- Only the account owner can change their password.

- The new password must be different from the current password.

## User Profile

- Each user has exactly one profile

- Usernames cannot be changed after registration

- Profile pictures are optional

- Bio length must not exceed 500 characters

- Social media links must be valid URLs

## Recipes

#### Creating Recipes

- Only authenticated users can create recipes

- A recipe must have a title

- A recipe title cannot be empty

- A recipe must contain at least one image

- A recipe must contain at least one ingredient

- A recipe must contain at least one cooking step

- A category must be selected

- Preparation time must be greater than zero

- Serving size must be greater than zero

#### Editing Recipes

- Only the recipe author can edit a recipe

- The updatedAt timestamp must be updated after every modification

#### Deleting Recipes

- Only the recipe author can delete a recipe

- Deleting a recipe must also remove or properly handle all related bookmarks, ratings, and comments

- Soft deletion is preferred over permanent deletion

#### Publishing Recipes

- Only valid recipes can be published

- Published recipes are publicly accessible

## Ingredients

- Every ingredient must have a name

- Quantity is optional

- Measurement unit is optional

- Ingredient order must be preserved

## Cooking Instructions

- Every cooking step must contain text

- Cooking steps must maintain their original order

## Categories

- Category names must be unique

- Categories containing recipes cannot be deleted until all associated recipes are reassigned or removed

## Search

- Search results should be ordered by relevance

- Invalid or empty search queries must not cause application errors

## Bookmarks

- Only authenticated users can bookmark recipes

- A user can bookmark a recipe only once

- Removing a bookmark should take effect immediately

## Ratings

- Only authenticated users can rate recipes

- Ratings must be between 1 and 5

- Users can update their previous ratings

- The average rating must be calculated automatically

## Comments

- Only authenticated users can post comments

- Comments cannot be empty

- Only the comment author can delete a comment

- Comments must not exceed the maximum allowed length (e.g., 1,000 characters)

## Following System

- Users cannot follow themselves

- Duplicate follow relationships are not allowed

- Users can only unfollow accounts they are currently following

## Notifications

- Users can only delete their own notifications

## Support Tickets

- Only authenticated users can create support tickets.

- Every ticket must have a status (e.g., Open, In Progress, Closed).

- Users can only view their own tickets

## File Uploads

- Only image files are allowed
- The maximum file size must be limited (e.g., 5 MB)

- Supported image formats include JPG, PNG, and WebP

- Uploaded files must be validated before being stored

## Security

- Users may only access resources they are authorized to access

- All sensitive operations require authentication

- All user input must be validated

- Sensitive data must never be exposed to unauthorized users

## SEO

- Every recipe must have a unique slug

- A recipe slug should not change after publication unless a proper redirect is provided

- Every published recipe should include SEO metadata (title and description)

## General Rules

- All timestamps must be stored in UTC.

- Every entity must include id, createdAt and updatedAt fields.

- Soft deletion should be preferred whenever possible.

- All operations should return consistent and predictable responses.

- Application errors should be handled gracefully without exposing internal implementation details.
