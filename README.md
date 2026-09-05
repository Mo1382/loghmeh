<p align="center">
  <!-- TODO: replace with the real project logo -->
  <img src="https://via.placeholder.com/160x160.png?text=Loqmeh" alt="Loqmeh Logo" width="120" />
</p>

<h1 align="center">Loqmeh (لقمه)</h1>

<p align="center">
  A modern Persian recipe-sharing platform for discovering, creating, and sharing cooking recipes — and building an active cooking community.
</p>

<p align="center">
  <!-- Badges below are placeholders — wire them up to real CI/CD, coverage, and license once available -->
  <img src="https://img.shields.io/badge/status-in%20development-yellow" alt="Project Status" />
  <img src="https://img.shields.io/badge/version-1.0.0--mvp-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/next.js-14+-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/mongodb-atlas-brightgreen" alt="MongoDB" />
</p>

<p align="center">
  <!-- TODO: replace with the real deployed URL once the app is live -->
  <a href="https://loqmeh.example.com">Live Demo</a>
  ·
  <a href="#getting-started">Getting Started</a>
  ·
  <a href="#documentation">Documentation</a>
  ·
  <a href="#roadmap">Roadmap</a>
</p>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## About

**Loqmeh** (Persian: لقمه, meaning "bite" or "morsel") is a Persian recipe-sharing platform that helps home cooks discover high-quality recipes, and gives chefs and food enthusiasts a place to showcase their culinary skills.

This repository contains the **public-facing web application** only. Administration, moderation, category management, and system management are implemented in a separate Admin Dashboard project that shares the same database.

> Our vision is to become the most trusted and user-friendly Persian recipe platform where anyone can learn cooking, share knowledge, and discover new foods.

## Features

- 🔐 **Authentication** — registration with email verification (OTP), login, password reset/change
- 🍲 **Recipes** — create, publish, edit, and browse recipes with ingredients, steps, and nutrition info
- 🗂️ **Categories** — browse recipes by category with filtering and sorting
- 🔍 **Search** — real-time recipe search with suggestions
- 👤 **User Profiles** — public profile, avatar, bio, and social media links
- ⭐ **Ratings** — rate recipes and see average ratings
- 💬 **Comments** — comment on recipes, like/dislike, recipe-owner replies
- 🔖 **Bookmarks** — save recipes for quick access later
- 👥 **Following System** — follow other users and see their recipes in a personalized feed
- 🔔 **Notifications** — activity notifications and platform announcements
- 🎫 **Support Tickets** — contact support directly from the app
- 🏠 **Home Feed** — curated sections with popular recipes, categories, and creators

See [`docs/features.md`](./docs/features.md) for the full feature specification.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| Language | JavaScript |
| UI | [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| Forms | [React Hook Form](https://react-hook-form.com/) |
| Validation | [Zod](https://zod.dev/) |
| Database | [MongoDB](https://www.mongodb.com/) |
| ODM | [Mongoose](https://mongoosejs.com/) |
| Authentication | [Auth.js](https://authjs.dev/) |
| File Uploads | [UploadThing](https://uploadthing.com/) |
| Email | [Resend](https://resend.com/) |
| State Management | React Context API |
| Deployment | [Vercel](https://vercel.com/) |
| Package Manager | NPM |

## Screenshots

<!-- TODO: replace these with real application screenshots -->
<p align="center">
  <img src="https://via.placeholder.com/320x640.png?text=Home+Feed" alt="Home Feed screenshot" width="220" />
  <img src="https://via.placeholder.com/320x640.png?text=Recipe+Detail" alt="Recipe Detail screenshot" width="220" />
  <img src="https://via.placeholder.com/320x640.png?text=Profile" alt="Profile screenshot" width="220" />
</p>

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) `v18+`
- [NPM](https://www.npmjs.com/) `v9+`
- A [MongoDB](https://www.mongodb.com/atlas) instance (local or Atlas)
- Accounts/API keys for: Auth.js providers, UploadThing, and Resend

### Installation

```bash
# Clone the repository
# TODO: replace with the real repository URL
git clone https://github.com/your-org/loqmeh.git

# Move into the project directory
cd loqmeh

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the project root based on the template below.

```bash
# --- Database ---
# TODO: replace with your real MongoDB connection string
MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/loqmeh_dev"

# --- Auth.js ---
# TODO: generate a real secret, e.g. `openssl rand -base64 32`
AUTH_SECRET="replace-with-a-strong-random-secret"
# TODO: replace with the real app URL for the current environment
AUTH_URL="http://localhost:3000"

# --- Email (Resend) ---
# TODO: replace with your real Resend API key
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxx"
RESEND_FROM_EMAIL="no-reply@loqmeh.example.com"

# --- File Uploads (UploadThing) ---
# TODO: replace with your real UploadThing credentials
UPLOADTHING_TOKEN="replace-with-your-uploadthing-token"

# --- App ---
# TODO: replace with the real public app URL once deployed
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> ⚠️ Never commit `.env.local` (or any file containing real secrets) to version control. Use your hosting provider's environment variable settings (e.g. Vercel Project Settings) for production values.

### Running Locally

```bash
# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the app in development mode |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server (after building) |
| `npm run lint` | Run ESLint across the project |
<!-- TODO: add `test`, `test:e2e`, etc. once Vitest/Playwright are introduced in v1.1 -->

## Project Structure

```text
src/
├── app/            # Next.js App Router — routes, layouts, pages
├── features/       # Feature-based modules (auth, recipes, profile, ...)
├── models/         # Mongoose models, one per database collection
├── lib/            # Shared utilities (db connection, auth config, email, uploads)
├── components/     # Shared, cross-feature UI components
└── middleware.ts   # Route protection
```

See [`docs/architecture.md`](./docs/architecture.md) for the full architectural breakdown.

## Documentation

Detailed project documentation lives in the [`docs`](./docs) folder:

| Document | Description |
|---|---|
| [`product.md`](./docs/product.md) | Product vision, goals, and roadmap |
| [`features.md`](./docs/features.md) | Full feature specification |
| [`architecture.md`](./docs/architecture.md) | System architecture |
| [`database.md`](./docs/database.md) | Database schema and relationships |
| [`business-rules.md`](./docs/business-rules.md) | Business rules and constraints |
| [`roles.md`](./docs/roles.md) | User roles and permissions |
| [`routes.md`](./docs/routes.md) | Application routes and navigation |
| [`user-flows.md`](./docs/user-flows.md) | Detailed user flow diagrams |
| [`project-principles.md`](./docs/project-principles.md) | Development principles and standards |

<!-- TODO: adjust these paths if the docs are stored elsewhere in the repository -->

## Roadmap

| Version | Focus |
|---|---|
| 1.0 (MVP) | Core features: auth, recipes, categories, search, community |
| 1.1 | Automated testing (Vitest, Playwright, React Testing Library) |
| 1.2 | Analytics & monitoring (PostHog, Sentry) |
| 2.0 | Dark mode |
| 3.0 | Redis caching, Algolia search |
| 4.0 | Recommendation engine |
| 5.0 | AI-powered cooking assistant |
| 6.0 | Meal planning |
| 7.0 | Native mobile apps |
| 8.0 | Multi-language support |

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear, meaningful messages
4. Open a Pull Request describing your changes

<!-- TODO: add a CONTRIBUTING.md with more detailed guidelines if the project grows -->

## License

<!-- TODO: confirm the actual license and add a LICENSE file to the repository root -->
This project is licensed under the [MIT License](./LICENSE).

## Contact

<!-- TODO: replace with real contact information -->
- Project maintainer: **Your Name** — your.email@example.com
- Issues & feature requests: [GitHub Issues](https://github.com/your-org/loqmeh/issues)
