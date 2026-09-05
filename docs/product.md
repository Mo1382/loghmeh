# Loghmeh (لقمه)

A modern Persian recipe-sharing platform for discovering, creating, and sharing cooking recipes.

---

## Document Structure

### Document Sections

1. **Product Identity** - Name, type, scope, version
2. **Strategic Vision** - Vision, mission, goals, value proposition
3. **Market Analysis** - Problem statement, target audience
4. **Product Features** - Core features, roadmap
5. **Technical Specifications** - Platform, tech stack, architecture
6. **Success Metrics** - KPIs and measurement criteria

---

## Quick Reference

| Aspect           | Value                          |
| ---------------- | ------------------------------ |
| Product Name     | Loghmeh (لقمه)                 |
| Product Type     | Social Recipe Sharing Platform |
| Platform         | Responsive Web Application     |
| Current Version  | 1.0 (MVP)                      |
| Primary Language | Persian                        |
| Target Market    | Persian-speaking users         |

---

# 1. Product Identity

## 1.1 Project Name

**Loghmeh** (لقمه)

Persian word meaning "bite" or "morsel" - representing bite-sized culinary content.

## 1.2 Product Type

**Social Recipe Sharing Platform**

A web application that enables users to discover, create, organize, and share cooking recipes while building an active cooking community.

## 1.3 Project Scope

| Scope            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| **In Scope**     | Public-facing application for end users                            |
| **Out of Scope** | Administration, moderation, category management, system management |

Administrative functionality is implemented in a separate **Admin Dashboard** project.

## 1.4 Current Version

| Version   | Status         | Release Target |
| --------- | -------------- | -------------- |
| 1.0 (MVP) | In Development | 2024           |

---

# 2. Strategic Vision

## 2.1 Product Vision

> To become the most trusted and user-friendly Persian recipe platform where anyone can learn cooking, share knowledge, and discover new foods.

### Vision Pillars

| Pillar        | Description                                           |
| ------------- | ----------------------------------------------------- |
| Trust         | Reliable, high-quality recipes from real users        |
| User-Friendly | Intuitive design accessible to all skill levels       |
| Learning      | Platform for culinary education and skill development |
| Discovery     | Gateway to exploring new cuisines and techniques      |

## 2.2 Product Mission

> Provide a beautiful, fast, and accessible platform that enables culinary discovery, sharing, and community building.

### Mission Objectives

| Objective | Description                                               |
| --------- | --------------------------------------------------------- |
| Discover  | Help users find high-quality recipes easily               |
| Share     | Enable users to publish and showcase their recipes        |
| Save      | Allow users to bookmark favorites for future reference    |
| Engage    | Foster community through ratings, comments, and following |
| Build     | Create an active, supportive cooking community            |

## 2.3 Product Goals

| Goal               | Priority | Description                              |
| ------------------ | -------- | ---------------------------------------- |
| Modern Platform    | High     | Create a modern Persian recipe platform  |
| User Engagement    | High     | Encourage users to share recipes         |
| Fast Discovery     | High     | Provide fast recipe discovery experience |
| Community Building | High     | Build an active cooking community        |
| Mobile Experience  | High     | Deliver excellent mobile experience      |
| Content Quality    | Medium   | Maintain high-quality content            |

## 2.4 Unique Value Proposition

**Loghmeh is not just another recipe website.**

| Differentiator          | Problem Solved                              |
| ----------------------- | ------------------------------------------- |
| Modern UI/UX            | Outdated, cluttered interfaces              |
| High Performance        | Slow, unresponsive websites                 |
| Clean Design            | Excessive advertisements, poor organization |
| Community-Driven        | Lack of user interaction                    |
| Mobile-First Experience | Poor mobile usability                       |
| Easy Publishing         | Complex recipe submission processes         |

---

# 3. Market Analysis

## 3.1 Problem Statement

Many Persian recipe websites suffer from critical issues that impact user experience:

| Problem                       | Impact                      | Loghmeh Solution                  |
| ----------------------------- | --------------------------- | --------------------------------- |
| Poor user interface           | Difficult to navigate       | Modern, intuitive UI              |
| Slow performance              | Frustrating user experience | Optimized, fast loading           |
| Outdated design               | Unprofessional appearance   | Clean, contemporary design        |
| Difficult navigation          | Users can't find content    | Clear information architecture    |
| Excessive advertisements      | Content buried in ads       | Minimal, non-intrusive ads        |
| Poor mobile experience        | 60%+ users on mobile        | Mobile-first responsive design    |
| Low-quality organization      | Hard to browse recipes      | Structured categories and filters |
| Lack of community interaction | No user engagement          | Social features built-in          |

## 3.2 Target Audience

### Primary Audience

| Segment             | Description                   | Needs                    |
| ------------------- | ----------------------------- | ------------------------ |
| Home Cooks          | Individuals cooking at home   | Easy recipes, meal ideas |
| Students            | Young adults learning to cook | Simple, quick recipes    |
| Beginners           | New to cooking                | Step-by-step guidance    |
| Cooking Enthusiasts | Hobbyist cooks                | Variety, inspiration     |

### Secondary Audience

| Segment               | Description            | Needs                      |
| --------------------- | ---------------------- | -------------------------- |
| Professional Chefs    | Culinary professionals | Platform to showcase work  |
| Food Bloggers         | Content creators       | Audience building, sharing |
| Nutrition Enthusiasts | Health-focused cooks   | Healthy recipe options     |

### Audience Demographics

| Aspect            | Primary                | Secondary                 |
| ----------------- | ---------------------- | ------------------------- |
| Age Range         | 18-45                  | 25-55                     |
| Language          | Persian                | Persian, English (future) |
| Location          | Iran, Persian diaspora | Global                    |
| Device Preference | Mobile-first           | Desktop/Mobile            |
| Tech Proficiency  | Basic to Intermediate  | Intermediate to Advanced  |

---

# 4. Product Features

## 4.1 Core Features (Version 1.0)

### Feature Categories

| Category      | Features                                    |
| ------------- | ------------------------------------------- |
| **Core**      | Authentication, Recipes, Categories, Search |
| **User**      | User Profile, Bookmarks, Ratings, Comments  |
| **Social**    | Following System, Notifications             |
| **Support**   | Support Tickets, Settings                   |
| **Discovery** | Home Feed                                   |

### Feature Details

| Feature          | Description                                                      | Priority |
| ---------------- | ---------------------------------------------------------------- | -------- |
| Authentication   | Secure account creation, email verification, password management | Highest  |
| Recipes          | Create, publish, discover, search, filter, sort, rate recipes    | Highest  |
| Categories       | Browse recipes by category with filtering and sorting            | High     |
| Recipe Search    | Real-time search with suggestions                                | High     |
| User Profile     | Public profile, avatar, bio, social links, recipe showcase       | High     |
| Bookmarks        | Save recipes for quick access                                    | High     |
| Ratings          | Rate recipes (1-5 stars), view average ratings                   | High     |
| Comments         | Post comments, like/dislike, recipe owner replies                | High     |
| Following System | Follow users, view followers/following, personalized feed        | High     |
| Notifications    | Activity notifications, platform announcements                   | High     |
| Support Tickets  | Contact support, track tickets                                   | Medium   |
| Settings         | Profile management, password change, privacy settings            | Medium   |
| Home Feed        | Curated sections with popular content                            | High     |

## 4.2 Future Features

### Version 1.x Enhancements

| Feature                | Version | Description                               |
| ---------------------- | ------- | ----------------------------------------- |
| Comprehensive Testing  | 1.1     | Vitest, Playwright, React Testing Library |
| Analytics & Monitoring | 1.2     | PostHog analytics, Sentry monitoring      |

### Version 2.0+

| Feature               | Version | Description                        |
| --------------------- | ------- | ---------------------------------- |
| Dark Mode             | 2.0     | Theme customization                |
| Advanced Search       | 3.0     | Redis caching, Algolia integration |
| Recommendation Engine | 4.0     | Personalized recipe suggestions    |
| AI Cooking Assistant  | 5.0     | AI-powered cooking help            |
| Meal Planning         | 6.0     | Weekly meal planning tools         |
| Native Mobile App     | 7.0     | iOS and Android applications       |
| Multi-Language        | 8.0     | English and other languages        |

## 4.3 Out of Scope (MVP)

The following features are intentionally excluded from Version 1:

| Feature               | Reason                              | Future Version |
| --------------------- | ----------------------------------- | -------------- |
| AI Features           | Requires significant infrastructure | v5.0           |
| Meal Planner          | Complex feature, needs validation   | v6.0           |
| Recommendation Engine | Requires user data and ML models    | v4.0           |
| Redis Caching         | Premature optimization              | v3.0           |
| Algolia Search        | Basic search sufficient for MVP     | v3.0           |
| Native Mobile App     | Web app priority                    | v7.0           |
| Multi-Language        | Focus on Persian market first       | v8.0           |
| Dark Mode             | Nice-to-have feature                | v2.0           |

---

# 5. Technical Specifications

## 5.1 Platform

| Aspect     | Specification               |
| ---------- | --------------------------- |
| Type       | Responsive Web Application  |
| Framework  | Next.js (App Router)        |
| Rendering  | Server-Side Rendering (SSR) |
| Responsive | Desktop, Tablet, Mobile     |

### Supported Platforms

| Platform | Support Level | Breakpoints    |
| -------- | ------------- | -------------- |
| Desktop  | Full          | > 1024px       |
| Tablet   | Full          | 768px - 1024px |
| Mobile   | Full          | < 768px        |

## 5.2 Supported Languages

| Version   | Languages               |
| --------- | ----------------------- |
| MVP (1.0) | Persian (fa-IR)         |
| Future    | English (en-US), others |

### Language Considerations

| Aspect         | Implementation                  |
| -------------- | ------------------------------- |
| Text Direction | RTL (Right-to-Left) for Persian |
| Font           | Persian-optimized web fonts     |
| Date Format    | Persian calendar support        |
| Number Format  | Persian numerals option         |

## 5.3 Tech Stack

### Frontend

| Category          | Technology      | Purpose               |
| ----------------- | --------------- | --------------------- |
| Framework         | Next.js         | Application framework |
| Language          | JavaScript      | Programming language  |
| UI Library        | React           | Component library     |
| Styling           | Tailwind CSS    | Utility-first CSS     |
| Component Library | shadcn/ui       | UI components         |
| Forms             | React Hook Form | Form management       |
| Validation        | Zod             | Schema validation     |
| State Management  | Context API     | Global state          |
| Date Handling     | date-fns        | Date utilities        |
| Loading           | react-spinners  | Loading indicators    |

### Backend

| Category       | Technology | Purpose             |
| -------------- | ---------- | ------------------- |
| Database       | MongoDB    | NoSQL database      |
| ODM            | Mongoose   | Object modeling     |
| Authentication | Auth.js    | User authentication |
| Email          | Resend     | Email service       |

### Infrastructure

| Category        | Technology  | Purpose               |
| --------------- | ----------- | --------------------- |
| Deployment      | Vercel      | Hosting platform      |
| File Uploads    | UploadThing | Image storage         |
| Package Manager | NPM         | Dependency management |
| Version Control | GitHub      | Source control        |

### Development Tools

| Tool     | Purpose         |
| -------- | --------------- |
| ESLint   | Code linting    |
| Prettier | Code formatting |
| Git      | Version control |

## 5.4 Future Tools

### Planned Integrations

| Category   | Tool    | Version | Purpose             |
| ---------- | ------- | ------- | ------------------- |
| Search     | Algolia | v3.0    | Advanced search     |
| Analytics  | PostHog | v1.2    | User analytics      |
| Monitoring | Sentry  | v1.2    | Error tracking      |
| Caching    | Redis   | v3.0    | Performance caching |

### Testing Stack

| Tool                  | Purpose           | Version |
| --------------------- | ----------------- | ------- |
| Vitest                | Unit testing      | v1.1    |
| Playwright            | E2E testing       | v1.1    |
| React Testing Library | Component testing | v1.1    |

## 5.5 Technical Goals

| Goal                  | Priority | Description                       |
| --------------------- | -------- | --------------------------------- |
| High Performance      | Critical | Fast load times, optimized assets |
| Responsive Design     | Critical | Works on all device sizes         |
| SEO Friendly          | High     | Optimized for search engines      |
| Accessibility         | High     | WCAG compliance                   |
| Scalable Architecture | High     | Handles growth efficiently        |
| Maintainable Codebase | High     | Clean, documented code            |

---

# 6. Success Metrics

## 6.1 Key Performance Indicators (KPIs)

### User Acquisition

| Metric                     | Target  | Measurement               |
| -------------------------- | ------- | ------------------------- |
| Registered Users           | 10,000+ | Total registered accounts |
| Monthly Active Users (MAU) | 5,000+  | Unique users per month    |
| Daily Active Users (DAU)   | 1,000+  | Unique users per day      |

### Engagement

| Metric                   | Target     | Measurement           |
| ------------------------ | ---------- | --------------------- |
| Average Session Duration | 5+ minutes | Time per visit        |
| Pages per Session        | 3+ pages   | Navigation depth      |
| Returning Users          | 40%+       | Return within 30 days |

### Content

| Metric            | Target  | Measurement          |
| ----------------- | ------- | -------------------- |
| Published Recipes | 1,000+  | Total public recipes |
| Comments          | 5,000+  | Total comments       |
| Saved Recipes     | 10,000+ | Total bookmarks      |

### Quality

| Metric                | Target     | Measurement       |
| --------------------- | ---------- | ----------------- |
| Average Rating        | 4.0+ stars | Platform average  |
| Support Response Time | < 24 hours | Ticket resolution |

## 6.2 Measurement Tools

| Tool             | Purpose          | Implementation |
| ---------------- | ---------------- | -------------- |
| PostHog          | User analytics   | v1.2           |
| Sentry           | Error monitoring | v1.2           |
| Custom Dashboard | Business metrics | Admin app      |

---

# 7. Roadmap

## 7.1 Development Roadmap

### Phase 1: Foundation (v1.0)

| Milestone        | Description                           |
| ---------------- | ------------------------------------- |
| Core Features    | Authentication, Recipes, Categories   |
| User Features    | Profile, Bookmarks, Ratings, Comments |
| Social Features  | Following, Notifications              |
| Support Features | Tickets, Settings                     |
| Launch           | MVP release                           |

### Phase 2: Stabilization (v1.1 - v1.2)

| Version | Focus                    |
| ------- | ------------------------ |
| v1.1    | Testing infrastructure   |
| v1.2    | Analytics and monitoring |

### Phase 3: Enhancement (v2.0+)

| Version | Major Feature                             |
| ------- | ----------------------------------------- |
| v2.0    | Dark mode                                 |
| v3.0    | Performance optimization (Redis, Algolia) |
| v4.0    | Recommendation engine                     |
| v5.0    | AI cooking assistant                      |
| v6.0    | Meal planning                             |
| v7.0    | Native mobile apps                        |
| v8.0    | Multi-language support                    |

## 7.2 Version Timeline

```
v1.0 ─── v1.1 ─── v1.2 ─── v2.0 ─── v3.0 ─── v4.0 ─── v5.0 ─── v6.0 ─── v7.0 ─── v8.0
 MVP     Tests   Monitor  Dark    Search   Recommend   AI      Meal    Mobile  Multi-
                                       Mode   Enhance   Engine  Assist  Plan    App   Language
```

---

# Appendix

## A. Project Files Reference

| Document              | Purpose                          |
| --------------------- | -------------------------------- |
| 01-product.md         | Product overview (this document) |
| 02-features.md        | Feature specifications           |
| business-rules.md     | Business rules and constraints   |
| project-principles.md | Development principles           |
| roles.md              | User roles and permissions       |

## B. External References

| Resource          | Purpose                    |
| ----------------- | -------------------------- |
| Figma Design      | UI/UX specifications       |
| Admin Dashboard   | Administrative application |
| API Documentation | Backend endpoints          |

## C. Glossary

| Term | Definition                |
| ---- | ------------------------- |
| MVP  | Minimum Viable Product    |
| DAU  | Daily Active Users        |
| MAU  | Monthly Active Users      |
| KPI  | Key Performance Indicator |
| ODM  | Object Document Mapper    |
| SSR  | Server-Side Rendering     |

---

_Document Version: 1.0_
_Last Updated: July 2026_
