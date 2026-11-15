# JobFit Lab

A MERN career preparation workspace connecting job requirements to user-provided project evidence and practical preparation tasks. Evidence coverage is not a proficiency certification, hiring prediction, or ATS score.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** and select **Open demo workspace**. Each demo session gets an isolated sample workspace. The demo stores records in API memory; restarting the API clears them. Do not use real personal data in the demo. No AI API key is required.

## MongoDB mode

Copy `.env.example` to `.env`, set `DEMO_MODE=false`, provide `MONGODB_URI`, and set a random `SESSION_SECRET` of at least 32 characters. Restart the app and create an account. Domain records and sessions then use MongoDB. Never commit `.env`.

For a local MongoDB instance, use `mongodb://127.0.0.1:27017/jobfit-lab`; a reachable Atlas connection string also works. No live MongoDB instance is provisioned by this repository.

## Current working slice

- Email/password registration, login, logout, hashed passwords, cookie sessions.
- Isolated demo workspaces, explicitly labeled as temporary.
- Create projects and attach skill-specific evidence and supporting links.
- Paste a job description and inspect proposed requirements with exact excerpts.
- Explicitly confirm requirements, choose their importance, and attach matching evidence.
- Create preparation tasks for confirmed requirements and complete/reopen them.
- Coverage counts only confirmed requirements with explicitly linked matching evidence.
- Responsive overview, evidence library, role review, and preparation plan.

## Phases and remaining work

See [PLAN.md](PLAN.md). Foundation and the accounts/evidence slice are implemented, together with a basic vertical slice of role review and preparation tasks. Phase 3 is **not complete**: manual requirement editing, versioned immutable assessments, and more nuanced extraction remain. Phase 4 still needs priorities, dates, and task editing/deletion. Production release and optional AI/PDF features remain later phases.

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

Verified locally: strict TypeScript check, production frontend build, and all 9 domain/API tests passed. Browser walkthrough verified opening an isolated demo, explicitly confirming requirements, linking matching evidence, creating a preparation task, completing it, and checking that evidence coverage did not increase from task completion.

## GitHub Actions setup

The current GitHub login does not have the `workflow` OAuth scope. To allow the application and all component branches to be pushed now, the CI definition is stored in `docs/github-actions-template.yml` rather than `.github/workflows/`. **No GitHub Actions checks are active yet.** After explicitly authorizing workflow access, copy that template to `.github/workflows/ci.yml` and push it. Local build and test commands work independently of GitHub Actions.
