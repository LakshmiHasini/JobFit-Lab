# JobFit Lab

A MERN career preparation workspace connecting job requirements to user-provided project evidence and practical preparation tasks. Evidence coverage is not a proficiency certification, hiring prediction, or ATS score.

## Interview studio: profile-first workflow

The default workspace now starts with **Complete profile → Preparation plan → Tailor resume → Interview practice**.

- Save your GitHub handle, LinkedIn, LeetCode, and GeeksforGeeks profile links, experience level, background, and self-reported coding-practice context.
- Upload a text-based PDF/TXT/Markdown resume, or paste resume text. PDF extraction happens in the browser; review extracted text before saving. Files are limited to 5 MB and PDFs to 15 pages. Scanned PDFs need pasted text; OCR and DOCX import are not implemented.
- Set the target role, paste a job description, and choose 1–60 days and 1–8 preparation hours per day.
- Save the profile, then import the latest five eligible public GitHub repositories. The importer searches the latest 100 user-owned public repositories, excludes forks/archived repositories, and inspects up to two package manifests per analyzed repository plus file-tree/language signals. It does not execute code or certify personal contribution.
- Generate a saved preparation snapshot with daily time budgets, gap-first topics, project deep-dive prompts, and behavioral interview guidance.
- Review an editable resume draft alongside the original. Current tailoring reorders relevant contiguous bullet lists while preserving all original lines and chronology; it does not perform AI rewriting or invent achievements. Save/export TXT or print to PDF (text layout, not the original PDF formatting).
- Practice role-selected curated quizzes with server-side grading, explanations, and attempt history, plus coding exercises, project questions, and downloadable answer notes. Coding solutions are not executed or automatically graded. Draft mock-interview/coding notes are temporary unless downloaded.

LinkedIn, LeetCode, and GFG are stored links, not live imports. No AI provider is connected. The mapping currently supports 12 technical skills, so plans are a starting point to compare with the complete job description. Social profiles, resumes, and preparation sessions are scoped to the signed-in account; no resume is sent to GitHub or an AI provider.

Public GitHub API access works without a token but is rate-limited. Optionally set `GITHUB_TOKEN` on the server to increase the public-data request budget. Never expose it through frontend environment variables. Missing manifests, truncated trees, and per-repository failures are reported as analysis warnings. Re-imports reuse existing projects/evidence rather than duplicating the same source signals.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** and select **Open demo workspace**. Each demo session gets an isolated sample workspace. Local development stores records and sessions in the private, git-ignored `.data/workspace.json` file so they survive API restarts. The directory is private to the local OS account and denied by the Vite server. Production still requires MongoDB. Do not use real personal data in the demo. No AI API key is required.

## MongoDB mode

Copy `.env.example` to `.env`, set `DEMO_MODE=false`, provide `MONGODB_URI`, and set a random `SESSION_SECRET` of at least 32 characters. Restart the app and create an account. Domain records and sessions then use MongoDB. Never commit `.env`.

For a local MongoDB instance, use `mongodb://127.0.0.1:27017/jobfit-lab`; a reachable Atlas connection string also works. No live MongoDB instance is provisioned by this repository.

## Current working slice

- Email/password registration, login, logout, hashed passwords, cookie sessions.
- Isolated demo workspaces with local development persistence.
- Create projects and attach skill-specific evidence and supporting links.
- Paste a job description and inspect proposed requirements with exact excerpts.
- Explicitly confirm requirements, choose their importance, and attach matching evidence.
- Create preparation tasks for confirmed requirements and complete/reopen them.
- Coverage counts only confirmed requirements with explicitly linked matching evidence.
- Responsive overview, evidence library, role review, and preparation plan.

## Phases and remaining work

See [PLAN.md](PLAN.md). The initial accounts/evidence slice and the profile-first interview studio are implemented. Manual requirement editing, immutable assessment revisions, preparation-task priorities/dates/editing, live MongoDB verification, and production release remain. AI rewriting, private GitHub access, and live coding-platform integrations are not implemented.

The current curated dictionary recognizes 12 skills. It proposes keyword mentions, not semantic qualification decisions. For example, React Native may produce a React proposal that needs user rejection; the system never auto-confirms it. Description text is not edited in place in this version, preserving the original role input until assessment revision support is built.

## Commands

```sh
npm test          # Domain and API integration tests (in-memory adapter)
npm run build    # Strict TypeScript check and production frontend bundle
npm start        # API; in production also serves the built frontend
```

## Project layout

```text
src/             React application and responsive styles
server/          Express routes, authentication, MongoDB/demo storage
shared/          Domain types, skill dictionary, extraction and coverage rules
.github/         Pull request template
docs/            GitHub Actions template (not active)
PLAN.md          Phases, acceptance criteria, estimates, remaining scope
```

## API surface

Public: `GET /api/health`, `GET /api/session`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and demo-only `POST /api/auth/demo`.

Session required: `GET /api/workspace`, `POST /api/projects`, `POST /api/evidence`, `POST /api/roles`, `PATCH /api/roles/:id/requirements/:requirementId`, `POST /api/tasks`, `PATCH /api/tasks/:id`.

Mutating browser requests must use `APP_ORIGIN`. Backend validates ownership and skill compatibility for all evidence associations. Rate limits apply to authentication endpoints.

## Local production build

Set MongoDB mode as above, set `APP_ORIGIN` to the deployed origin, then build and start with `NODE_ENV=production`. The Express service serves `dist/` so the frontend and API share an origin. Deploy behind an HTTPS reverse proxy; production cookies are secure. Demo mode is rejected in production. The app trusts one reverse-proxy hop; adapt that setting to the actual deployment before release.

## Branch workflow

- `main`: integrated changes after checks pass.
- `feature/api-domain`: shared types, extraction, coverage rules, and domain tests.
- `feature/backend`: Server bootstrap and MongoDB/demo storage adapters.
- `feature/api`: Express routes, accounts, sessions, input validation, and API integration tests.
- `feature/frontend`: React views, forms, styles, and API client.
- `docs/project-plan`: phased plan and documentation.
- `docs/ci-setup`: inactive CI template and setup instructions.
- `chore/code-formatting`: shared formatting configuration and readable source formatting.

Each feature branch is merged into main with a merge commit to preserve its scope. The API depends on backend storage and shared domain contracts; the frontend uses the integrated API. Future changes should use pull requests and pass the CI workflow before merging.

## Verification limits

Automated API tests use the memory adapter, not a live MongoDB instance. MongoDB connection, persistent sessions, and deployment behavior require separate integration verification before production. Email verification, password reset, account deletion/export, comprehensive concurrency handling, and assessment history are not yet implemented.

Verified locally: strict TypeScript check, production frontend build, and all 16 domain/API tests passed. Tests cover profile isolation, safe GitHub handles, source-linked analysis, idempotent imports, time budgets, original-resume preservation, and server-side quiz answers/grading. A live API walkthrough imported one public repository with seven signals, generated a seven-day plan, and graded five questions. The initial browser walkthrough covered evidence linking and task completion; the updated profile UI was inspected without changing the user's in-progress form. PDF extraction and the browser print dialog still need a dedicated file/print walkthrough.

## GitHub Actions setup

The current GitHub login does not have the `workflow` OAuth scope. To allow the application and all component branches to be pushed now, the CI definition is stored in `docs/github-actions-template.yml` rather than `.github/workflows/`. **No GitHub Actions checks are active yet.** After explicitly authorizing workflow access, copy that template to `.github/workflows/ci.yml` and push it. Local build and test commands work independently of GitHub Actions.

## Profile-save recovery

Expired sign-in now offers inline reauthentication without discarding profile fields. Unsaved profile drafts are kept in tab-scoped session storage, keyed by account. Local development persists account password hashes, sessions, profiles, and preparation data in a private `.data/` directory; never commit or publicly serve it. The local JSON adapter supports one API process and is not a replacement for MongoDB in production. GitHub inputs accept handles, @handles, profile/repository URLs, and links without a URL scheme. A regression test reinitializes local storage and verifies both profile persistence and session-cookie continuity.
