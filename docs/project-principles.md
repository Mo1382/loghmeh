# Project Principles

This document defines the core principles, guidelines, and standards for the Loghmeh application development.

These principles guide architectural decisions, code quality, and development practices throughout the project lifecycle.

---

## Document Structure

### Principle Categories

1. **General Principles** - Core development philosophy
2. **Architecture** - Application structure and patterns
3. **Data Layer** - Database and data fetching
4. **Security** - Authentication, authorization, and protection
5. **User Interface** - UI/UX standards and components
6. **Code Quality** - Standards and practices
7. **DevOps** - Deployment and operations

---

## Quick Reference

| Category       | Principle Count | Key Focus                                             |
| -------------- | --------------- | ----------------------------------------------------- |
| General        | 8               | Simplicity, maintainability, user focus               |
| Architecture   | 7               | App Router, Server Components, separation of concerns |
| Data Layer     | 11              | MongoDB, Mongoose, validation, performance            |
| Security       | 10              | Authentication, authorization, input validation       |
| User Interface | 15              | Mobile-first, accessibility, components, forms        |
| Code Quality   | 12              | Standards, naming, documentation, testing             |
| DevOps         | 8               | Git workflow, deployment, configuration               |

---

# 1. General Principles

## 1.1 Core Philosophy

| Principle ID | Principle                                          | Rationale                                             |
| ------------ | -------------------------------------------------- | ----------------------------------------------------- |
| GEN-001      | Build for maintainability before complexity        | Complex solutions are harder to maintain and debug    |
| GEN-002      | Keep the codebase simple, clean, and consistent    | Consistency reduces cognitive load                    |
| GEN-003      | Prefer readability over clever solutions           | Code is read more often than written                  |
| GEN-004      | Follow the DRY (Don't Repeat Yourself) principle   | Reduces duplication and maintenance burden            |
| GEN-005      | Follow the KISS (Keep It Simple, Stupid) principle | Simple solutions are easier to understand and modify  |
| GEN-006      | Every feature should solve a real user problem     | Avoid building features that provide no value         |
| GEN-007      | Avoid premature optimization                       | Optimize only when there is a proven need             |
| GEN-008      | Write code that is easy to understand and extend   | Future developers (including yourself) will thank you |

---

# 2. Architecture

## 2.1 Application Structure

| Principle ID | Principle                                                 | Rationale                                              |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| ARCH-001     | Use the App Router architecture provided by Next.js       | Modern, server-centric routing with better performance |
| ARCH-002     | Prefer Server Components by default                       | Reduces client-side JavaScript, improves performance   |
| ARCH-003     | Use Client Components only when interactivity is required | Minimizes hydration overhead                           |
| ARCH-004     | Keep business logic outside UI components                 | Separation of concerns improves testability            |
| ARCH-005     | Organize the project using feature-based architecture     | Features are self-contained and easier to locate       |
| ARCH-006     | Keep components small and reusable                        | Small components are easier to test and reuse          |
| ARCH-007     | Separate UI, business logic, and data access              | Clear boundaries improve maintainability               |

---

# 3. Data Layer

## 3.1 Database

| Principle ID | Principle                                    | Rationale                                    |
| ------------ | -------------------------------------------- | -------------------------------------------- |
| DATA-001     | Use MongoDB as the primary database          | Flexible document model suits recipe content |
| DATA-002     | Use Mongoose for database modeling           | Provides schema validation and type safety   |
| DATA-003     | Design collections for scalability           | Plan for growth from the start               |
| DATA-004     | Avoid unnecessary data duplication           | Reduces consistency issues and storage costs |
| DATA-005     | Store timestamps in UTC                      | Consistent time handling across timezones    |
| DATA-006     | Use indexes where appropriate                | Improves query performance                   |
| DATA-007     | Prefer soft deletion over permanent deletion | Enables data recovery and audit trails       |

## 3.2 Data Fetching

| Principle ID | Principle                                  | Rationale                                     |
| ------------ | ------------------------------------------ | --------------------------------------------- |
| DATA-008     | Fetch data on the server whenever possible | Reduces client-server round trips             |
| DATA-009     | Minimize unnecessary client-side requests  | Improves performance and reduces server load  |
| DATA-010     | Avoid duplicate database queries           | Reduces unnecessary load                      |
| DATA-011     | Return only the data required by the UI    | Reduces payload size and improves performance |

## 3.3 Validation

| Principle ID | Principle                                        | Rationale                                      |
| ------------ | ------------------------------------------------ | ---------------------------------------------- |
| DATA-012     | Validate all user input                          | Prevents invalid data from entering the system |
| DATA-013     | Perform validation on both client and server     | Client for UX, server for security             |
| DATA-014     | Use Zod as the single source of validation rules | Consistent validation schema across the stack  |
| DATA-015     | Never trust client-side validation alone         | Client validation can be bypassed              |

---

# 4. Security

## 4.1 Authentication & Authorization

| Principle ID | Principle                               | Rationale                                   |
| ------------ | --------------------------------------- | ------------------------------------------- |
| SEC-001      | Protect every private route             | Prevents unauthorized access                |
| SEC-002      | Authenticate before authorizing         | Verify identity before checking permissions |
| SEC-003      | Apply the principle of least privilege  | Users only have access to what they need    |
| SEC-004      | Never expose sensitive user information | Protects user privacy                       |
| SEC-005      | Validate permissions on the server      | Client-side checks can be bypassed          |

## 4.2 Input & Content Security

| Principle ID | Principle                                        | Rationale                          |
| ------------ | ------------------------------------------------ | ---------------------------------- |
| SEC-006      | Never trust client input                         | All input is potentially malicious |
| SEC-007      | Sanitize user-generated content                  | Prevents XSS and injection attacks |
| SEC-008      | Protect against common web vulnerabilities       | OWASP Top 10 mitigation            |
| SEC-009      | Store secrets securely                           | Prevents credential leakage        |
| SEC-010      | Never expose environment variables on the client | Secrets must remain server-side    |

---

# 5. User Interface

## 5.1 UI/UX Standards

| Principle ID | Principle                                          | Rationale                                      |
| ------------ | -------------------------------------------------- | ---------------------------------------------- |
| UI-001       | Design mobile-first                                | Ensures good experience on all devices         |
| UI-002       | Maintain a consistent design system                | Improves user experience and development speed |
| UI-003       | Prioritize accessibility                           | Ensures everyone can use the application       |
| UI-004       | Provide meaningful loading states                  | Users understand what is happening             |
| UI-005       | Display clear error messages                       | Users know what went wrong and how to fix it   |
| UI-006       | Provide user feedback after every important action | Confirms actions were successful               |
| UI-007       | Keep interactions predictable                      | Users can anticipate behavior                  |

## 5.2 Components

| Principle ID | Principle                                               | Rationale                                   |
| ------------ | ------------------------------------------------------- | ------------------------------------------- |
| UI-008       | Prefer composition over inheritance                     | More flexible and reusable component design |
| UI-009       | Build reusable components                               | Reduces duplication and development time    |
| UI-010       | Avoid unnecessary props                                 | Simplifies component interface              |
| UI-011       | Keep components focused on a single responsibility      | Easier to understand and maintain           |
| UI-012       | Extract shared logic into custom hooks when appropriate | Promotes reusability and separation         |

## 5.3 Forms

| Principle ID | Principle                                     | Rationale                                      |
| ------------ | --------------------------------------------- | ---------------------------------------------- |
| UI-013       | Use React Hook Form for all forms             | Consistent form handling with good performance |
| UI-014       | Validate forms using Zod                      | Single source of truth for validation          |
| UI-015       | Display validation errors near related fields | Improves user experience                       |
| UI-016       | Prevent duplicate form submissions            | Avoids creating duplicate data                 |

## 5.4 State Management

| Principle ID | Principle                                                | Rationale                                  |
| ------------ | -------------------------------------------------------- | ------------------------------------------ |
| UI-017       | Keep state as local as possible                          | Reduces complexity                         |
| UI-018       | Use Context API only for shared global state             | Avoids prop drilling for truly global data |
| UI-019       | Avoid unnecessary global state                           | Global state adds complexity               |
| UI-020       | Derive state whenever possible instead of duplicating it | Reduces synchronization issues             |

## 5.5 Performance

| Principle ID | Principle                                   | Rationale                       |
| ------------ | ------------------------------------------- | ------------------------------- |
| UI-021       | Optimize images                             | Reduces load time and bandwidth |
| UI-022       | Lazy-load heavy components when appropriate | Improves initial page load      |
| UI-023       | Minimize JavaScript shipped to the client   | Improves performance            |
| UI-024       | Avoid unnecessary re-renders                | Improves React performance      |
| UI-025       | Prefer server rendering whenever possible   | Reduces client-side work        |

## 5.6 SEO

| Principle ID | Principle                                     | Rationale                         |
| ------------ | --------------------------------------------- | --------------------------------- |
| UI-026       | Every public page should have proper metadata | Improves search engine visibility |
| UI-027       | Use semantic HTML                             | Improves accessibility and SEO    |
| UI-028       | Generate SEO-friendly URLs                    | Improves search engine ranking    |
| UI-029       | Optimize Open Graph metadata                  | Improves social media sharing     |
| UI-030       | Optimize for search engine indexing           | Increases discoverability         |

## 5.7 Accessibility

| Principle ID | Principle                                 | Rationale                         |
| ------------ | ----------------------------------------- | --------------------------------- |
| UI-031       | Follow WCAG guidelines whenever practical | Ensures accessibility compliance  |
| UI-032       | Ensure keyboard accessibility             | Not all users can use a mouse     |
| UI-033       | Use semantic HTML elements                | Improves screen reader support    |
| UI-034       | Provide alternative text for images       | Makes images accessible           |
| UI-035       | Maintain sufficient color contrast        | Ensures readability for all users |

---

# 6. Code Quality

## 6.1 Standards

| Principle ID | Principle                                        | Rationale                                |
| ------------ | ------------------------------------------------ | ---------------------------------------- |
| CQ-001       | Follow ESLint rules                              | Consistent code style across the project |
| CQ-002       | Format code using Prettier                       | Automatic formatting saves time          |
| CQ-003       | Keep functions small and focused                 | Easier to understand and test            |
| CQ-004       | Use meaningful names for variables and functions | Code should be self-documenting          |
| CQ-005       | Remove dead code                                 | Reduces confusion and maintenance burden |
| CQ-006       | Avoid commented-out code in production           | Source control tracks history            |

## 6.2 Error Handling

| Principle ID | Principle                                    | Rationale                                 |
| ------------ | -------------------------------------------- | ----------------------------------------- |
| CQ-007       | Fail gracefully                              | Application should not crash unexpectedly |
| CQ-008       | Never expose internal server errors to users | Prevents information leakage              |
| CQ-009       | Log unexpected errors                        | Enables debugging and monitoring          |
| CQ-010       | Provide meaningful error messages            | Users understand what went wrong          |

## 6.3 Documentation

| Principle ID | Principle                                       | Rationale                                  |
| ------------ | ----------------------------------------------- | ------------------------------------------ |
| CQ-011       | Keep documentation up to date                   | Outdated documentation is misleading       |
| CQ-012       | Document architectural decisions                | Future developers understand the rationale |
| CQ-013       | Document complex business logic                 | Reduces onboarding time                    |
| CQ-014       | Keep README accurate                            | First document developers read             |
| CQ-015       | Update documentation whenever a feature changes | Documentation evolves with the code        |

## 6.4 Testing

| Principle ID | Principle                                             | Rationale                            |
| ------------ | ----------------------------------------------------- | ------------------------------------ |
| CQ-016       | Critical user flows should be tested                  | Ensures core functionality works     |
| CQ-017       | Add automated tests as the project grows              | Increases confidence in changes      |
| CQ-018       | Fix bugs before adding new features whenever possible | Prevents technical debt accumulation |

---

# 7. DevOps

## 7.1 Git Workflow

| Principle ID | Principle                                  | Rationale                   |
| ------------ | ------------------------------------------ | --------------------------- |
| DEV-001      | Write meaningful commit messages           | Makes history useful        |
| DEV-002      | Keep commits small and focused             | Easier to review and revert |
| DEV-003      | Create feature branches for major features | Isolates work in progress   |
| DEV-004      | Merge only reviewed and tested code        | Maintains code quality      |

## 7.2 Deployment

| Principle ID | Principle                                    | Rationale                    |
| ------------ | -------------------------------------------- | ---------------------------- |
| DEV-005      | Keep the application deployable at all times | Enables continuous delivery  |
| DEV-006      | Store configuration in environment variables | Separates config from code   |
| DEV-007      | Never commit secrets to the repository       | Prevents credential exposure |
| DEV-008      | Use automated deployments through Vercel     | Reduces manual errors        |

## 7.3 Future Growth

| Principle ID | Principle                                                     | Rationale                     |
| ------------ | ------------------------------------------------------------- | ----------------------------- |
| DEV-009      | Design features with scalability in mind                      | Plan for growth               |
| DEV-010      | Keep the architecture flexible                                | Enables future changes        |
| DEV-011      | Avoid vendor lock-in whenever practical                       | Maintains flexibility         |
| DEV-012      | Introduce new technologies only when they provide clear value | Avoids unnecessary complexity |

---

# Appendix

## Technology Stack Reference

| Category       | Technology              | Purpose                |
| -------------- | ----------------------- | ---------------------- |
| Framework      | Next.js                 | Application framework  |
| Language       | JavaScript              | Programming language   |
| UI             | Tailwind CSS, shadcn/ui | Styling and components |
| Database       | MongoDB                 | Data storage           |
| ODM            | Mongoose                | Database modeling      |
| Authentication | Auth.js                 | User authentication    |
| Validation     | Zod                     | Schema validation      |
| Forms          | React Hook Form         | Form handling          |
| Deployment     | Vercel                  | Hosting platform       |
| Uploads        | UploadThing             | File uploads           |
| Email          | Resend                  | Email service          |

## Decision Framework

When making architectural or design decisions, consider:

1. **Simplicity** - Is this the simplest solution that works?
2. **Maintainability** - Can this be easily understood and modified?
3. **Performance** - Does this impact application performance?
4. **Scalability** - Will this work as the application grows?
5. **Security** - Does this introduce security risks?
6. **Accessibility** - Can everyone use this feature?
7. **Testing** - Can this be tested effectively?

## Conflict Resolution

When principles conflict, prioritize in this order:

1. **Security** - Never compromise on user security
2. **Data Integrity** - Protect user data
3. **Performance** - Ensure good user experience
4. **Maintainability** - Enable future development
5. **Simplicity** - Keep solutions straightforward

---

_Document Version: 1.0_
_Last Updated: July 2026_
