# JobFit Lab implementation plan

## Goal

Connect user-confirmed job requirements to user-provided project evidence, then turn uncovered requirements into preparation tasks. Coverage is not a hiring prediction or an ATS score.

## Phase 1 — Foundation and local preview

- React + TypeScript + Vite, Express API, shared domain types, environment validation, error handling.
- Explicit local demo adapter; real MongoDB adapter when configured.
- Done when installation, build, tests, and local preview work.

## Phase 2 — Accounts and evidence library

- Email/password accounts, password hashing, cookie sessions, ownership checks.
- Create projects and evidence with skill tags and supporting links.
- Done when two accounts cannot access each other's records and the evidence flow works.

## Phase 3 — Role requirements and assessment

- Paste job descriptions; propose requirements using a curated alias dictionary.
- Review exact excerpts, edit importance, explicitly confirm requirements, explicitly attach evidence.
- Basic first slice ships with phases 1–2 to exercise the full workflow.
- Remaining: manually add/edit/remove requirements, job-description revisions, immutable assessment snapshots and rule versions, handling conflicting requirements, and broader vocabulary.
- Done when earlier assessments survive later edits and ambiguous input remains reviewable.

## Phase 4 — Preparation planning

- First slice: create a task for a requirement, acceptance criteria, mark done/reopen.
- Remaining: priorities, effort estimates, due dates, edit/delete operations, cross-role gap grouping.
- Done when users can prioritize a feasible plan; task completion must never invent evidence.

## Phase 5 — Release quality

- API tests for ownership and invalid associations; domain tests for ambiguous matches.
- MongoDB integration verification, real-browser QA, production session checks, accessibility, export/delete account data, responsive layout, deployment, sample data, README and walkthrough.
- Done when the complete journey works against MongoDB and documented release checks pass.

## Phase 6 — Optional enhancements

- PDF resume import with user review, optional AI proposals with source excerpts, GitHub integration, email reminders.
- These are outside the first release. Never infer proficiency merely from a repository URL.

## Planning estimates

One developer, AI assistance, 15 focused hours/week, basic React/JavaScript familiarity. MVP: 45–70 hours (3–5 weeks). Portfolio-ready total: 95–145 hours (7–10 weeks), including MVP, excluding optional features. These are estimates, not measured benchmarks.

## Scope and verification tracking

Update README after implementation with checks actually run, phase status, and remaining limitations. Demo data is held in API memory and resets on restart; MongoDB mode is required for persistent multiuser use. Do not deploy demo mode publicly.
