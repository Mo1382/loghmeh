# Loqmeh (لقمه)

- [Loqmeh (لقمه)](#loqmeh-لقمه)
- [Project Name](#project-name)
- [Product Type](#product-type)
- [Platform](#platform)
- [Current Version](#current-version)
  - [Product Definition](#product-definition)
- [Product Overview](#product-overview)
- [Vision](#vision)
- [Mission](#mission)
- [Problem Statement](#problem-statement)
- [Target Audience](#target-audience)
- [Product Goals](#product-goals)
- [Core Features](#core-features) - [Version 1](#version-1) - [Future versions core features](#future-versions-core-features)
- [Unique Value Proposition](#unique-value-proposition)
- [Platform](#platform-1)
- [Supported Languages](#supported-languages)
- [User Roles](#user-roles)
- [Success Metrics](#success-metrics)
- [Technical Goals](#technical-goals)
- [Business Rules](#business-rules)
  - [Authentication](#authentication)
    - [Registration](#registration)
    - [Sign In](#sign-in)
    - [Password Management](#password-management)
  - [User Profile](#user-profile)
  - [Recipes](#recipes)
    - [Creating Recipes](#creating-recipes)
    - [Editing Recipes](#editing-recipes)
    - [Deleting Recipes](#deleting-recipes)
    - [Publishing Recipes](#publishing-recipes)
  - [Ingredients](#ingredients)
  - [Cooking Instructions](#cooking-instructions)
  - [Categories](#categories)
  - [Search](#search)
  - [Bookmarks](#bookmarks)
  - [Ratings](#ratings)
  - [Comments](#comments)
  - [Following System](#following-system)
  - [Notifications](#notifications)
  - [Support Tickets](#support-tickets)
  - [Administration](#administration)
  - [File Uploads](#file-uploads)
  - [Security](#security)
  - [SEO](#seo)
  - [General Rules](#general-rules)
- [Tech Stack](#tech-stack) - [Framework](#framework) - [Language](#language) - [UI](#ui) - [Database](#database) - [ODM](#odm) - [Authentication](#authentication-1) - [Validation](#validation) - [Forms](#forms) - [Deployment](#deployment) - [Uploads](#uploads) - [Package manager](#package-manager) - [Version Control System](#version-control-system) - [Hosting provider](#hosting-provider) - [UI state management](#ui-state-management) - [Other libraries](#other-libraries)
  - [Future tools](#future-tools)
    - [Search](#search-1)
    - [Analytics](#analytics)
    - [Monitoring](#monitoring)
    - [Caching](#caching)
    - [Testing](#testing)
- [Project Principles](#project-principles) - [General Principles](#general-principles) - [Architecture](#architecture) - [Data Fetching](#data-fetching) - [Database](#database-1) - [Validation](#validation-1) - [Authentication \& Authorization](#authentication--authorization) - [UI \& UX](#ui--ux) - [Components](#components) - [Forms](#forms-1) - [State Management](#state-management) - [Performance](#performance) - [SEO](#seo-1) - [Accessibility](#accessibility) - [Error Handling](#error-handling) - [Security](#security-1) - [Code Quality](#code-quality) - [Git Workflow](#git-workflow) - [Documentation](#documentation) - [Testing](#testing-1) - [Deployment](#deployment-1) - [Future Growth](#future-growth)
- [Future Roadmap](#future-roadmap) - [Version 1](#version-1-1) - [Version 1.1](#version-11) - [Version 1.2](#version-12) - [Version 1.3](#version-13) - [Version 2](#version-2) - [Version 3](#version-3) - [Version 4](#version-4) - [Version 5](#version-5) - [Version 6](#version-6) - [Version 7](#version-7) - [Version 8](#version-8)
- [Out of Scope (MVP)](#out-of-scope-mvp)

# Project Name

Loqmeh

# Product Type

Social Recipe Sharing Platform

# Platform

Responsive Web Application

# Current Version

1.0 (MVP)

## Product Definition

Recipe social media app web application

---

# Product Overview

Loqmeh is a modern Persian recipe-sharing platform that enables users to discover, create, organize, and share cooking recipes while building an active cooking community

The platform helps home cooks discover high-quality recipes and provides chefs and food enthusiasts with a place to showcase their culinary skills

---

# Vision

To become the most trusted and user-friendly Persian recipe platform where anyone can learn cooking, share knowledge, and discover new foods.

---

# Mission

Provide a beautiful, fast, and accessible platform that allows users to:

- Discover recipes
- Share recipes
- Save favorite recipes
- Rate and Comment others recipes
- Build a cooking community

---

# Problem Statement

Many Persian recipe websites suffer from one or more of the following issues:

- Poor user interface
- Slow performance
- Outdated design
- Difficult navigation
- Excessive advertisements
- Poor mobile experience
- Low-quality recipe organization
- Lack of community interaction

Loqmeh aims to solve these problems by providing a modern web experience.

---

# Target Audience

Primary Audience

- Home cooks
- Students
- Beginners
- Cooking enthusiasts

Secondary Audience

- Professional chefs
- Food bloggers
- Nutrition enthusiasts

---

# Product Goals

The main goals of Loqmeh are:

- Create a modern Persian recipe platform.
- Encourage users to share recipes.
- Provide a fast recipe discovery experience.
- Build an active cooking community.
- Deliver an excellent mobile experience.
- Maintain high-quality content.

---

# Core Features

#### Version 1

- Authentication

- Recipes

- Categories

- Search

- Bookmarks

- Ratings

- Comments

- Community

- Notifications

- Support Tickets

- Administration

#### Future versions core features

- Trending Recipes
- Meal Planner
- AI Recipe Assistant

---

# Unique Value Proposition

Loqmeh is not just another recipe website.

It focuses on:

- Modern UI/UX
- High performance
- Clean design
- Community-driven content
- Mobile-first experience
- Easy recipe publishing

---

# Platform

Web Application

Responsive Design

Desktop

Tablet

Mobile

---

# Supported Languages

Initial Version

- Persian

Future

- English

---

# User Roles

Guest

Registered User

Administrator

---

# Success Metrics

The success of the project will be measured by:

- Number of registered users
- Number of published recipes
- Daily active users
- Monthly active users
- Average session duration
- Number of saved recipes
- Number of comments
- Returning users

---

# Technical Goals

- High Performance
- Responsive Design
- SEO Friendly
- Accessibility
- Scalable Architecture
- Maintainable Codebase

---

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

- Only the recipe author or an administrator can edit a recipe

- The updatedAt timestamp must be updated after every modification

#### Deleting Recipes

- Only the recipe author or an administrator can delete a recipe

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

- Only administrators can create categories

- Only administrators can delete categories

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

- Only the comment author or an administrator can delete a comment

- Administrator replies must be linked to the original comment

- Comments must not exceed the maximum allowed length (e.g., 1,000 characters)

## Following System

- Users cannot follow themselves

- Duplicate follow relationships are not allowed

- Users can only unfollow accounts they are currently following

## Notifications

- Only administrators can create global notifications

- Only administrators can remove global notifications

- Users can only delete their own notifications

## Support Tickets

- Only authenticated users can create support tickets.

- Every ticket must have a status (e.g., Open, In Progress, Closed).

- Only administrators can provide official responses.

- Users can only view their own tickets

## Administration

- Administrators have full access to all recipes

- Administrators can suspend or deactivate user accounts

- Administrators can manage categories

- Administrators can manage notifications

- Administrators can remove inappropriate comments

## File Uploads

- Only image files are allowed
- The maximum file size must be limited (e.g., 5 MB)

- Supported image formats include JPG, PNG, and WebP

- Uploaded files must be validated before being stored

## Security

- Users may only access resources they are authorized to access

- All sensitive operations require authentication

- All user input must be validated

- Administrative operations require administrator privileges

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

---

# Tech Stack

#### Framework

- Next.js

#### Language

- Javascript

#### UI

- Tailwind CSS
- shadcn/ui

#### Database

- MongoDB

#### ODM

- Mongoose

#### Authentication

- Auth.js

#### Validation

- Zod

#### Forms

- React Hook Form

#### Deployment

- Vercel

#### Uploads

- UploadThing

#### Package manager

- NPM

#### Version Control System

- Github

#### Hosting provider

- Vercel

#### UI state management

- Context API

#### Other libraries

- date-fns
- react-spinners

## Future tools

#### Search

- Algolia

#### Analytics

- PostHog

#### Monitoring

- Sentry

#### Caching

- Redis

#### Testing

- Vitest
- Playwright
- React testing library

---

# Project Principles

#### General Principles

- Build for maintainability before complexity

- Keep the codebase simple, clean, and consistent

- Prefer readability over clever solutions

- Follow the DRY (Don't Repeat Yourself) principle

- Follow the KISS (Keep It Simple, Stupid) principle

- Every feature should solve a real user problem

- Avoid premature optimization

- Write code that is easy to understand and extend

#### Architecture

- Use the App Router architecture provided by Next.js

- Prefer Server Components by default

- Use Client Components only when interactivity is required

- Keep business logic outside UI components

- Organize the project using feature-based architecture

- Keep components small and reusable

- Separate UI, business logic, and data access

#### Data Fetching

- Fetch data on the server whenever possible

- Minimize unnecessary client-side requests

- Avoid duplicate database queries

- Return only the data required by the UI

#### Database

- Use MongoDB as the primary database

- Use Mongoose for database modeling

- Design collections for scalability

- Avoid unnecessary data duplication

- Store timestamps in UTC

- Use indexes where appropriate

- Prefer soft deletion over permanent deletion

#### Validation

- Validate all user input

- Perform validation on both client and server

- Use Zod as the single source of validation rules

- Never trust client-side validation alone

#### Authentication & Authorization

- Protect every private route

- Authenticate before authorizing

- Apply the principle of least privilege

- Never expose sensitive user information

- Validate permissions on the server

#### UI & UX

- Design mobile-first

- Maintain a consistent design system

- Prioritize accessibility

- Provide meaningful loading states

- Display clear error messages

- Provide user feedback after every important action

- Keep interactions predictable

#### Components

- Prefer composition over inheritance

- Build reusable components

- Avoid unnecessary props

- Keep components focused on a single responsibility

- Extract shared logic into custom hooks when appropriate

#### Forms

- Use React Hook Form for all forms

- Validate forms using Zod

- Display validation errors near the related fields

- Prevent duplicate form submissions

#### State Management

- Keep state as local as possible

- Use Context API only for shared global state

- Avoid unnecessary global state

- Derive state whenever possible instead of duplicating it

#### Performance

- Optimize images

- Lazy-load heavy components when appropriate

- Minimize JavaScript shipped to the client

- Avoid unnecessary re-renders

- Prefer server rendering whenever possible

#### SEO

- Every public page should have proper metadata

- Use semantic HTML

- Generate SEO-friendly URLs

- Optimize Open Graph metadata

- Optimize for search engine indexing

#### Accessibility

- Follow WCAG guidelines whenever practical

- Ensure keyboard accessibility

- Use semantic HTML elements

- Provide alternative text for images

- Maintain sufficient color contrast

#### Error Handling

- Fail gracefully

- Never expose internal server errors to users

- Log unexpected errors

- Provide meaningful error messages

#### Security

- Never trust client input

- Sanitize user-generated content

- Protect against common web vulnerabilities

- Store secrets securely

- Never expose environment variables on the client

#### Code Quality

- Follow ESLint rules

- Format code using Prettier

- Keep functions small and focused

- Use meaningful names for variables and functions

- Remove dead code

- Avoid commented-out code in production

#### Git Workflow

- Write meaningful commit messages

- Keep commits small and focused

- Create feature branches for major features

- Merge only reviewed and tested code

#### Documentation

- Keep documentation up to date

- Document architectural decisions

- Document complex business logic

- Keep README accurate

- Update documentation whenever a feature changes

#### Testing

- Critical user flows should be tested

- Add automated tests as the project grows

- Fix bugs before adding new features whenever possible

#### Deployment

- Keep the application deployable at all times

- Store configuration in environment variables

- Never commit secrets to the repository

- Use automated deployments through Vercel

#### Future Growth

- Design features with scalability in mind

- Keep the architecture flexible

- Avoid vendor lock-in whenever practical

- Introduce new technologies only when they provide clear value

---

# Future Roadmap

#### Version 1

- Implement the app with all mvp features

  #### Version 1.1

- Implement the administration features

  #### Version 1.2

- Add app tests with Vitest, Playwright and React testing library

#### Version 1.3

- Keep track of the app by adding PostHog and Sentry to project

#### Version 2

- Implementing admin dashboard for admins
- Implementing dark mode

#### Version 3

- Adding Redis for cache handling
- Adding Algolia for more advanced searching

#### Version 4

- Recommendation engine

#### Version 5

- Implementing AI-powered cooking assistant

#### Version 6

- Adding meal planning ecosystem

#### Version 7

- Native mobile app

#### Version 8

- Multi-language

---

# Out of Scope (MVP)

The following features are intentionally excluded from Version 1:

- AI
- Meal planner
- Recommendation engine
- Redis
- Algolia
- Native mobile app
- Admin Dashboard
- Multi-language
- Dark Mode
